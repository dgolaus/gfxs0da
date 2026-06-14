// Fetches the current slot count from a Discord channel name, parses the
// "Slots: N/N" pattern (with optional emoji prefix), and writes the result
// to assets/slots.json. Triggered every ~10 minutes by GitHub Actions
// (.github/workflows/update-slots.yml), or runnable manually with:
//
//   DISCORD_BOT_TOKEN=xxx DISCORD_SLOTS_CHANNEL_ID=123 node scripts/fetch-slots.js
//
// Setup requirements (one-time, done in the Discord developer portal):
//   1. Create a Discord application + bot at:
//        https://discord.com/developers/applications
//   2. Add the bot to your server with at least "View Channel" permission
//      on the slots channel.
//   3. Add 2 secrets to the GitHub repo (Settings → Secrets and variables):
//        DISCORD_BOT_TOKEN         — the bot token from Discord
//        DISCORD_SLOTS_CHANNEL_ID  — the channel ID (right-click channel →
//                                    Copy Channel ID; needs Developer Mode
//                                    enabled in Discord settings)
//
// Channel name format expected: anything containing "Slots: N/N", where
// N/N is FILLED/TOTAL (NOT open/total). Examples from the actual channel:
//   "❌ Slots: 3/3"  → 3 commissions in progress, queue full
//   "✅ Slots: 2/3"  → 2 in progress, 1 slot open
//   "✅ Slots: 0/3"  → all 3 slots open
// The emoji prefix is decorative — parsing ignores it. The script flips
// filled/total to open/total when writing slots.json so the front-end
// (which expects `open` = available count) stays unchanged.

const fs = require('fs');
const path = require('path');

const TOKEN      = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_SLOTS_CHANNEL_ID;
const OUT_PATH   = path.join(__dirname, '..', 'assets', 'slots.json');

if (!TOKEN || !CHANNEL_ID) {
  console.error('Missing env vars: DISCORD_BOT_TOKEN and/or DISCORD_SLOTS_CHANNEL_ID');
  process.exit(1);
}

async function fetchChannelName() {
  const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}`, {
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'User-Agent': 'gfxs0da-slots-sync (https://gfxs0da.com)',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.name) throw new Error('Channel response missing .name');
  return data.name;
}

// Matches "slots" followed by 2 numbers separated by ANY non-digit chars.
// Tolerant of every channel-name style Discord allows (free-form voice /
// category names like "❌ Slots: 3/3", or kebab-case "slots-3-3").
//
// IMPORTANT: the channel name convention is FILLED/TOTAL.
//   - "❌ Slots: 3/3"  → 3 in progress, 3 total  → 0 open (full)
//   - "✅ Slots: 2/3"  → 2 in progress, 3 total  → 1 open
//   - "✅ Slots: 0/3"  → all 3 open
// We invert: open = total - filled when writing slots.json so the front-end
// (which expects `open` = "slots available") doesn't have to change.
const SLOTS_REGEX = /slots[^\d]*(\d+)[^\d]+(\d+)/i;

// A channel name containing the word "closed" (any casing, e.g.
// "🔒 Commissions Closed", "Slots: CLOSED") means commissions are not being
// accepted at all — a distinct state from "queue full" (0 open but still
// taking waitlist). Checked BEFORE number parsing so a closed channel with
// no "N/N" doesn't throw.
const CLOSED_REGEX = /closed/i;

function parseSlots(name) {
  const m = name.match(SLOTS_REGEX);
  if (!m) throw new Error(`Could not parse "Slots: N/N" from channel name: "${name}"`);
  const filled = parseInt(m[1], 10);
  const total  = parseInt(m[2], 10);
  if (!isFinite(filled) || !isFinite(total) || total <= 0 || filled > total || filled < 0) {
    throw new Error(`Invalid slot values: filled=${filled}, total=${total}`);
  }
  const open = total - filled;
  return { open, total, filled };
}

async function main() {
  const name = await fetchChannelName();
  console.log(`Channel name: "${name}"`);

  // Preserve etaHoursMin/etaHoursMax from the existing file — those are
  // human-editable, not driven by Discord.
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  } catch (_) { /* first run / file missing — fine */ }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const base = {
    etaHoursMin: existing.etaHoursMin ?? 24,
    etaHoursMax: existing.etaHoursMax ?? 48,
    updatedAt:   today,
    note:        'Auto-updated from Discord channel name by .github/workflows/update-slots.yml. Rename the channel to include "closed" to close commissions; use "Slots: N/N" to reopen. Edit etaHoursMin/etaHoursMax manually here when needed.',
  };

  let out;
  if (CLOSED_REGEX.test(name)) {
    // Commissions closed — keep the last known total so the page can still
    // show "0 of 3" but flagged closed.
    const total = existing.total ?? 3;
    console.log(`Channel marked CLOSED → commissions closed (total ${total})`);
    out = { closed: true, open: 0, total, ...base };
  } else {
    const { open, total, filled } = parseSlots(name);
    console.log(`Parsed: ${filled}/${total} filled → ${open} open`);
    out = { closed: false, open, total, ...base };
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('fetch-slots failed:', err.message);
  process.exit(1);
});
