#!/usr/bin/env node

const fs = require('fs');
const {Builder, By, Key, until, Capabilities} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const yargs = require('yargs');
const csv = require('fast-csv');
const format = require('format-number');

let parsedRows = 0;
let processedRows = 0;
let bondData = [];

function fileExists(filename) {
    try {
        fs.accessSync(filename, fs.R_OK);
        return true;
    } catch (e) {
        return false;
    }
}

function readBondFile(bondFile) {
    return new Promise(function (resolve, reject) {
        let data = [];
        fs.createReadStream(bondFile)
            .pipe(csv
                .parse({
                    headers: [
                        'series',
                        'denomination',
                        'serial_number',
                        'issue_date'
                    ],
                    ignoreEmpty: true,
                    renameHeaders: true,
                    discardUnmappedColumns: true
                })
                .transform(data => ({
                    series: data.series,
                    denomination: format({})(data.denomination),
                    serial_number: data.serial_number,
                    issue_date: new Date(data.issue_date),
                    original: {
                        series: data.series,
                        denomination: data.denomination,
                        serial_number: data.serial_number,
                        issue_date: data.issue_date
                    }
                }))
            )
            .on('error', error => reject(error))
            .on('data', row => data.push(row))
            .on('end', () => resolve(data));
    });
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
    .option('o', {
        alias: 'profile',
        demandOption: true,
        describe: 'Path to your Chrome profile directory',
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
const browserProfile = argv.o;

function enterPassword(driver, password) {
    for (let i = 0; i < password.length; i++) {
        let key = password[i].toUpperCase();

        driver.findElement(By.xpath('//input[@value="' + key + '"]')).then(function (el) {
            return el.click();
        });
    }

    // Submit the password
    driver.findElement(By.name('enter.x')).then(function (el) {
        return el.click();
    });
}

function processBond(bond, driver) {
    // Select the series type for the bond
    driver.findElement(By.xpath('//*[@name="secList"]/option[normalize-space(text())="' + bond.series + '"]')).then(function (el) {
        return el.click();
    });

    // Select the denomination for the bond
    driver.findElement(By.xpath('//*[@name="denomList"]/option[normalize-space(text())="' + bond.denomination + '"]')).then(function (el) {
        return el.click();
    });

    // Enter the serial number for the bond
    driver.findElement(By.name('serialNumber')).then(function (el) {
        return el.sendKeys(bond.serial_number);
    });

    // Enter the issue month for the bond
    driver.findElement(By.name('issueDateMonth')).then(function (el) {
        let month = String(bond.issue_date.getMonth() + 1).padStart(2, '0');

        return el.sendKeys(month);
    });

    // Enter the issue year for the bond
    driver.findElement(By.name('issueDateYear')).then(function (el) {
        return el.sendKeys(bond.issue_date.getFullYear());
    });

    // Add bond to cart
    driver.findElement(By.xpath('//input[@value="Add to Cart"]')).then(function (el) {
        return el.click();
    });
}

(async function importBonds() {
    let readBondFilePromise = readBondFile(bondFile);
    await readBondFilePromise.then(function (result) {
        bondData = result;
        parsedRows = result.length;
    });

    let opts = new chrome.Options();
    opts.addArguments('user-data-dir=' + browserProfile);

    let driver = new Builder().withCapabilities(Capabilities.chrome()).setChromeOptions(opts).build();

    try {
        await driver.get('https://www.treasurydirect.gov/go_to_login.htm');
        await driver.findElement(By.xpath('//img[@alt="Go to TreasuryDirect"]')).click();
        await driver.wait(until.titleIs('Access Your TreasuryDirect Account'), 1000);

        await driver.findElement(By.name('username')).sendKeys(username, Key.RETURN);

        await driver.wait(until.titleIs('Access Your TreasuryDirect Account'), 1000);

        enterPassword(driver, password);

        await driver.wait(until.titleContains('Welcome to Your Account Summary'), 1000);
        await driver.findElement(By.partialLinkText('ManageDirect')).click();

        // Switching to the conversion account
        await driver.wait(until.titleIs('ManageDirect'), 1000);
        await driver.findElement(By.partialLinkText('Access my Conversion Linked Account')).click();

        // Navigating to the page that lets you add a bond
        await driver.wait(until.titleIs('Account Summary for My Converted Bonds'), 1000);
        await driver.findElement(By.partialLinkText('ManageDirect')).click();

        await driver.wait(until.titleIs('ManageDirect'), 1000);
        await driver.findElement(By.partialLinkText('Convert my bonds')).click();

        await driver.wait(until.titleIs('Select A Registration'), 1000);
        await driver.findElement(By.xpath('//*[@value="Select Registration & Continue"]')).click();

        await bondData.slice(0, 2).forEach(function (row) {
            // Wait for the add bond page to load
            driver.wait(until.titleIs('Add a Bond'), 1000);

            processBond(row, driver);
            processedRows++;
        });
    } finally {
        // await driver.quit();
    }
})();