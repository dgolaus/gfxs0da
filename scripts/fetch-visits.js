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

const GAMES = [
  { key: 'apocalypse',  placeId: '90148635862803'  }, // Survive the Apocalypse
  { key: 'prospecting', placeId: '129827112113663' }, // Prospecting
  { key: 'parkour',     placeId: '75034791252172'  }, // Parkour for Brainrots
  { key: 'restaurant',  placeId: '77843161404023'  }, // Run a Restaurant
  { key: 'burgerz',     placeId: '99817148924004'  }, // Burgerz
];

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
      const v = info.creator?.hasVerifiedBadge ? '✓' : ' ';
      console.log(
        `  ${game.key.padEnd(12)} ${info.visits.toLocaleString().padStart(14)} visits  ·  by ${info.creator?.name || '?'} ${v}`
      );
    } catch (e) {
      console.error(`  ${game.key.padEnd(12)} FAILED: ${e.message}`);
      // Don't abort — keep going so other games still update
    }
  }

  const outPath = path.join('assets', 'visits.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
})();
