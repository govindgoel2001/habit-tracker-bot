const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const config = require('./config');
const { markHabit, getTodayStatus, getStreakData, getTodayColumnIndex } = require('./sheets');
const fs = require('fs');

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });

// --- STATE ---
let chatId = config.TELEGRAM_CHAT_ID;
const CHAT_ID_FILE = './chat_id.txt';

// Load saved chat ID
if (!chatId && fs.existsSync(CHAT_ID_FILE)) {
  chatId = fs.readFileSync(CHAT_ID_FILE, 'utf8').trim();
}

function saveChatId(id) {
  chatId = id;
  fs.writeFileSync(CHAT_ID_FILE, id.toString());
}

// --- NATURAL LANGUAGE MATCHING ---
function matchHabit(text) {
  const lower = text.toLowerCase().trim();

  // Try exact alias match first
  for (let i = 0; i < config.HABITS.length; i++) {
    const h = config.HABITS[i];
    for (const alias of h.aliases) {
      if (lower.includes(alias)) return i;
    }
  }

  // Fuzzy: check if any word in the habit name appears
  for (let i = 0; i < config.HABITS.length; i++) {
    const words = config.HABITS[i].name.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && lower.includes(w)) return i;
    }
  }

  return -1;
}

function isDoneIntent(text) {
  const lower = text.toLowerCase();
  const doneWords = ['done', 'complete', 'completed', 'finished', 'yes', 'did it', 'checked', 'yep', 'yup', 'did', 'gg'];
  return doneWords.some(w => lower.includes(w));
}

function isSkipIntent(text) {
  const lower = text.toLowerCase();
  const skipWords = ['skip', 'skipped', 'no', 'nope', 'missed', 'failed', 'nah', 'didnt', "didn't", 'not today'];
  return skipWords.some(w => lower.includes(w));
}

// --- COMMAND HANDLERS ---

