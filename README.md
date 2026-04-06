# ⚡ Habit Tracker Bot — Cyberpunk Edition

A **Telegram bot** that tracks your daily habits and auto-updates a **Google Sheet** with a dark cyberpunk Gantt chart. No manual clicking — just text your bot "workout done" and it logs it.

![Habit Tracker](https://img.shields.io/badge/Telegram-Bot-blue?logo=telegram) ![Google Sheets](https://img.shields.io/badge/Google-Sheets-green?logo=google-sheets) ![Node.js](https://img.shields.io/badge/Node.js-24-green?logo=node.js)

---

## What You Get

### Telegram Bot
- **Natural language** — just text `workout done`, `supplements done`, `content` — no slash commands needed
- **Smart reminders** — 6 AM morning checklist, then every 3 hours for unfinished tasks
- **Context-aware** — exercise reminder at 6 PM, sleep at 10 PM, supplements at 8 AM
- **Streak tracking** — `/streaks` shows your current streaks with fire emojis
- **Fuzzy matching** — "gym", "workout", "exercise", "lift" all map to the same habit

### Google Sheet (Cyberpunk Theme)
- **2-month Gantt chart** with dark background and neon colors
- **Week row** with merged labels (WEEK 1, WEEK 2, etc.)
- **Conditional formatting** — ✅ glows neon green, ❌ glows neon pink
- **Auto-calculated** completion %, daily scores, and streaks
- **Dashboard tab** with bar charts, status indicators, and overall stats
- **Weekend highlighting** in purple
- **Roboto Mono** font throughout for that terminal aesthetic

---

## Default Habits (Customizable)

| Habit | Reminder Time | Aliases |
|---|---|---|
| 🧘 Pray / Meditate | 7-8 AM | pray, meditate, meditation, prayer |
| 💊 Take Supplements | 8-9 AM | supplements, vitamins, pills |
| 🎬 Make Content | 11 AM-12 PM | content, create, post, video, reel |
| 🗣️ 10 Min Socialise | 2-3 PM | socialise, social, talked, conversation |
| 💪 Exercise | 6-7 PM | exercise, workout, gym, run, lift |
| 🍬 No Sweets | 8 PM | no sweets, sugar, clean eating |
| 🚫 No Gooning | 9 PM | no gooning, nofap, clean |
| 😴 Sleep (8hrs) | 10-11 PM | sleep, slept, bed, rest |

---

## Setup Guide (10 minutes)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- A Google account
- Telegram account

### Step 1: Clone the Repo

```bash
git clone https://github.com/YOUR_USERNAME/habit-tracker-bot.git
cd habit-tracker-bot
npm install
```

### Step 2: Create Your Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Choose a name and username for your bot
4. Copy the **bot token** (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### Step 3: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) → create a new blank spreadsheet
2. Rename the first sheet tab to **"Habit Tracker"** (right-click tab → Rename)
3. Copy the **spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
   ```

### Step 4: Google Sheets API (Free)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "habit-tracker")
3. **Enable the Google Sheets API:**
   - Go to APIs & Services → Library
   - Search "Google Sheets API" → Enable it
4. **Create a Service Account:**
   - Go to APIs & Services → Credentials
   - Create Credentials → Service Account
   - Name it anything (e.g., "habit-bot") → Done
5. **Download the key:**
   - Click the service account you created
   - Keys tab → Add Key → Create New Key → JSON
   - Download the file and **rename it to `credentials.json`**
   - Place it in the project folder
6. **Share the Google Sheet:**
   - Open `credentials.json`, find the `client_email` field
   - In your Google Sheet, click Share → paste that email → give **Editor** access

> **Note:** Google Cloud is completely free for this. No billing required. The Sheets API has a free quota of 300 requests/minute.

### Step 5: Configure

Edit `config.js` and fill in:

```js
TELEGRAM_BOT_TOKEN: 'your-bot-token-here',
SPREADSHEET_ID: 'your-spreadsheet-id-here',
```

Optionally adjust:
- `TIMEZONE` — default is `Asia/Kolkata` (IST)
- `START_DATE` — when your tracking begins
- `NUM_DAYS` — how many days to track (default: 61)
- `HABITS` — add, remove, or modify habits

### Step 6: Setup the Sheet

```bash
npm run setup-sheet
```

This creates the cyberpunk-themed Gantt chart layout with all formatting, formulas, conditional colors, and a Dashboard tab.

### Step 7: Start the Bot

```bash
npm start
```

Then open Telegram → find your bot → send `/start`

---

## Keep It Running 24/7

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start bot.js --name habit-bot
pm2 save
```

**Auto-start on reboot:**

- **Linux/Mac:** `pm2 startup`
- **Windows:** Copy the `start-habit-bot.bat` file to your Startup folder:
  ```
  %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
  ```

### Useful PM2 Commands

| Command | Description |
|---|---|
| `pm2 status` | Check if bot is running |
| `pm2 logs habit-bot` | View bot logs |
| `pm2 restart habit-bot` | Restart the bot |
| `pm2 stop habit-bot` | Stop the bot |

---

## Usage

### Natural Language (Just Text!)

| You Type | What Happens |
|---|---|
| `workout done` | ✅ Exercise marked done |
| `supplements done` | ✅ Supplements marked done |
| `content` | ✅ Make Content marked done |
| `gym` | ✅ Exercise marked done |
| `sleep done` | ✅ Sleep marked done |
| `sweets nope` | ❌ No Sweets marked skipped |
| `exercise skip` | ❌ Exercise marked skipped |

### Bot Commands

| Command | Description |
|---|---|
| `/start` | Initialize bot & save chat ID |
| `/status` | Today's progress (done/pending) |
| `/streaks` | Current streak for each habit |
| `/habits` | List all habits with aliases |
| `/checklist` | Full daily checklist |

### Reminder Schedule

- **6:00 AM** — Full morning checklist with all 8 habits
- **Every 3 hours** (9 AM, 12 PM, 3 PM, 6 PM, 9 PM) — Only unfinished tasks
- **Context-aware** — Each habit pings at its natural time window
- Reminders stop after **11 PM**

---

## Customizing Habits

Edit the `HABITS` array in `config.js`:

```js
{
  name: 'Exercise',              // Display name on the sheet
  aliases: ['workout', 'gym'],   // Words that match this habit
  reminderHours: [18, 19],       // Context reminder window (24h format)
  emoji: '💪'                    // Emoji shown in sheet & bot
}
```

---

## Project Structure

```
habit-tracker-bot/
├── bot.js              # Telegram bot — NLP + reminders + commands
├── sheets.js           # Google Sheets read/write layer
├── setup-sheet.js      # One-time sheet formatting script
├── config.js           # All settings (habits, times, credentials)
├── credentials.json    # Google service account key (DO NOT COMMIT)
├── package.json        # Dependencies
├── start-habit-bot.bat # Windows auto-start script
└── README.md           # This file
```

---

## Tech Stack

- **Node.js** — Runtime
- **node-telegram-bot-api** — Telegram Bot API wrapper
- **googleapis** — Google Sheets API client
- **node-cron** — Scheduled reminders
- **PM2** — Process manager for 24/7 uptime

---

## Security

- Never commit `credentials.json` or your bot token
- Add `credentials.json` to `.gitignore`
- If your bot token is exposed, regenerate it via @BotFather → `/revoke`

---

## License

MIT — do whatever you want with it.

---

Built with 🧠 by [Govind Goel](https://github.com/GovindGoel16) with Claude Code
