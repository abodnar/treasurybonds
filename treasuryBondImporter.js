#!/usr/bin/env node

const fs = require('fs');
const yargs = require('yargs');
const csv = require('fast-csv');
const format = require('format-number');
const puppeteer = require('puppeteer');

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
    .option('e', {
        alias: 'endpoint',
        describe: 'Endpoint URL for accessing an already running Chrome',
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
const wsEndpointURL = argv.e;

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

async function getPages(browser) {
    return browser.pages();
}

async function findBondEntryPage(pages) {
    let foundPage = null;
    for (const page of pages) {
        let title = await page.title();

        if (title === 'Add a Bond') {
            foundPage = page;
        }
    }

    return foundPage;
}

async function selectOptionByText(selector, page, val) {
    const element = await page.$(selector);
    let properties = await element.getProperties();
    for (const property of properties.values()) {
        const element = property.asElement();
        if (element) {
            let hText = await element.getProperty("text");
            let text = await hText.jsonValue();
            if (text === val) {
                let hValue = await element.getProperty("value");
                let value = await hValue.jsonValue();
                await page.select(selector, value);
            }
        }
    }
}

async function processBond(bond, page) {
    await selectOptionByText('select[name="secList"]', page, bond.series);
    await selectOptionByText('select[name="denomList"]', page, bond.denomination);

    await page.type('[name=serialNumber]', bond.serial_number, {delay: 100});

    let month = String(bond.issue_date.getMonth() + 1).padStart(2, '0');
    await page.type('[name=issueDateMonth]', month, {delay: 100});

    let year = String(bond.issue_date.getFullYear());
    await page.type('[name=issueDateYear]', year, {delay: 100});

    await Promise.all([
        page.waitForNavigation(), // The promise resolves after navigation has finished
        page.click('[value="Add to Cart"]'), // Clicking the link will indirectly cause a navigation
    ]);
}

(async () => {
    let browser = null;

    let readBondFilePromise = readBondFile(bondFile);
    await readBondFilePromise.then(function (result) {
        bondData = result;
        parsedRows = result.length;
    });

    // let opts = new chrome.Options();
    // opts.addArguments('user-data-dir=' + browserProfile);
    //
    // let driver = new Builder().withCapabilities(Capabilities.chrome()).setChromeOptions(opts).build();

    try {
        if (wsEndpointURL === null) {
            console.log('Shouldn\'t be here currently');
        } else {
            browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpointURL
            })
        }

        // await driver.get('https://www.treasurydirect.gov/go_to_login.htm');
        // await driver.findElement(By.xpath('//img[@alt="Go to TreasuryDirect"]')).click();
        // await driver.wait(until.titleIs('Access Your TreasuryDirect Account'), 1000);
        //
        // await driver.findElement(By.name('username')).sendKeys(username, Key.RETURN);
        //
        // await driver.wait(until.titleIs('Access Your TreasuryDirect Account'), 1000);
        //
        // enterPassword(driver, password);
        //
        // await driver.wait(until.titleContains('Welcome to Your Account Summary'), 1000);
        // await driver.findElement(By.partialLinkText('ManageDirect')).click();
        //
        // // Switching to the conversion account
        // await driver.wait(until.titleIs('ManageDirect'), 1000);
        // await driver.findElement(By.partialLinkText('Access my Conversion Linked Account')).click();
        //
        // // Navigating to the page that lets you add a bond
        // await driver.wait(until.titleIs('Account Summary for My Converted Bonds'), 1000);
        // await driver.findElement(By.partialLinkText('ManageDirect')).click();
        //
        // await driver.wait(until.titleIs('ManageDirect'), 1000);
        // await driver.findElement(By.partialLinkText('Convert my bonds')).click();
        //
        // await driver.wait(until.titleIs('Select A Registration'), 1000);
        // await driver.findElement(By.xpath('//*[@value="Select Registration & Continue"]')).click();
        const pages = await getPages(browser);
        const page = await findBondEntryPage(pages);

        if (page) {
            for (const row of bondData) {
                await processBond(row, page);

                processedRows++;
            }
        }
    } finally {
        browser.disconnect();
    }
})();