bot.onText(/\/start/, (msg) => {
  saveChatId(msg.chat.id);
  bot.sendMessage(msg.chat.id,
    `*Welcome to your Habit Tracker!* 🎯\n\n` +
    `I'll track these habits for you:\n` +
    config.HABITS.map((h, i) => `${i + 1}. ${h.emoji} ${h.name}`).join('\n') +
    `\n\n*How to use:*\n` +
    `• Just text: \`workout done\` or \`supplements done\`\n` +
    `• To skip: \`exercise skip\` or \`no sweets nope\`\n` +
    `• Check progress: /status\n` +
    `• See streaks: /streaks\n` +
    `• View habits: /habits\n` +
    `• Today's checklist: /checklist\n\n` +
    `I'll remind you throughout the day. Let's go! 💪`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/status/, async (msg) => {
  saveChatId(msg.chat.id);
  try {
    const status = await getTodayStatus();
    if (!status) return bot.sendMessage(msg.chat.id, '⚠️ Today is outside the tracker range.');

    const lines = status.map(h => {
      const icon = h.status === '✅' ? '✅' : h.status === '❌' ? '❌' : '⬜';
      return `${icon} ${h.emoji} ${h.name}`;
    });

    const done = status.filter(h => h.status === '✅').length;
    const total = status.length;
    const pct = Math.round((done / total) * 100);

    bot.sendMessage(msg.chat.id,
      `*Today's Progress: ${done}/${total} (${pct}%)*\n\n${lines.join('\n')}`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `Error: ${e.message}`);
  }
});

bot.onText(/\/streaks/, async (msg) => {
  saveChatId(msg.chat.id);
  try {
    const streaks = await getStreakData();
    const lines = streaks.map(s => {
      const fire = s.streak >= 7 ? '🔥' : s.streak >= 3 ? '⚡' : '';
      return `${s.emoji} ${s.name}: ${s.streak} day${s.streak !== 1 ? 's' : ''} ${fire}`;
    });
    bot.sendMessage(msg.chat.id, `*Current Streaks*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `Error: ${e.message}`);
  }
});

bot.onText(/\/habits/, (msg) => {
  saveChatId(msg.chat.id);
  const lines = config.HABITS.map((h, i) =>
    `${i + 1}. ${h.emoji} ${h.name}\n   _Aliases: ${h.aliases.slice(0, 3).join(', ')}_\n   _Remind at: ${h.reminderHours.map(hr => `${hr}:00`).join(', ')}_`
  );
  bot.sendMessage(msg.chat.id, `*Your Habits*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/checklist/, async (msg) => {
  saveChatId(msg.chat.id);
  await sendChecklist(msg.chat.id);
});

// --- NATURAL LANGUAGE HANDLER ---
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  saveChatId(msg.chat.id);

  const text = msg.text;
  const habitIdx = matchHabit(text);

  if (habitIdx === -1) {
    // Check if they just said "done" referring to a pending reminder context
    bot.sendMessage(msg.chat.id,
      `🤔 Couldn't match a habit. Try:\n` +
      `• \`exercise done\`\n• \`supplements skip\`\n• \`content done\`\n\nType /habits to see all.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const habit = config.HABITS[habitIdx];
  const done = isDoneIntent(text);
  const skip = isSkipIntent(text);

  if (!done && !skip) {
    // Default to "done" if they just named the habit
    // e.g., "exercise" alone = probably confirming
    try {
      await markHabit(habitIdx, true);
      bot.sendMessage(msg.chat.id, `✅ *${habit.emoji} ${habit.name}* — marked done! Keep going! 💪`, { parse_mode: 'Markdown' });
    } catch (e) {
      bot.sendMessage(msg.chat.id, `Error updating sheet: ${e.message}`);
    }
    return;
  }

  try {
    await markHabit(habitIdx, done);
    if (done) {
      bot.sendMessage(msg.chat.id, `✅ *${habit.emoji} ${habit.name}* — done! 🎉`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, `❌ *${habit.emoji} ${habit.name}* — skipped. Tomorrow's a new day.`, { parse_mode: 'Markdown' });
    }
  } catch (e) {
    bot.sendMessage(msg.chat.id, `Error updating sheet: ${e.message}`);
  }
});

// --- REMINDER SYSTEM ---

async function sendChecklist(targetChatId) {
  try {
    const status = await getTodayStatus();
    if (!status) return;

    const pending = status.filter(h => !h.status);
    const done = status.filter(h => h.status === '✅');

    if (pending.length === 0) {
      bot.sendMessage(targetChatId, `🏆 *All habits completed today!* Perfect day! 🎉`, { parse_mode: 'Markdown' });
      return;
    }

    const lines = status.map(h => {
      if (h.status === '✅') return `✅ ~${h.name}~`;
      if (h.status === '❌') return `❌ ~${h.name}~`;
      return `⬜ ${h.emoji} ${h.name}`;
    });

    bot.sendMessage(targetChatId,
      `*Morning Checklist* ☀️\n${done.length}/${status.length} done\n\n${lines.join('\n')}\n\n_Reply with habit name + done/skip_`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('Checklist error:', e.message);
  }
}

async function sendContextReminder(targetChatId) {
  try {
    const status = await getTodayStatus();
    if (!status) return;

    const now = new Date();
    const hour = now.getHours();

    // Find habits whose reminder window includes the current hour and are not yet done
    const due = status.filter(h => {
      if (h.status) return false; // already done or skipped
      const habitConfig = config.HABITS[h.index];
      return habitConfig.reminderHours.includes(hour);
    });

    if (due.length === 0) return;

    const lines = due.map(h => `${h.emoji} ${h.name}`);
    const timeLabel = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

    bot.sendMessage(targetChatId,
      `⏰ *${timeLabel.charAt(0).toUpperCase() + timeLabel.slice(1)} reminder*\n\nTime for:\n${lines.join('\n')}\n\n_Reply: habit name + done_`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('Context reminder error:', e.message);
  }
}

async function sendUnfinishedReminder(targetChatId) {
  try {
    const status = await getTodayStatus();
    if (!status) return;

    const pending = status.filter(h => !h.status);
    if (pending.length === 0) return;

    const lines = pending.map(h => `⬜ ${h.emoji} ${h.name}`);

    bot.sendMessage(targetChatId,
      `🔔 *${pending.length} habit${pending.length > 1 ? 's' : ''} still pending*\n\n${lines.join('\n')}\n\n_Quick: just type the habit name!_`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('Unfinished reminder error:', e.message);
  }
}

// --- CRON SCHEDULES (IST = UTC+5:30) ---

// Morning checklist at 6:00 AM IST
cron.schedule('30 0 * * *', () => {
  // 6:00 AM IST = 0:30 UTC
  if (chatId) sendChecklist(chatId);
}, { timezone: config.TIMEZONE });

// Actually, node-cron supports timezone directly:
// Morning checklist at 6:00 AM
cron.schedule('0 6 * * *', () => {
  if (chatId) sendChecklist(chatId);
}, { timezone: config.TIMEZONE });

// Every 3 hours from 9 AM to 11 PM — unfinished task reminders
[9, 12, 15, 18, 21].forEach(hour => {
  cron.schedule(`0 ${hour} * * *`, () => {
    if (chatId) sendUnfinishedReminder(chatId);
  }, { timezone: config.TIMEZONE });
});

// Context-aware reminders — check every hour for habit-specific windows
cron.schedule('0 * * * *', () => {
  if (chatId) sendContextReminder(chatId);
}, { timezone: config.TIMEZONE });

// --- STARTUP ---
console.log('🤖 Habit Tracker Bot is running!');
console.log(`Tracking ${config.HABITS.length} habits over ${config.NUM_DAYS} days`);
console.log(`Timezone: ${config.TIMEZONE}`);
console.log(`Morning reminder: ${config.MORNING_REMINDER_HOUR}:00`);
console.log(`Follow-up reminders every ${config.FOLLOWUP_INTERVAL_HOURS} hours`);

if (chatId) {
  console.log(`Chat ID: ${chatId}`);
} else {
  console.log('⚠️  No chat ID yet — send /start to the bot first!');
}

if (getTodayColumnIndex() === -1) {
  console.log('⚠️  Today is outside the sheet date range. Check START_DATE in config.js');
}
