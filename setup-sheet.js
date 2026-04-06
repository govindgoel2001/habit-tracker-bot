const { google } = require('googleapis');
const config = require('./config');
const fs = require('fs');

// ─── CYBER THEME COLORS ───
const C = {
  bg:         { red: 0.08, green: 0.08, blue: 0.11 },    // #141419 dark bg
  bgAlt:      { red: 0.11, green: 0.11, blue: 0.15 },    // #1c1c26 alt row
  bgHeader:   { red: 0.05, green: 0.05, blue: 0.08 },    // #0d0d14 header bg
  neonGreen:  { red: 0.0,  green: 1.0,  blue: 0.65 },    // #00FFA6 neon green
  neonPurple: { red: 0.73, green: 0.33, blue: 1.0 },     // #BB55FF neon purple
  neonCyan:   { red: 0.0,  green: 0.9,  blue: 0.95 },    // #00E6F2 neon cyan
  neonPink:   { red: 1.0,  green: 0.2,  blue: 0.55 },    // #FF338C neon pink
  neonYellow: { red: 1.0,  green: 0.95, blue: 0.0 },     // #FFF200 neon yellow
  white:      { red: 0.93, green: 0.93, blue: 0.95 },     // #EDEDF2 off-white
  dimWhite:   { red: 0.55, green: 0.55, blue: 0.6 },      // #8C8C99 dim
  cellDone:   { red: 0.0,  green: 0.25, blue: 0.15 },     // dark green fill
  cellSkip:   { red: 0.3,  green: 0.05, blue: 0.1 },      // dark red fill
  weekBg:     { red: 0.12, green: 0.1,  blue: 0.2 },      // week row purple tint
  weekendBg:  { red: 0.15, green: 0.08, blue: 0.22 },     // weekend header
  border:     { red: 0.2,  green: 0.2,  blue: 0.28 },     // #333347 subtle border
  totalRow:   { red: 0.06, green: 0.12, blue: 0.1 },      // summary row bg
};

