/**
 * Asha (chat assistant) -> Email + Google Sheet logger for Dr Shilpa Fertility.
 * Receives every chat transcript, booking and website enquiry from the chat assistant and:
 *   1) emails it to the clinic, and
 *   2) saves it to a Google Sheet (a permanent record, so nothing is ever lost).
 *
 * ONE-TIME SETUP (~5 minutes, all free):
 *  1. Go to https://sheets.new to make a blank Google Sheet (this stores every chat/booking).
 *  2. In that Sheet:  Extensions -> Apps Script.  Delete any sample code, paste THIS whole file.
 *  3. Change CLINIC_EMAIL below to the address that should receive the chats.
 *  4. Click  Deploy -> New deployment.  Click the gear -> choose "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *     Click Deploy, then "Authorize access" and allow it (to send email / edit the sheet).
 *  5. Copy the "Web app URL" it shows (it ends in /exec).
 *  6. In Coolify (your chat assistant app -> Environment Variables) add:   NOTIFY_WEBHOOK_URL = (that URL)
 *     Save and Redeploy. From then on every chat, booking and website enquiry is emailed AND logged here.
 */
const CLINIC_EMAIL = "care@drshilpafertility.com";   // change to the clinic's real email

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const subject = data.subject || "Asha - new message";
    const message = data.message || "";
    const recipient = data.to || CLINIC_EMAIL;   // a patient's address for review requests, the clinic otherwise

    // 1) email it
    MailApp.sendEmail({ to: recipient, subject: subject, body: message });

    // 2) log it to the sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(["Time", "Subject", "Details"]);
    sheet.appendRow([new Date(), subject, message]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("Dr Shilpa Fertility chat logger is running.");
}
