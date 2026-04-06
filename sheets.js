const { google } = require('googleapis');
const config = require('./config');
const fs = require('fs');

let sheetsClient = null;

function colLetter(idx) {
  let s = '';
  idx++;
  while (idx > 0) {
    idx--;
    s = String.fromCharCode(65 + (idx % 26)) + s;
    idx = Math.floor(idx / 26);
  }
  return s;
}

async function getSheets() {
  if (sheetsClient) return sheetsClient;
  const creds = JSON.parse(fs.readFileSync(config.GOOGLE_CREDENTIALS_PATH));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: client });
  return sheetsClient;
}

function getTodayColumnIndex() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(config.START_DATE);
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays >= config.NUM_DAYS) return -1;
  return diffDays + 2; // +2 because col 0 = habit name, col 1 = %, data starts at col 2
}

async function markHabit(habitIndex, done) {
  const sheets = await getSheets();
  const colIdx = getTodayColumnIndex();
  if (colIdx === -1) throw new Error('Today is outside the tracker date range.');

  const col = colLetter(colIdx);
  const row = habitIndex + 3; // row 1 = week, row 2 = header, habits start at row 3
  const cell = `${config.SHEET_NAME}!${col}${row}`;
  const value = done ? '✅' : '❌';

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.SPREADSHEET_ID,
    range: cell,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });

  return value;
}

async function getTodayStatus() {
  const sheets = await getSheets();
  const colIdx = getTodayColumnIndex();
  if (colIdx === -1) return null;

  const col = colLetter(colIdx);
  const numHabits = config.HABITS.length;
  const range = `${config.SHEET_NAME}!${col}3:${col}${numHabits + 2}`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.SPREADSHEET_ID,
    range,
  });

  const values = res.data.values || [];
  return config.HABITS.map((h, i) => ({
    ...h,
    index: i,
    status: (values[i] && values[i][0]) || '',
  }));
}

async function getStreakData() {
  const sheets = await getSheets();
  const numHabits = config.HABITS.length;
  const colIdx = getTodayColumnIndex();
  if (colIdx === -1) return [];

  // Read all data from start to today
  const startCol = colLetter(2);
  const endCol = colLetter(colIdx);
  const range = `${config.SHEET_NAME}!${startCol}3:${endCol}${numHabits + 2}`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.SPREADSHEET_ID,
    range,
  });

  const values = res.data.values || [];
  return config.HABITS.map((h, i) => {
    const row = values[i] || [];
    let streak = 0;
    for (let j = row.length - 1; j >= 0; j--) {
      if (row[j] === '✅') streak++;
      else break;
    }
    return { name: h.name, emoji: h.emoji, streak };
  });
}

async function getSheetId() {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: config.SPREADSHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === config.SHEET_NAME);
  return sheet ? sheet.properties.sheetId : 0;
}

async function addHabitRow(habit, index) {
  const sheets = await getSheets();
  const sheetId = await getSheetId();
  const rowIndex = index + 2; // 0-indexed: row 0 = week, row 1 = header, habits start at row 2

  // Insert a new row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.SPREADSHEET_ID,
    requestBody: {
      requests: [{
        insertDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          inheritFromBefore: true,
        },
      }],
    },
  });

  // Write the habit name and % formula
  const lastDataCol = colLetter(1 + config.NUM_DAYS);
  const row = rowIndex + 1; // 1-indexed for A1 notation
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${config.SHEET_NAME}!A${row}`, values: [[`${habit.emoji} ${habit.name}`]] },
        { range: `${config.SHEET_NAME}!B${row}`, values: [[`=IFERROR(ROUND(COUNTIF(C${row}:${lastDataCol}${row},"✅")/${config.NUM_DAYS}*100,1)&"%","0%")`]] },
      ],
    },
  });
}

async function removeHabitRow(index) {
  const sheets = await getSheets();
  const sheetId = await getSheetId();
  const rowIndex = index + 2; // 0-indexed: row 0 = week, row 1 = header

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    },
  });
}

module.exports = { markHabit, getTodayStatus, getStreakData, getTodayColumnIndex, addHabitRow, removeHabitRow };
