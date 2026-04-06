# Habit Tracker Bot — Setup Guide

## Quick Overview
Telegram bot that auto-updates a Google Sheet with your daily habits. Natural language — just text "workout done" and it logs it.

---

## Step 1: Create Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Name it (e.g., "Govind's Habit Tracker")
4. Copy the **bot token** — looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
5. Paste it in `config.js` → `TELEGRAM_BOT_TOKEN`

## Step 2: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) → create a new blank spreadsheet
2. Rename the first sheet tab to **"Habit Tracker"** (must match exactly)
3. Copy the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
   ```
4. Paste it in `config.js` → `SPREADSHEET_ID`

## Step 3: Google Sheets API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **Google Sheets API**:
   - Go to APIs & Services → Library
   - Search "Google Sheets API" → Enable
4. Create a **Service Account**:
   - Go to APIs & Services → Credentials
   - Create Credentials → Service Account
   - Name it anything (e.g., "habit-tracker")
   - Skip optional steps → Done
5. Create a key:
   - Click the service account you just created
   - Keys tab → Add Key → Create New Key → JSON
   - Download the JSON file
   - **Rename it to `credentials.json`** and put it in this folder
6. **Share the Google Sheet** with the service account email:
   - Open `credentials.json`, find `client_email`
   - In Google Sheets, click Share → paste that email → Editor access

## Step 4: Install & Run

```bash
cd ~/Desktop/habit-tracker-bot
npm install
```

### First: Set up the sheet layout
```bash
npm run setup-sheet
```
This creates the 2-month Gantt layout with formatting, formulas, and conditional colors.

### Then: Start the bot
```bash
npm start
```

### Finally: Activate the bot
- Open Telegram → find your bot → send `/start`
- The bot saves your chat ID and starts sending reminders

---

## Usage

### Natural Language (just text!)
| You type | What happens |
|---|---|
| `workout done` | ✅ Exercise marked done |
| `supplements done` | ✅ Take Supplements marked done |
| `content` | ✅ Make Content marked done (just the name works) |
| `sleep done` | ✅ Sleep marked done |
| `sweets nope` | ❌ No Sweets marked skipped |
| `exercise skip` | ❌ Exercise marked skipped |

### Commands
| Command | Description |
|---|---|
| `/start` | Initialize bot + save chat ID |
| `/status` | Today's progress (done/pending) |
| `/streaks` | Current streak for each habit |
| `/habits` | List all habits with aliases |
| `/checklist` | Full daily checklist |

### Reminder Schedule
- **6:00 AM** — Full morning checklist
- **Every 3 hours** (9, 12, 3, 6, 9 PM) — Unfinished tasks only
- **Context-aware** — Exercise reminder at 6-7 PM, Sleep at 10-11 PM, etc.
- Stops after 11 PM

---

## Customizing Habits

Edit `config.js` → `HABITS` array. Each habit has:
```js
{
  name: 'Exercise',           // display name
  aliases: ['workout', 'gym'], // words that match this habit
  reminderHours: [18, 19],    // context reminder window (24h)
  emoji: '💪'                 // display emoji
}
```

---

## Keep it Running (Background)

### Option A: PM2 (recommended)
```bash
npm install -g pm2
pm2 start bot.js --name habit-bot
pm2 save
pm2 startup   # auto-start on reboot
```

### Option B: Simple background
```bash
node bot.js &
```

---

## Troubleshooting

- **"Today is outside the tracker range"** → Update `START_DATE` in config.js
- **Sheet not updating** → Check that the service account email has Editor access
- **Bot not responding** → Verify bot token, make sure `npm start` is running
- **Wrong timezone** → Change `TIMEZONE` in config.js (default: Asia/Kolkata)