async function authorize() {
  const creds = JSON.parse(fs.readFileSync(config.GOOGLE_CREDENTIALS_PATH));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

function getDateHeaders() {
  const dates = [];
  const d = new Date(config.START_DATE);
  for (let i = 0; i < config.NUM_DAYS; i++) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

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

function getWeekNumber(date) {
  const start = new Date(config.START_DATE);
  start.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

async function setupSheet() {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = config.SPREADSHEET_ID;
  const dates = getDateHeaders();
  const numHabits = config.HABITS.length;

  // ─── ROW 1: WEEK LABELS (merged spans) ───
  const weekRow = ['', ''];  // A1, B1 empty
  dates.forEach(d => {
    const wk = getWeekNumber(d);
    // Only put label on Monday (or first day)
    if (d.getDay() === 1 || dates.indexOf(d) === 0) {
      weekRow.push(`WEEK ${wk}`);
    } else {
      weekRow.push('');
    }
  });

  // ─── ROW 2: DAY HEADERS ───
  const headerRow = ['⚡ HABIT', '📊 %'];
  dates.forEach(d => {
    const day = d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    headerRow.push(`${day}\n${dateStr}`);
  });

  // ─── ROWS 3-10: HABITS ───
  const habitRows = config.HABITS.map(h => {
    const row = [`${h.emoji} ${h.name}`, ''];
    dates.forEach(() => row.push(''));
    return row;
  });

  // ─── ROW 11: SPACER ───
  const spacerRow = ['', ''];
  dates.forEach(() => spacerRow.push(''));

  // ─── ROW 12: DAILY TOTAL ───
  const totalRow = ['🏆 DAILY SCORE', ''];
  dates.forEach(() => totalRow.push(''));

  // ─── ROW 13: STREAK COUNTER ───
  const streakRow = ['🔥 BEST STREAK', ''];
  dates.forEach(() => streakRow.push(''));

  const allRows = [weekRow, headerRow, ...habitRows, spacerRow, totalRow, streakRow];

  // Write all data
  const lastCol = colLetter(1 + config.NUM_DAYS);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${config.SHEET_NAME}!A1:${lastCol}${allRows.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });

  // ─── FORMULAS ───
  const formulaUpdates = [];
  const firstDataCol = colLetter(2); // C
  const lastDataCol = colLetter(1 + config.NUM_DAYS);

  // % done per habit (row 3 to 10, since row 1=week, row 2=header)
  for (let i = 0; i < numHabits; i++) {
    const row = i + 3;
    formulaUpdates.push({
      range: `${config.SHEET_NAME}!B${row}`,
      values: [[`=IFERROR(ROUND(COUNTIF(${firstDataCol}${row}:${lastDataCol}${row},"✅")/${config.NUM_DAYS}*100,1)&"%","0%")`]],
    });
  }

  // Daily score (row = numHabits + 4, skipping spacer)
  const dailyScoreRow = numHabits + 4;
  for (let d = 0; d < config.NUM_DAYS; d++) {
    const col = colLetter(2 + d);
    formulaUpdates.push({
      range: `${config.SHEET_NAME}!${col}${dailyScoreRow}`,
      values: [[`=IFERROR(COUNTIF(${col}3:${col}${numHabits + 2},"✅")&"/${numHabits}","")`]],
    });
  }

  // Overall % in B for daily score row
  formulaUpdates.push({
    range: `${config.SHEET_NAME}!B${dailyScoreRow}`,
    values: [[`=IFERROR(ROUND(COUNTIF(${firstDataCol}3:${lastDataCol}${numHabits+2},"✅")/(${config.NUM_DAYS}*${numHabits})*100,1)&"%","0%")`]],
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data: formulaUpdates },
  });

  // ─── FORMATTING ───
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = sheetMeta.data.sheets.find(s => s.properties.title === config.SHEET_NAME);
  const sheetId = sheet ? sheet.properties.sheetId : 0;
  const totalRows = allRows.length;
  const totalCols = 2 + config.NUM_DAYS;

  const requests = [];

  // Set entire sheet background to dark
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: totalRows + 10, startColumnIndex: 0, endColumnIndex: totalCols + 5 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.bg,
          textFormat: { foregroundColor: C.white, fontFamily: 'Roboto Mono', fontSize: 10 },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  // Freeze row 1-2 and col A-B
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 2 } },
      fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
    },
  });

  // ─── ROW 1: WEEK ROW ───
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.weekBg,
          textFormat: { bold: true, foregroundColor: C.neonPurple, fontFamily: 'Roboto Mono', fontSize: 11 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });

  // Merge week label cells
  let weekStart = 2;
  let currentWeek = getWeekNumber(dates[0]);
  for (let i = 1; i <= dates.length; i++) {
    const nextWeek = i < dates.length ? getWeekNumber(dates[i]) : -1;
    if (nextWeek !== currentWeek) {
      if (weekStart < 2 + i) {
        requests.push({
          mergeCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: weekStart, endColumnIndex: 2 + i },
            mergeType: 'MERGE_ALL',
          },
        });
      }
      weekStart = 2 + i;
      currentWeek = nextWeek;
    }
  }

  // ─── ROW 2: DATE HEADERS ───
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.bgHeader,
          textFormat: { bold: true, foregroundColor: C.neonCyan, fontFamily: 'Roboto Mono', fontSize: 9 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'WRAP',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
    },
  });

  // Row 2 height for wrapped text
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 45 },
      fields: 'pixelSize',
    },
  });

  // ─── HABIT ROWS (rows 3-10) ───
  for (let i = 0; i < numHabits; i++) {
    const rowIdx = i + 2; // 0-indexed
    const bgColor = i % 2 === 0 ? C.bg : C.bgAlt;

    // Habit name cell — neon green text
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: bgColor,
            textFormat: { bold: true, foregroundColor: C.neonGreen, fontFamily: 'Roboto Mono', fontSize: 11 },
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
      },
    });

    // % cell — neon yellow
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 1, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: bgColor,
            textFormat: { bold: true, foregroundColor: C.neonYellow, fontFamily: 'Roboto Mono', fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });

    // Data cells — alternating bg
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 2, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: bgColor,
            textFormat: { foregroundColor: C.white, fontFamily: 'Roboto Mono', fontSize: 12 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });
  }

  // ─── SPACER ROW ───
  const spacerIdx = numHabits + 2;
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: spacerIdx, endIndex: spacerIdx + 1 },
      properties: { pixelSize: 8 },
      fields: 'pixelSize',
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: spacerIdx, endRowIndex: spacerIdx + 1, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.border,
        },
      },
      fields: 'userEnteredFormat.backgroundColor',
    },
  });

  // ─── DAILY SCORE ROW ───
  const scoreIdx = numHabits + 3;
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: scoreIdx, endRowIndex: scoreIdx + 1, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.totalRow,
          textFormat: { bold: true, foregroundColor: C.neonCyan, fontFamily: 'Roboto Mono', fontSize: 10 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });

  // ─── STREAK ROW ───
  const streakIdx = numHabits + 4;
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: streakIdx, endRowIndex: streakIdx + 1, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.totalRow,
          textFormat: { bold: true, foregroundColor: C.neonPink, fontFamily: 'Roboto Mono', fontSize: 10 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });

  // ─── COLUMN WIDTHS ───
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 200 },
      fields: 'pixelSize',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 75 },
      fields: 'pixelSize',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: totalCols },
      properties: { pixelSize: 55 },
      fields: 'pixelSize',
    },
  });

  // Row heights for habit rows
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: 2 + numHabits },
      properties: { pixelSize: 32 },
      fields: 'pixelSize',
    },
  });

  // ─── CONDITIONAL FORMATTING: NEON DONE / SKIP ───
  const dataRange = { sheetId, startRowIndex: 2, endRowIndex: 2 + numHabits, startColumnIndex: 2, endColumnIndex: totalCols };

  // ✅ = dark green bg + bright green text
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [dataRange],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: '✅' }] },
          format: {
            backgroundColor: C.cellDone,
            textFormat: { foregroundColor: C.neonGreen },
          },
        },
      },
      index: 0,
    },
  });

  // ❌ = dark red bg + pink text
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [dataRange],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: '❌' }] },
          format: {
            backgroundColor: C.cellSkip,
            textFormat: { foregroundColor: C.neonPink },
          },
        },
      },
      index: 1,
    },
  });

  // ─── WEEKEND HIGHLIGHT ───
  dates.forEach((d, i) => {
    const day = d.getDay();
    if (day === 0 || day === 6) {
      // Header cell
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2 + i, endColumnIndex: 3 + i },
          cell: {
            userEnteredFormat: {
              backgroundColor: C.weekendBg,
              textFormat: { bold: true, foregroundColor: C.neonPurple, fontFamily: 'Roboto Mono', fontSize: 9 },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    }
  });

  // ─── BORDERS — subtle neon grid ───
  requests.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2 + numHabits, startColumnIndex: 0, endColumnIndex: totalCols },
      top: { style: 'SOLID', color: C.border },
      bottom: { style: 'SOLID', color: C.border },
      left: { style: 'SOLID', color: C.border },
      right: { style: 'SOLID', color: C.border },
      innerHorizontal: { style: 'SOLID', color: C.border },
      innerVertical: { style: 'SOLID', color: C.border },
    },
  });

  // Thicker border under header row
  requests.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
      bottom: { style: 'SOLID_MEDIUM', color: C.neonCyan },
    },
  });

  // Thicker border on right of col B (separator)
  requests.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 1, endColumnIndex: 2 },
      right: { style: 'SOLID_MEDIUM', color: C.neonPurple },
    },
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  // ─── CREATE DASHBOARD TAB ───
  await createDashboard(sheets, spreadsheetId, numHabits);

  console.log('');
  console.log('  ⚡ CYBERPUNK HABIT TRACKER — SETUP COMPLETE ⚡');
  console.log('');
  console.log(`  📊 Sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log('  📋 Tabs: "Habit Tracker" + "Dashboard"');
  console.log('');
}

async function createDashboard(sheets, spreadsheetId, numHabits) {
  // Add Dashboard sheet
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: 'Dashboard', gridProperties: { rowCount: 30, columnCount: 15 } },
          },
        }],
      },
    });
  } catch (e) {
    // Sheet might already exist
    if (!e.message.includes('already exists')) throw e;
  }

  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const dashSheet = sheetMeta.data.sheets.find(s => s.properties.title === 'Dashboard');
  const dashId = dashSheet.properties.sheetId;
  const trackerSheet = sheetMeta.data.sheets.find(s => s.properties.title === config.SHEET_NAME);
  const trackerId = trackerSheet.properties.sheetId;

  // Dashboard content
  const dashData = [
    ['⚡ HABIT DASHBOARD ⚡', '', '', '', '', ''],
    [''],
    ['HABIT', 'COMPLETION %', 'STATUS', '', 'OVERALL STATS', ''],
    ...config.HABITS.map((h, i) => {
      const row = i + 3; // row in tracker (1-indexed)
      return [
        `${h.emoji} ${h.name}`,
        `='Habit Tracker'!B${row}`,
        `=IF(VALUE(LEFT('Habit Tracker'!B${row},LEN('Habit Tracker'!B${row})-1))>=80,"🟢 ON FIRE",IF(VALUE(LEFT('Habit Tracker'!B${row},LEN('Habit Tracker'!B${row})-1))>=50,"🟡 DECENT","🔴 NEEDS WORK"))`,
        '',
        i === 0 ? 'Total Days' : (i === 1 ? 'Days Elapsed' : (i === 2 ? 'Overall Score' : '')),
        i === 0 ? config.NUM_DAYS : (i === 1 ? `=MAX(0,TODAY()-DATE(${config.START_DATE.getFullYear()},${config.START_DATE.getMonth()+1},${config.START_DATE.getDate()})+1)` : (i === 2 ? `='Habit Tracker'!B${numHabits + 4}` : '')),
      ];
    }),
    [''],
    ['📈 WEEKLY BREAKDOWN', '', '', '', '', ''],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Dashboard!A1:F${dashData.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: dashData },
  });

  // Format Dashboard dark theme
  const dashRequests = [];

  // Full dark background
  dashRequests.push({
    repeatCell: {
      range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 30, startColumnIndex: 0, endColumnIndex: 15 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.bg,
          textFormat: { foregroundColor: C.white, fontFamily: 'Roboto Mono', fontSize: 10 },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  // Title row
  dashRequests.push({
    repeatCell: {
      range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.bgHeader,
          textFormat: { bold: true, foregroundColor: C.neonCyan, fontFamily: 'Roboto Mono', fontSize: 16 },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  });
  dashRequests.push({
    mergeCells: {
      range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
      mergeType: 'MERGE_ALL',
    },
  });

  // Header row (row 3)
  dashRequests.push({
    repeatCell: {
      range: { sheetId: dashId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 6 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.bgHeader,
          textFormat: { bold: true, foregroundColor: C.neonPurple, fontFamily: 'Roboto Mono', fontSize: 11 },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  // Habit names in dashboard — neon green
  dashRequests.push({
    repeatCell: {
      range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 3 + numHabits, startColumnIndex: 0, endColumnIndex: 1 },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true, foregroundColor: C.neonGreen, fontFamily: 'Roboto Mono', fontSize: 11 },
        },
      },
      fields: 'userEnteredFormat.textFormat',
    },
  });

  // % column — neon yellow
  dashRequests.push({
    repeatCell: {
      range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 3 + numHabits, startColumnIndex: 1, endColumnIndex: 2 },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true, foregroundColor: C.neonYellow, fontFamily: 'Roboto Mono', fontSize: 12 },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(textFormat,horizontalAlignment)',
    },
  });

  // Stats labels — neon cyan
  dashRequests.push({
    repeatCell: {
      range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 6, startColumnIndex: 4, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          textFormat: { foregroundColor: C.neonCyan, fontFamily: 'Roboto Mono', fontSize: 10 },
        },
      },
      fields: 'userEnteredFormat.textFormat',
    },
  });

  // Stats values — neon yellow
  dashRequests.push({
    repeatCell: {
      range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 6, startColumnIndex: 5, endColumnIndex: 6 },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true, foregroundColor: C.neonYellow, fontFamily: 'Roboto Mono', fontSize: 12 },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(textFormat,horizontalAlignment)',
    },
  });

  // Column widths
  dashRequests.push({
    updateDimensionProperties: {
      range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 220 },
      fields: 'pixelSize',
    },
  });
  dashRequests.push({
    updateDimensionProperties: {
      range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 130 },
      fields: 'pixelSize',
    },
  });
  dashRequests.push({
    updateDimensionProperties: {
      range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
      properties: { pixelSize: 170 },
      fields: 'pixelSize',
    },
  });
  dashRequests.push({
    updateDimensionProperties: {
      range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
      properties: { pixelSize: 140 },
      fields: 'pixelSize',
    },
  });

  // Add a chart — habit completion bar chart
  dashRequests.push({
    addChart: {
      chart: {
        position: {
          overlayPosition: {
            anchorCell: { sheetId: dashId, rowIndex: numHabits + 5, columnIndex: 0 },
            widthPixels: 700,
            heightPixels: 350,
          },
        },
        spec: {
          title: '📊 HABIT COMPLETION %',
          titleTextFormat: { foregroundColor: C.neonCyan, fontFamily: 'Roboto Mono', fontSize: 14, bold: true },
          backgroundColor: C.bgHeader,
          basicChart: {
            chartType: 'BAR',
            legendPosition: 'NO_LEGEND',
            axis: [
              { position: 'BOTTOM_AXIS', title: 'Completion %', format: { foregroundColor: C.dimWhite, fontFamily: 'Roboto Mono' } },
              { position: 'LEFT_AXIS', title: '', format: { foregroundColor: C.dimWhite, fontFamily: 'Roboto Mono' } },
            ],
            domains: [{
              domain: { sourceRange: { sources: [{ sheetId: dashId, startRowIndex: 3, endRowIndex: 3 + numHabits, startColumnIndex: 0, endColumnIndex: 1 }] } },
            }],
            series: [{
              series: { sourceRange: { sources: [{ sheetId: dashId, startRowIndex: 3, endRowIndex: 3 + numHabits, startColumnIndex: 1, endColumnIndex: 2 }] } },
              colorStyle: { rgbColor: C.neonGreen },
            }],
          },
        },
      },
    },
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: dashRequests } });
}

setupSheet().catch(console.error);
