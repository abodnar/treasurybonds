# Treasury Bond Importer

## Requirements

* Node 11+
* A Treasury Direct account and corresponding conversion account
* A CSV file with your bonds. Currently only supports Savings Bond wizard format

## Setup

```bash
$ npm install
```

## Usage

```bash
Usage: node treasuryBondImporter.js -f <bond file> [options]

Options:
  --version       Show version number                                  [boolean]
  -f, --file      Path to the CSV file of bonds to import    [string] [required]
  -u, --username  Your Treasury Direct username                         [string]
  -p, --password  Your Treasury Direct password                         [string]
  -e, --endpoint  Endpoint URL for accessing an already running Chrome  [string]
  --help, -h      Show help                                            [boolean]
```

## Parameters

* File: A CSV file with columns, Series, Denomination, Serial Number, Issue Date. This parameter is required.
* Username: Your Treasury Direct username. Only required if you specified a password
* Password: Your Treasury Direct password. Only required if you specified a username
* Endpoint: A ws endpoint URL that Chrome provides. See below on how to do this

## Attaching to an existing Chrome

### Mac
1. Start Chrome by doing:
    ```
    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=/Users/<username>/Library/Applications\ Support/Google/Chrome/
    ```

2. You’ll see a printout like this:
    ```
    DevTools listening on ws://127.0.0.1:9222/devtools/browser/41a0b5f0–6747–446a-91b6–5ba30c87e951
    ```

3. Copy the WS Endpoint URL and then execute the Treasury Import script using the -e flag

### Windows (hasn't been tested)
1. Start Chrome by doing:
    ```
    start chrome.exe –remote-debugging-port=9222
    ```

2. Next you’ll open the browser to http://127.0.0.1:9222

3. Copy websocketDebuggerUrl value(WS Endpoint URL) and then execute the Treasury Import script using the -e flag

