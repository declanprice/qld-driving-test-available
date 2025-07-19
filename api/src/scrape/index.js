import puppeteer from 'puppeteer';
import {checkTableForSoonerDate} from "../util/check-table-for-sooner-date.js";
import fs from "fs";
import {Resend} from 'resend';
import dotenv from 'dotenv';
dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = process.env.TO_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL;
const LICENCE_NUMBER = process.env.LICENCE_NUMBER;
const url = 'https://www.service.transport.qld.gov.au/SBSExternal/application/CleanBookingDE.xhtml?dswid=-6205';

let counter = 0;

export const handler = () => {
}

const scapePage = async () => {
    let result = null;
    let browser = null;

    browser = await puppeteer.launch({headless: false});

    let page = await browser.newPage();

    await page.goto(url);

    await handleTermsAndConditions(page);

    await handleContactDetails(page);

    await handleConfirmDetails(page);

    await handleCentreDetails(page);

    const dates = await handleCheckDates(page);

    await sendEmailNotification(dates);

    await browser.close();

    console.log(result);
}

const handleTermsAndConditions = async (page) => {
    const termsBtnId = '#termsAndConditions\\:TermsAndConditionsForm\\:acceptButton';

    await wait(2);

    const button = await page.$(termsBtnId);

    if (button) {
        await page.click(termsBtnId);
    }
}

const handleContactDetails = async (page) => {
    const frmLicenceNumberId = '#CleanBookingDEForm\\:dlNumber';
    const frmContactNameId = '#CleanBookingDEForm\\:contactName';
    const frmContactPhoneId = '#CleanBookingDEForm\\:contactPhone';
    const frmTestTypeBtnId = '#CleanBookingDEForm\\:productType_label';
    const frmTestTypeItemId = '#CleanBookingDEForm\\:productType_1';
    const frmContinueBtnId = '#CleanBookingDEForm\\:actionFieldList\\:confirmButtonField\\:confirmButton'

    const licenceNumber = LICENCE_NUMBER;
    const contactName = 'John Doe';
    const phoneNumber = '0425428312';

    await wait(2);

    await page.locator(frmLicenceNumberId).fill(licenceNumber);

    await wait(1);

    await page.locator(frmContactNameId).fill(contactName);

    await wait(1);

    await page.locator(frmContactPhoneId).fill(phoneNumber);

    await wait(1);

    await page.click(frmTestTypeBtnId);

    await wait(1);

    await page.click(frmTestTypeItemId);

    await wait(2);

    await page.click(frmContinueBtnId);
}

const handleConfirmDetails = async (page) => {
    const frmContinueBtnId = '#BookingConfirmationForm\\:actionFieldList\\:confirmButtonField\\:confirmButton';

    await wait(2);

    await page.click(frmContinueBtnId);
}


const handleCentreDetails = async (page) => {
    const frmRegionMenuBtnId = '#BookingSearchForm\\:region_label';
    const frmRegionItemId = '#BookingSearchForm\\:region_17';

    const frmCentreMenuBtnId = '#BookingSearchForm\\:centre_label';
    const frmCentreMenuItemId = '#BookingSearchForm\\:centre_1';
    const frmCentreContinueBtnId = '#BookingSearchForm\\:actionFieldList\\:confirmButtonField\\:confirmButton';

    await wait(2);

    await page.click(frmRegionMenuBtnId);

    await wait(1);

    await page.click(frmRegionItemId);

    await wait(1);

    await page.click(frmCentreMenuBtnId);

    await wait(1);

    await page.click(frmCentreMenuItemId);

    await wait(2);

    await page.click(frmCentreContinueBtnId);
}

const handleCheckDates = async (page) => {

    const checkForDate = new Date('Tuesday, 20 April 2025 11:55 AM');

    await wait(2);

    const table = await page.$('[role="grid"]');

    if (!table) {
        throw new Error('Table not found');
    }

    const rawHtml = await page.evaluate(() => {
        const element = document.querySelector('table[role="grid"]'); // Selects <table> with role="grid"
        return element ? element.outerHTML : null;
    });

    await page.screenshot({path: 'screenshot.png', fullPage: true});

    return checkTableForSoonerDate(checkForDate, rawHtml);
}

const sendEmailNotification = async (soonerDates) => {
    const imagePath = "screenshot.png";
    const imageData = fs.readFileSync(imagePath).toString("base64");

    counter++;

    if (soonerDates.length > 0) {
        const {data, error} = await resend.emails.send({
            from: FROM_EMAIL,
            to: [TO_EMAIL],
            subject: `QUICK! - SOONER DRIVING TEST AVAILABLE`,
            html: '<p>book now - https://www.service.transport.qld.gov.au/SBSExternal/application/CleanBookingDE.xhtml?dswid=7550</p>',
            attachments: [
                {
                    filename: 'result.png',
                    content: imageData,
                    type: 'image/png',
                    disposition: 'attachment'
                }
            ]
        });

        if (error) {
            console.error(" (ERROR) - Error sending email:", error);
            throw error;
        }

        console.log("(INFO) - Email sent successfully", data);
    } else {
        if (counter === 4) {
            const {data, error} = await resend.emails.send({
                from: FROM_EMAIL,
                to: [TO_EMAIL],
                subject: `Available Driving Test Results`,
                html: 'No tests available',
                attachments: [
                    {
                        filename: 'result.png',
                        content: imageData,
                        type: 'image/png',
                        disposition: 'attachment'
                    }
                ]
            });

            if (error) {
                console.error(" (ERROR) - Error sending email:", error);
                throw error;
            }

            console.log("(INFO) - Email sent successfully", data);

            counter = 0;
        } else {
            console.log("(INFO) - Not sending email yet.");
        }
    }
}

const wait = async (waitSeconds) => {
    return new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
}

console.log(`(INFO) - Starting - ${new Date().toISOString()}`);

await scapePage();

setInterval(async () => {
    console.log(`(INFO) - Checking website for available dates - ${new Date().toISOString()}`);
    try {
        await scapePage();
    } catch (error) {
        console.log('(ERROR) - failed to check website for available dates', error);
    }
}, 10 * 60 * 1000);

