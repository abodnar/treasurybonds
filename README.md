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
node treasuryBondImporter.js [options]

Options:
  --version       Show version number                                  [boolean]
  -u, --username  Your Treasury Direct username                         [string]
  -p, --password  Your Treasury Direct password                         [string]
  -f, --file      Path to the CSV file of bonds to import    [string] [required]
  -e, --endpoint  Endpoint URL for accessing an already running Chrome  [string]
  --help, -h      Show help               
```