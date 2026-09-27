// Fetches live Roblox visit counts for the games shown in the portfolio,
// and writes assets/visits.json. Triggered hourly by GitHub Actions
// (.github/workflows/update-visits.yml), or runnable manually with:
//
//   node scripts/fetch-visits.js
//
// Roblox API flow per game:
//   placeId -> apis.roblox.com/universes/v1/places/<id>/universe -> universeId
//   universeId -> games.roblox.com/v1/games?universeIds=<id> -> { visits, playing, ... }

const fs = require('fs');
const path = require('path');

// Every game that has ever had a portfolio card. Games stay on this list
// after they leave the grid: their visits keep counting toward the total,
// they just stop being shown.
//
// baseVisits is what the game had the day it entered tracking, and `since`
// is that day. Only growth ON TOP of baseVisits is credited, because the
// BASELINE below already covers everything up to 2026-05-03. Without this
// the pre-tracking visits would be counted twice.
const GAMES = [
  { key: 'apocalypse',  placeId: '90148635862803'  , baseVisits: 105127114, since: '2026-05-09' }, // Survive the Apocalypse
  { key: 'prospecting', placeId: '129827112113663' , baseVisits: 227061196, since: '2026-05-09' }, // Prospecting
  { key: 'parkour',     placeId: '75034791252172'  , baseVisits:  47005232, since: '2026-05-09' }, // Parkour for Brainrots (off the grid)
  { key: 'aura',        placeId: '77393318863643'  , baseVisits:  83317257, since: '2026-05-09' }, // Aura Ascension (off the grid)
  { key: 'fishing',     placeId: '113489516847696' , baseVisits: 216116713, since: '2026-05-09' }, // My Fishing Brainrots (off the grid)
  { key: 'restaurant',  placeId: '77843161404023'  , baseVisits:  23526525, since: '2026-06-10' }, // Run a Restaurant
  { key: 'burgerz',     placeId: '99817148924004'  , baseVisits:  49945795, since: '2026-06-10' }, // Burgerz (off the grid)
  { key: 'gag2',        placeId: '97598239454123'  , baseVisits:  10528225, since: '2026-06-12' }, // Grow a Garden 2
  { key: 'divaz',       placeId: '88323040672117'  , baseVisits:  42675747, since: '2026-08-10' }, // Divaz
  { key: 'rideapet',    placeId: '124216119978534' , baseVisits:  56029417, since: '2026-09-20' }, // Ride A Pet
];

// Career total the user confirmed on 2026-05-03, covering every commission
// up to that date. Growth measured since then is added on top.
const BASELINE = 2_300_000_000;

async function getUniverseId(placeId) {
  const r = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  if (!r.ok) throw new Error(`universe lookup ${placeId}: HTTP ${r.status}`);
  const data = await r.json();
  if (!data.universeId) throw new Error(`universe lookup ${placeId}: empty universeId`);
  return data.universeId;
}

async function getGameInfo(universeId) {
  const r = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  if (!r.ok) throw new Error(`game info ${universeId}: HTTP ${r.status}`);
  const data = await r.json();
  if (!data.data || data.data.length === 0) {
    throw new Error(`game info ${universeId}: empty data`);
  }
  return data.data[0];
}

(async () => {
  const out = {
    updatedAt: new Date().toISOString(),
    games: {},
  };

  let growth = 0, counted = 0;
  for (const game of GAMES) {
    try {
      const universeId = await getUniverseId(game.placeId);
      const info = await getGameInfo(universeId);
      out.games[game.key] = {
        placeId: game.placeId,
        universeId,
        name: info.name,
        visits: info.visits,
        playing: info.playing,
        favorites: info.favoritedCount,
        creatorName: info.creator?.name || null,
        creatorVerified: !!info.creator?.hasVerifiedBadge,
      };
      if (typeof game.baseVisits === 'number') {
        out.games[game.key].baseVisits = game.baseVisits;
        out.games[game.key].since = game.since;
        growth += Math.max(0, info.visits - game.baseVisits);
        counted++;
      }
      const v = info.creator?.hasVerifiedBadge ? '✓' : ' ';
      console.log(
        `  ${game.key.padEnd(12)} ${info.visits.toLocaleString().padStart(14)} visits  ·  by ${info.creator?.name || '?'} ${v}`
      );
    } catch (e) {
      console.error(`  ${game.key.padEnd(12)} FAILED: ${e.message}`);
      // Don't abort — keep going so other games still update
    }
  }

  // Only publish a new total when every game answered. A partial run would
  // make the number drop, and a counter that goes down looks like a lie.
  if (counted === GAMES.length) {
    out.influenced = BASELINE + growth;
    out.influencedParts = { baseline: BASELINE, growth };
    console.log(`\nInfluenced: ${out.influenced.toLocaleString()} (baseline ${BASELINE.toLocaleString()} + growth ${growth.toLocaleString()})`);
  } else {
    const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join('assets', 'visits.json'), 'utf8')); } catch (e) { return null; } })();
    if (prev && typeof prev.influenced === 'number') {
      out.influenced = prev.influenced;
      out.influencedParts = prev.influencedParts;
      console.log(`\n${GAMES.length - counted} game(s) failed — keeping the previous influenced total.`);
    }
  }

  const outPath = path.join('assets', 'visits.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
})();
