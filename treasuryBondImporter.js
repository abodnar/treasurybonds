#!/usr/bin/env node

const fs = require('fs');
const {Builder, By, Key, until} = require('selenium-webdriver');
const yargs = require('yargs');


function fileExists(filename) {
    try {
        fs.accessSync(filename, fs.R_OK);
        return true;
    } catch (e) {
        return false;
    }
}

const argv = yargs
    .option('u', {
        alias: 'username',
        demandOption: true,
        describe: 'Your Treasury Direct username',
        type: 'string'
    })
    .option('p', {
        alias: 'password',
        demandOption: true,
        describe: 'Your Treasury Direct password',
        type: 'string'
    })
    .option('f', {
        alias: 'file',
        demandOption: true,
        describe: 'Path to the CSV file of bonds to import',
        type: 'string'
    })
    .check(function (argv) {
        if (fileExists(argv.f)) {
            return true;
        } else {
            throw(new Error('Argument check failed: file is not a readable file'));
        }
    })
    .help()
    .alias('help', 'h')
    .argv;

const username = argv.u;
const password = argv.p;
const bondFile = argv.f;

(async function importBonds() {
    let driver = await new Builder().forBrowser('chrome').build();
    try {
        await driver.get('https://www.treasurydirect.gov/go_to_login.htm');
        await driver.findElement(By.xpath('//img[@alt=\'Go to TreasuryDirect\']')).click();
        await driver.wait(until.titleIs('Access Your TreasuryDirect Account'), 1000);

        await driver.findElement(By.name('username')).sendKeys(username, Key.RETURN);
    } finally {
        // await driver.quit();
    }
})();