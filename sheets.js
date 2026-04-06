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

module.exports = { markHabit, getTodayStatus, getStreakData, getTodayColumnIndex };
