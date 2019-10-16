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

const keypress = async () => {
    process.stdin.setRawMode(true);
    return new Promise(resolve => process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        resolve()
    }))
};

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
        describe: 'Your Treasury Direct username',
        type: 'string'
    })
    .option('p', {
        alias: 'password',
        describe: 'Your Treasury Direct password',
        type: 'string'
    })
    .option('f', {
        alias: 'file',
        demandOption: true,
        describe: 'Path to the CSV file of bonds to import',
        type: 'string'
    })
    .option('e', {
        alias: 'endpoint',
        describe: 'Endpoint URL for accessing an already running Chrome',
        type: 'string'
    })
    .check(function (argv) {
        // if (argv.e)
        //     throw(new Error('Argument check failed: You must specify a '))
        // }
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
const wsEndpointURL = argv.e;

async function enterPassword(page, password) {
    for (let i = 0; i < password.length; i++) {
        let key = password[i].toUpperCase();

        await page.click('[value="' + key + '"]');
    }

    // Submit the password
    await Promise.all([
        page.waitForNavigation(),
        page.click('[name="enter.x"]'),
    ]);
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

function bondHasRequiredFields(bond) {
    return (bond.series && bond.denomination && bond.serial_number && bond.issue_date);
}

async function processBond(bond, page) {
    if (bondHasRequiredFields(bond)) {
        await selectOptionByText('select[name="secList"]', page, bond.series);
        await selectOptionByText('select[name="denomList"]', page, bond.denomination);

        await page.type('[name=serialNumber]', bond.serial_number, {delay: 100});

        let month = String(bond.issue_date.getMonth() + 1).padStart(2, '0');
        await page.type('[name=issueDateMonth]', month, {delay: 100});

        let year = String(bond.issue_date.getFullYear());
        await page.type('[name=issueDateYear]', year, {delay: 100});

        await Promise.all([
            page.waitForNavigation(), // The promise resolves after navigation has finished
            page.click('[value="Add to Cart"]'), // Clicking the button will indirectly cause a navigation
        ]);

        processedRows++;
    }
}

(async () => {
    let browser = null;

    let readBondFilePromise = readBondFile(bondFile);
    await readBondFilePromise.then(function (result) {
        bondData = result;
        parsedRows = result.length;
    });

    try {
        if (wsEndpointURL === undefined) {
            browser = await puppeteer.launch({
                headless: false, // Puppeteer is 'headless' by default.
                // devtools: true,
            });

            const page = await browser.newPage();
            await page.goto('https://www.treasurydirect.gov/go_to_login.htm', {
                timeout: 0,
            });

            await Promise.all([
                page.waitForNavigation(), // The promise resolves after navigation has finished
                page.click('[alt="Go to TreasuryDirect"]') // Clicking the button will indirectly cause a navigation
            ]);

            await page.type('[name=username]', username, {delay: 100});

            await Promise.all([
                page.waitForNavigation(),
                page.keyboard.press('Enter')
            ]);

            const otpElement = await page.$('[name=otp]');

            if (otpElement !== null) {
                console.log('You must enter the OTP code that was sent through email.');
                console.log('Once you\'ve submitted the OTP code and the password page is displayed, press any key to continue.');
                await keypress();
            }

            await enterPassword(page, password);

            // Navigate to the ManageDirect page
            const manageDirectElem = await page.$x("//a[contains(., 'ManageDirect')]");

            if (manageDirectElem.length) {
                await Promise.all([
                    page.waitForNavigation(),
                    manageDirectElem[0].click()
                ]);
            }

            // Navigate to the Conversion Linked Account
            const conversionAccountElem = await page.$x("//a[contains(., 'Access my Conversion Linked Account')]");
            await Promise.all([
                page.waitForNavigation(),
                conversionAccountElem[0].click()
            ]);

            // Navigating to the page that lets you add a bond
            const convManageDirectElem = await page.$x("//a[contains(., 'ManageDirect')]");
            await Promise.all([
                page.waitForNavigation(),
                convManageDirectElem[0].click()
            ]);

            // Navigate to Convert my bonds page
            const convertBondsElem = await page.$x("//a[contains(., 'Convert my bonds')]");
            await Promise.all([
                page.waitForNavigation(),
                convertBondsElem[0].click()
            ]);

            // Select default selected Registration
            const selectRegistrationElem = await page.$('[value="Select Registration & Continue"]');
            await Promise.all([
                page.waitForNavigation(),
                selectRegistrationElem.click()
            ]);
        } else {
            browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpointURL,
            })
        }

        const pages = await getPages(browser);
        const page = await findBondEntryPage(pages);

        if (page) {
            let i, chunk;
            for (i = 0; bondData.length; i += 50) {
                chunk = bondData.slice(i, i + 50);

                for (const row of chunk) {
                    await processBond(row, page);
                }

                if (bondData.length > (i + 50)) {
                    console.log('Imported 50 bonds into cart. You must create a manifest before proceeding further.');
                    console.log('Hit any key once you have created the manifest and navigated back to the Add to Bond page');
                    await keypress();
                }
            }
        }
    } finally {
        if (browser) {
            browser.disconnect();
        }

        console.log('Parsed: ' + parsedRows + ' rows from file.');
        console.log('Processed: ' + processedRows + ' bonds.')
    }
})();