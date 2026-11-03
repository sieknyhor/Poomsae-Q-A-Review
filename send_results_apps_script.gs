// Receives a reviewer's results from 06. QA_review_300_kakaka_2026-11-03.html and emails them.
// The address lives only here, so the page cannot send mail anywhere else.
//
// Set up once, in the Google account that should send the mail:
// 1. Open https://script.google.com and press New project.
// 2. Replace everything in the editor with this file, and save.
// 3. Press Deploy > New deployment > Select type (gear) > Web app.
// 4. Set "Execute as" to Me and "Who has access" to Anyone, then press Deploy.
// 5. Allow the permissions Google asks for, and copy the Web app URL (it ends in /exec).
//
// To change this script later, keep the same URL: press Deploy > Manage deployments, press the pencil,
// set Version to New version, and press Deploy. A new deployment would get a new URL, and pages already
// shared would stop sending.

const RESULTS_TO = "sieknyhor@gmail.com";
const MAX_CHARS = 5000000;  // The PDF arrives as base64: about 1.2 MB.

function doPost(e) {
  try {
    const raw = e.postData.contents;
    if (raw.length > MAX_CHARS) return reply({ ok: false, error: "too_large" });
    const data = JSON.parse(raw);
    const reviewer = String(data.reviewer || "Unknown").slice(0, 80);
    const rows = Array.isArray(data.rows) ? data.rows.slice(0, 1000) : [];
    const rated = rows.filter(function (row) { return row.rating; });
    const counts = [1, 2, 3, 4, 5].map(function (n) {
      return n + ": " + rated.filter(function (row) { return Number(row.rating) === n; }).length;
    }).join(", ");
    const average = rated.length
      ? (rated.reduce(function (sum, row) { return sum + Number(row.rating); }, 0) / rated.length).toFixed(1)
      : "-";
    const low = rows.filter(function (row) { return row.rating && Number(row.rating) <= 2; })
      .map(function (row) { return row.id + " (" + row.rating + ") " + row.question + (row.note ? "\n    " + row.note : ""); });
    const body = [
      "Reviewer: " + reviewer,
      "Page: " + String(data.page || ""),
      "Rated: " + rated.length + " of " + Number(data.total || 0),
      "Average: " + average,
      "Ratings: " + counts,
      "",
      "Rated 1 or 2:",
      low.length ? low.join("\n") : "None",
      "",
      data.pdf ? "The full review, the same as Download as PDF, is in the attached PDF." : "No PDF came with this result.",
      "Every rated or noted answer is in the attached CSV.",
    ].join("\n");
    const lines = ["id,question,rating,note"].concat(rows.map(function (row) {
      return [cell(row.id), cell(row.question), Number(row.rating) || "", cell(row.note)].join(",");
    }));
    const stamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyyMMdd_HHmm");
    const name = "qa_review_" + reviewer.replace(/[^\w가-힣-]+/g, "_") + "_" + stamp;
    const attachments = [Utilities.newBlob("\ufeff" + lines.join("\r\n"), "text/csv", name + ".csv")];
    // "JVBERi0" is "%PDF-" in base64: anything else is not attached.
    if (String(data.pdf || "").indexOf("JVBERi0") === 0) {
      attachments.unshift(Utilities.newBlob(Utilities.base64Decode(String(data.pdf)), "application/pdf", name + ".pdf"));
    }
    MailApp.sendEmail({
      to: RESULTS_TO,
      subject: "[Poomsae Q&A review] " + reviewer + ": " + rated.length + " of " + Number(data.total || 0) + " rated",
      body: body,
      attachments: attachments,
    });
    return reply({ ok: true });
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

// A spreadsheet must not run a note as a formula.
function cell(value) {
  let text = String(value === null || value === undefined ? "" : value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
