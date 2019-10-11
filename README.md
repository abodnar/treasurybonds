# Treasury Bond Importer

## Requirements

* Node 11+
* A Treasury Direct account and corresponding conversion account
* Chrome (only supported browser at the moment)
  * Must not be clearing cookies on exit
  * Must have previously logged into Treasury Direct and saved the browser during OTP validation
* A CSV file with your bonds. Currently only supports Savings Bond wizard format

## Setup

```bash
$ npm install
```

## Usage

```bash
node treasuryBondImporter.js [options]

Options:
  --version       Show version number                                  [boolean]
  -u, --username  Your Treasury Direct username              [string] [required]
  -p, --password  Your Treasury Direct password              [string] [required]
  -f, --file      Path to the CSV file of bonds to import    [string] [required]
  -o, --profile   Path to your Chrome profile directory      [string] [required]
  --help, -h      Show help               
```