# ESPN Fantasy Baseball Transaction Importer

With the new ESPN update for fantasy baseball, the transactions for last year are seemingly broken, not viewable anywhere on the UI. However, after doing some digging I discovered that the data is there and the endpoints _do_ return transaction data -- it's just not viewable on the UI for science reasons.

In any case, the transaction log is hugely important for my league for determing keeper prices, and I'm sure mine is not the only one. Given that this data exists, I wrote this small program that scans a league's transaction history and exports it to a csv file you can view in Excel or Google Sheets.

## Read Before Using
You will need to authenticate with your ESPN username and password through this program to get your data. This may make you uneasy, and rightfully so. You are welcome to look through the source code here and see I'm not doing anything fishy (I'm bad enough at fantasy baseball and am not interested in being bad at it with more teams). That said, to be extra safe, you should change your ESPN password to something temporarily then change it back after you're done with this program.

This only runs for 2018; I have no idea if it works for any other previous seasons (probably not).

Some players did not have IDs in the map, so they'll be listed as UNKNOWN in the export. Most of the players should be there, however. If you need that information, you can probably figure it out by looking at team rosters and deducing which player it is.

The code itself is very clowny; I wrote it in like an hour or two so please be gentle.

Running this is probably not condoned behavior by ESPN, so don't be a dick with this. Run it, get your data, and get out. ESPN may be mean to us by not showing us old transaction data, so don't be mean back and ruin this for the other folks who still would like to recover this information.

I'm not responsible for anything that happens to your ESPN account by doing this. Use at your own risk.

## Pre-Requisites

- You will need node.js installed for your OS flavor; you can download it [here](https://nodejs.org/)
- Comfort with running a few commands in Terminal (OSX, Linux) or Command Line (Windows). 
  - Note that I can only confirm this works on Linux, but it should work fine on OSX and Windows as well

## Step-By-Step Guide

1. Fetch this repository locally, either by cloning it via git (if you're cool with that kind of thing) or just downloading the zip file above and extracting it to a local directory
2. Log on to ESPN fantasy baseball and get your league's ID. You can easily get this from the URL. It should look something like `http://fantasy.espn.com/baseball/league?leagueId=**{THIS_NUMBER_IS_YOUR_LEAGUE_ID}**&seasonId=2019`
3. Open the config.js file and fill out your espn username, password, and league ID in the respective fields. You may also change the name of the file that is written; by default it is `2018_transactions`. Do not include a file extension.
4. In terminal or command line, open to the directory of the program, and run `node index.js`. 
5. If all goes well, it will spit out a bunch of information and write to the specified file. 
6. Import that file to Excel or Google Sheets (so you can share with the rest of the league like the nice person I know you are) and enjoy.

## Thanks

Special thanks to [Crunch Time Baseball](http://crunchtimebaseball.com/baseball_map.html) for supplying the CSV containing player IDs. Make sure to take a look over there if you're interested in fantasy data.
