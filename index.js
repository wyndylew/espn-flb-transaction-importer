require('es6-promise').polyfill();
require('isomorphic-fetch');

const config = require('./config');
const fs = require('fs');
const moment = require('moment');
const path = require('path');

if (
  config.username == null ||
  config.password == null ||
  config.leagueEspnId == null ||
  config.output == null
) {
  console.log('Configuration data malformed.');
  process.exit(1);
}

const outputFile = path.resolve(__dirname, config.output + '.csv');

if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
}

function playerMap() {
  return new Promise(resolve => {
    var lineReader = require('readline').createInterface({
      input: fs.createReadStream('master2.csv')
    });

    const playerMap = new Map();
    const headerMap = {};
    let lineIndex = 0;
    lineReader.on('line', function(line) {
      const values = line.split(',');
      if (lineIndex === 0) {
        for (let i = 0; i < values.length; i++) {
          headerMap[values[i]] = [i];
        }
      } else {
        const espnId = values[headerMap['ESPNID']];
        const name = values[headerMap['PLAYERNAME']];
        const pos = values[headerMap['POS']];

        playerMap.set(espnId, { espnId: espnId, name: name, pos: pos });
      }

      ++lineIndex;
    });

    lineReader.on('close', () => {
      resolve(playerMap);
    });
  });
}

const getAPIKey = () =>
  fetch(
    'https://registerdisney.go.com/jgc/v6/client/ESPN-ONESITE.WEB-PROD/api-key?langPref=en-US',
    {
      method: 'POST'
    }
  ).then(function(response) {
    if (response.status !== 200) {
      return Promise.reject();
    }

    const apiKey = response.headers.get('api-key');
    return apiKey;
  });

function authorizeEspn() {
  return getAPIKey().then(apiKey =>
    fetch(
      'https://registerdisney.go.com/jgc/v6/client/ESPN-ONESITE.WEB-PROD/guest/login?langPref=en-US',
      {
        method: 'POST',
        headers: {
          accept: '*/*',
          authorization: `APIKEY ${apiKey}`,
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          expires: -1,
          pragma: 'no-cache'
        },
        body: JSON.stringify({
          loginValue: config.username,
          password: config.password
        })
      }
    ).then(function(response) {
      if (response.status !== 200) {
        console.log('Could not log in');
        process.exit(1);
        return;
      }

      console.log(`Logged in as ${config.username}`);

      const apiKey = response.headers.get('api-key');

      return response.json().then(json => {
        const s2 = json.data['s2'];
        const swid = json.data.profile.swid;

        return {
          espn_s2: s2,
          espn_api: apiKey,
          swid: swid
        };
      });
    })
  );
}

const getLeagueStatus = auth =>
  fetch(
    `http://fantasy.espn.com/apis/v3/games/flb/seasons/2018/segments/0/leagues/${
      config.leagueEspnId
    }?view=mStatus`,
    {
      method: 'GET',
      headers: {
        Cookie: `ESPN-ONESITE.WEB-PROD.api=${
          auth.espn_api
        }; ESPN-ONESITE.WEB-PROD-ac=XUS; ESPN-ONESITE.WEB-PROD.auth=disneyid; SWID=${
          auth.swid
        }; SWID_NT=0; dtcAuth=false; espn_s2=${auth.espn_s2};`
      }
    }
  ).then(response => {
    return response.json().then(json => {
      return {
        firstScoringPeriod: json.status.firstScoringPeriod,
        finalScoringPeriod: json.status.finalScoringPeriod
      };
    });
  });

Promise.all([
  playerMap(),
  authorizeEspn().then(auth => {
    return getLeagueStatus(auth).then(status => {
      auth['status'] = status;
      return auth;
    });
  })
]).then(([playerMap, auth]) => {
  console.log(
    `Import Scoring Periods ${auth.status.firstScoringPeriod} - ${
      auth.status.finalScoringPeriod
    }`
  );

  const logger = fs.createWriteStream(outputFile, {
    flags: 'a'
  });

  logger.write(
    [
      'DATE',
      'TIME',
      'TRANSACTION',
      'TYPE',
      'COST',
      'PLAYER_ID',
      'PLAYER_NAME',
      'PLAYER_POS',
      'FROM',
      'TO',
      '\n'
    ].join(',')
  );
  let total = 0;
  let promise = Promise.resolve();
  for (
    let i = auth.status.firstScoringPeriod;
    i <= auth.status.finalScoringPeriod;
    ++i
  ) {
    promise = promise.then(() =>
      fetch(
        `http://fantasy.espn.com/apis/v3/games/flb/seasons/2018/segments/0/leagues/${
          config.leagueEspnId
        }?scoringPeriodId=${i}&view=mTeam&view=mTransactions2`,
        {
          method: 'GET',
          headers: {
            Cookie: `ESPN-ONESITE.WEB-PROD.api=${
              auth.espn_api
            }; ESPN-ONESITE.WEB-PROD-ac=XUS; ESPN-ONESITE.WEB-PROD.auth=disneyid; SWID=${
              auth.swid
            }; SWID_NT=0; dtcAuth=false; espn_s2=${auth.espn_s2};`,
            'X-Fantasy-Filter':
              '{"transactions":{"filterType":{"value":["WAIVER","WAIVER_ERROR", "TRADE_UPHOLD", "FREEAGENT"]}}}'
          }
        }
      ).then(response => {
        return response.json().then(json => {
          const transactions = json.transactions || [];
          const teams = json.teams;
          console.log(
            `> Importing ${
              transactions.length
            } transactions from scoring period ${i}`
          );

          total += transactions.length;

          for (const transaction of transactions) {
            if (
              transaction.executionType === 'CANCEL' ||
              transaction.status !== 'EXECUTED'
            ) {
              continue;
            }

            const items = [];
            for (const item of transaction.items) {
              let player = playerMap.get(`${item.playerId}`);
              if (player == null) {
                player = { espnId: item.playerId, name: 'UNKNOWN', pos: '???' };
              }

              const fromTeam =
                item.fromTeamId === -1
                  ? 'Waivers'
                  : (() => {
                      const team = teams.find(t => t.id === item.fromTeamId);
                      if (team == null) {
                        throw new Error('Team not found');
                      }
                      return `${team.location} ${team.nickname}`;
                    })();
              const toTeam =
                item.toTeamId === -1
                  ? 'Waivers'
                  : (() => {
                      const team = teams.find(t => t.id === item.toTeamId);
                      if (team == null) {
                        throw new Error('Team not found');
                      }
                      return `${team.location} ${team.nickname}`;
                    })();

              const date = moment(transaction.processDate);
              logger.write(
                [
                  date.format('MMMM D'),
                  date.format('h:mmA'),
                  transaction.type,
                  item.type,
                  transaction.type === 'WAIVER' && item.type === 'ADD'
                    ? `${transaction.bidAmount}`
                    : '--',
                  player.espnId,
                  player.name,
                  player.pos,
                  fromTeam,
                  toTeam,
                  '\n'
                ].join(',')
              );
            }
          }
        });
      })
    );
  }

  promise = promise.then(() => {
    console.log('\n');
    console.log(`Imported ${total} transactions`);

    logger.end();
  });
});
