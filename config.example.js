module.exports = {
  // --- FILL THESE IN ---
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '', // auto-detected on first /start
  SPREADSHEET_ID: process.env.SPREADSHEET_ID || 'YOUR_SPREADSHEET_ID_HERE',
  GOOGLE_CREDENTIALS_PATH: './credentials.json',

  // --- TIMEZONE (change to yours) ---
  TIMEZONE: 'Asia/Kolkata',

  // --- HABITS ---
  // Each habit has: name, aliases (for natural language), and schedule window
  HABITS: [
    {
      name: 'Exercise',
      aliases: ['exercise', 'workout', 'gym', 'run', 'lift', 'training'],
      reminderHours: [18, 19],  // 6-7 PM
      emoji: '💪'
    },
    {
      name: 'Sleep (8hrs)',
      aliases: ['sleep', 'slept', 'bed', 'rest'],
      reminderHours: [22, 23],  // 10-11 PM
      emoji: '😴'
    },
    {
      name: 'Take Supplements',
      aliases: ['supplements', 'supplement', 'vitamins', 'vitamin', 'pills', 'meds'],
      reminderHours: [8, 9],  // 8-9 AM
      emoji: '💊'
    },
    {
      name: 'No Gooning',
      aliases: ['no gooning', 'gooning', 'nofap', 'semen retention', 'sr', 'clean'],
      reminderHours: [21],  // 9 PM
      emoji: '🚫'
    },
    {
      name: '10 Min Socialise',
      aliases: ['socialise', 'socialize', 'social', 'talked', 'conversation', 'chat with someone'],
      reminderHours: [14, 15],  // 2-3 PM
      emoji: '🗣️'
    },
    {
      name: 'No Sweets',
      aliases: ['no sweets', 'sweets', 'sugar', 'no sugar', 'clean eating', 'no junk'],
      reminderHours: [20],  // 8 PM
      emoji: '🍬'
    },
    {
      name: 'Make Content',
      aliases: ['content', 'create', 'post', 'video', 'reel', 'edited', 'filmed', 'recorded', 'wrote'],
      reminderHours: [11, 12],  // 11 AM - 12 PM
      emoji: '🎬'
    },
    {
      name: 'Pray / Meditate',
      aliases: ['pray', 'meditate', 'meditation', 'prayer', 'prayed', 'meditated', 'namaz', 'pooja'],
      reminderHours: [7, 8],  // 7-8 AM
      emoji: '🧘'
    }
  ],

  // --- REMINDER SCHEDULE ---
  MORNING_REMINDER_HOUR: 6,        // 6 AM
  FOLLOWUP_INTERVAL_HOURS: 3,      // every 3 hours
  LAST_REMINDER_HOUR: 23,          // stop after 11 PM

  // --- SHEET LAYOUT ---
  SHEET_NAME: 'Habit Tracker',
  START_DATE: new Date('2026-04-06'),  // change to your start date
  NUM_DAYS: 61,                        // ~2 months
};
