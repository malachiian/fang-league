/**
 * Pure, seedable match resolution. No DOM and no canvas.
 * A drive is one clamped check so a huge favorite still gets stopped.
 */
import { TRAITS } from './data.js';

export const DRIVES = 8;
export const SUDDEN_DEATH_ROUNDS = 3;
export const CHECK_MIN = 0.24;
export const CHECK_MAX = 0.76;
const TEMP = 2.15;
const TD_ON_SUCCESS = 0.9;

export function matchRuleText() {
  return `Each of the ${DRIVES} drives is one stat check, clamped between ${Math.round(CHECK_MIN * 100)}% and ${Math.round(CHECK_MAX * 100)}%. A tie plays up to ${SUDDEN_DEATH_ROUNDS} sudden-death rounds. Each side drives once a round. An unanswered score wins; if both score, they play another round. Still level after ${SUDDEN_DEATH_ROUNDS} rounds, the draw stands.`;
}

export function makeRng(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    },
  };
}

export function hashSeed(...parts) {
  let h = 2166136261;
  const s = parts.map(String).join('|');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function traitOf(id) {
  return TRAITS[id] || TRAITS.none;
}

export function statSum(player) {
  const s = player.stats;
  return s.strength + s.speed + s.agility + s.passing;
}

export function pickLineup(players) {
  const fit = (players || []).filter((p) => !p.injury);
  if (!fit.length) return [];
  const chosen = [];
  const add = (p) => {
    if (p && !chosen.includes(p) && chosen.length < 5) chosen.push(p);
  };
  const positions = [];
  for (const p of fit) if (!positions.includes(p.position)) positions.push(p.position);
  for (const pos of positions) {
    const group = fit.filter((p) => p.position === pos);
    add(group.reduce((m, p) => (!m || statSum(p) > statSum(m) ? p : m), null));
  }
  const rest = [...fit].sort((a, b) => statSum(b) - statSum(a));
  for (const p of rest) add(p);
  return chosen;
}

export function lineupPower(players) {
  return pickLineup(players).reduce((sum, p) => sum + statSum(p), 0);
}

function average(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function bestOf(list, fn) {
  return list.reduce((m, p) => (!m || fn(p) > fn(m) ? p : m), null);
}

export function sideRatings(players, traitId) {
  const trait = traitOf(traitId);
  const lineup = pickLineup(players);
  if (!lineup.length) {
    return { lineup, thrower: null, runner: null, tackler: null, off: 0, def: 0, trait };
  }
  const line = [...lineup].sort((a, b) => b.stats.strength - a.stats.strength).slice(0, 3);
  const thrower = bestOf(lineup, (p) => p.stats.passing);
  const runner = bestOf(lineup, (p) => p.stats.speed + p.stats.agility);
  const tackler = bestOf(lineup, (p) => p.stats.strength * 0.45 + p.stats.speed * 0.55);
  const lineStr = average(line.map((p) => p.stats.strength));
  const spd = average(lineup.map((p) => p.stats.speed));
  const agi = average(lineup.map((p) => p.stats.agility));
  const bonus = trait.lineCheck * 0.55 + trait.speedCheck * 0.55;
  const off = lineStr * 0.38
    + thrower.stats.passing * 0.52
    + runner.stats.speed * 0.48
    + runner.stats.agility * 0.36
    + bonus
    - 2.4;
  const def = lineStr * 0.24
    + spd * 0.58
    + agi * 0.46
    + tackler.stats.strength * 0.1
    + bonus;
  return { lineup, thrower, runner, tackler, off, def, trait };
}

function checkChance(off, def) {
  const p = 1 / (1 + Math.exp(-(off - def) / TEMP));
  return Math.min(CHECK_MAX, Math.max(CHECK_MIN, p));
}

function clockLabel(t, duration) {
  const remain = duration <= 0 ? 0 : Math.max(0, 40 * (1 - t / duration));
  const mins = Math.floor(remain);
  const secs = Math.floor((remain - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function pickLine(rng, lines) {
  return lines[Math.floor(rng.next() * lines.length)];
}

/**
 * @param {{id:string,name:string,trait:string,players:Array}} teamA
 * @param {{id:string,name:string,trait:string,players:Array}} teamB
 * @param {number} seed
 */
export function simulateMatch(teamA, teamB, seed) {
  const rng = makeRng(seed >>> 0);
  const sides = {
    A: { id: teamA.id, name: teamA.name, trait: teamA.trait, field: pickLineup(teamA.players) },
    B: { id: teamB.id, name: teamB.name, trait: teamB.trait, field: pickLineup(teamB.players) },
  };
  const playedA = sides.A.field.map((p) => p.id);
  const playedB = sides.B.field.map((p) => p.id);
  const events = [];
  const casualties = [];
  let scoreA = 0;
  let scoreB = 0;
  let t = 0;
  let spot = 50;
  const down = new Set();
  const casCount = { A: 0, B: 0 };

  function snapshot() {
    return {
      fieldA: sides.A.field.map((p) => p.id),
      fieldB: sides.B.field.map((p) => p.id),
      down: [...down],
    };
  }

  function push(partial) {
    const dt = partial.dt ?? 1.4;
    const fromSpot = spot;
    if (typeof partial.spot === 'number') spot = partial.spot;
    const ev = {
      ...partial,
      t,
      dt,
      fromSpot,
      spot,
      scoreA,
      scoreB,
      ...snapshot(),
    };
    delete ev.spotSet;
    events.push(ev);
    t += dt;
    return ev;
  }

  if (!sides.A.field.length || !sides.B.field.length) {
    const winnerSide = sides.A.field.length ? 'A' : sides.B.field.length ? 'B' : 'draw';
    if (winnerSide === 'A') scoreA = 3;
    if (winnerSide === 'B') scoreB = 3;
    const forfeit = winnerSide === 'draw'
      ? 'Neither side can field a team. The match is void.'
      : `${sides[winnerSide].name} win by forfeit. The other bench is empty.`;
    push({ type: 'whistle', dt: 2, text: forfeit, popup: null, team: winnerSide === 'draw' ? 'A' : winnerSide, spot: 50 });
    return finish();
  }

  const first = rng.next() < 0.5 ? 'A' : 'B';
  push({
    type: 'kickoff',
    dt: 1.6,
    text: `${sides[first].name} kick off against ${sides[first === 'A' ? 'B' : 'A'].name}.`,
    popup: null,
    team: first,
    spot: 50,
    actorId: null,
    carrierId: null,
  });

  let offense = first;
  for (let d = 0; d < DRIVES; d += 1) {
    playDrive(offense, false);
    offense = offense === 'A' ? 'B' : 'A';
  }
  if (scoreA === scoreB && sides.A.field.length && sides.B.field.length) {
    const sdFirst = rng.next() < 0.5 ? 'A' : 'B';
    const sdSecond = sdFirst === 'A' ? 'B' : 'A';
    push({
      type: 'kickoff',
      dt: 1.5,
      text: `Level at full time. Sudden death — ${sides[sdFirst].name} drive first. Each side gets a drive.`,
      popup: null,
      team: sdFirst,
      spot: 50,
      carrierId: null,
    });
    for (let round = 0; round < SUDDEN_DEATH_ROUNDS && scoreA === scoreB; round += 1) {
      playDrive(sdFirst, true);
      playDrive(sdSecond, true);
    }
  }

  function playDrive(offenseSide, suddenDrive) {
    const offense = offenseSide;
    down.clear();
    const off = sides[offense];
    const defense = offense === 'A' ? 'B' : 'A';
    const def = sides[defense];
    const dir = offense === 'A' ? 1 : -1;
    const startSpot = offense === 'A' ? 30 : 70;
    spot = startSpot;

    if (!off.field.length) {
      push({
        type: 'incomplete',
        dt: 1.2,
        text: `${off.name} have nobody left standing. The drive dies.`,
        popup: null,
        team: offense,
        spot: startSpot,
      });
      return false;
    }

    const offRate = sideRatings(off.field, off.trait);
    const defRate = sideRatings(def.field.length ? def.field : off.field, def.trait);
    const defScore = def.field.length ? defRate.def : 0;
    const p = checkChance(offRate.off, defScore);
    const success = rng.next() < p;
    let outcome = 'miss';
    if (!def.field.length) outcome = 'td';
    else if (success) outcome = rng.next() < (suddenDrive ? 0.85 : TD_ON_SUCCESS) ? 'td' : 'miss';
    else outcome = rng.next() < 0.75 ? 'stuff' : 'fumble';

    const thrower = offRate.thrower;
    const runner = offRate.runner.id === thrower.id
      ? (off.field.find((pl) => pl.id !== thrower.id) || thrower)
      : offRate.runner;
    const tackler = def.field.length
      ? sideRatings(def.field, def.trait).tackler
      : null;

    push({
      type: 'snap',
      dt: 1.15,
      text: pickLine(rng, [
        `${thrower.name} takes the snap.`,
        `${thrower.name} barks the count.`,
        `The line crashes in on ${thrower.name}.`,
      ]),
      popup: null,
      team: offense,
      spot: startSpot,
      actorId: thrower.id,
      carrierId: thrower.id,
    });

    if (outcome === 'td') {
      const mid = clampSpot(startSpot + dir * (22 + rng.int(0, 10)));
      const late = clampSpot(startSpot + dir * (48 + rng.int(0, 8)));
      push({
        type: 'pass',
        dt: 1.25,
        text: pickLine(rng, [
          `${thrower.name} slings it to ${runner.name}.`,
          `${runner.name} gathers the pass in stride.`,
          `A low throw, and ${runner.name} keeps their feet.`,
        ]),
        popup: null,
        team: offense,
        spot: mid,
        actorId: thrower.id,
        targetId: runner.id,
        carrierId: runner.id,
      });
      push({
        type: 'run',
        dt: 1.35,
        text: `${runner.name} turns toward the end zone.`,
        popup: null,
        team: offense,
        spot: late,
        actorId: runner.id,
        carrierId: runner.id,
      });
      if (tackler) {
        push({
          type: 'tackle',
          dt: 1.15,
          text: `${tackler.name} winds up and dives. ${runner.name} slips it.`,
          popup: null,
          team: defense,
          spot: late,
          actorId: tackler.id,
          targetId: runner.id,
          carrierId: runner.id,
        });
      }
      if (offense === 'A') scoreA += 1;
      else scoreB += 1;
      push({
        type: 'touchdown',
        dt: 1.7,
        text: pickLine(rng, [
          `${runner.name} is in. The end zone shakes.`,
          `${runner.name} dives over the line.`,
          `${off.name} punch it in.`,
        ]),
        popup: 'TOUCHDOWN!',
        team: offense,
        spot: offense === 'A' ? 100 : 0,
        actorId: runner.id,
        carrierId: runner.id,
      });
    } else if (outcome === 'stuff' && tackler) {
      const mid = clampSpot(startSpot + dir * rng.int(6, 16));
      push({
        type: 'run',
        dt: 1.15,
        text: `${runner.name} takes the handoff.`,
        popup: null,
        team: offense,
        spot: mid,
        actorId: runner.id,
        carrierId: runner.id,
      });
      push({
        type: 'tackle',
        dt: 1.35,
        text: pickLine(rng, [
          `${tackler.name} winds up and buries ${runner.name}.`,
          `${tackler.name} meets ${runner.name} chest to chest.`,
          `A huge hit from ${tackler.name}.`,
        ]),
        popup: null,
        team: defense,
        spot: mid,
        actorId: tackler.id,
        targetId: runner.id,
        carrierId: runner.id,
      });
      down.add(runner.id);
      push({
        type: 'knockdown',
        dt: 1.05,
        text: `${runner.name} hits the turf.`,
        popup: null,
        team: defense,
        spot: clampSpot(mid - dir * 4),
        actorId: tackler.id,
        targetId: runner.id,
        carrierId: null,
      });
      maybeCasualty(defense, offense, tackler, runner);
      if (rng.next() < 0.55) {
        push({
          type: 'fumble',
          dt: 1.15,
          text: `The ball pops out of ${runner.name}'s hands.`,
          popup: 'FUMBLE!',
          team: defense,
          spot: clampSpot(mid - dir * 6),
          actorId: runner.id,
          carrierId: null,
        });
      }
    } else if (outcome === 'fumble') {
      const mid = clampSpot(startSpot + dir * rng.int(4, 12));
      push({
        type: 'pass',
        dt: 1.2,
        text: `${thrower.name}'s throw is off.`,
        popup: null,
        team: offense,
        spot: mid,
        actorId: thrower.id,
        carrierId: thrower.id,
      });
      down.add(thrower.id);
      push({
        type: 'fumble',
        dt: 1.35,
        text: pickLine(rng, [
          `${thrower.name} loses the handle.`,
          `The ball squirts loose at the line.`,
          `${def.name} fall on the loose ball.`,
        ]),
        popup: 'FUMBLE!',
        team: defense,
        spot: mid,
        actorId: thrower.id,
        carrierId: null,
      });
    } else {
      const mid = clampSpot(startSpot + dir * rng.int(4, 14));
      push({
        type: 'pass',
        dt: 1.2,
        text: pickLine(rng, [
          `${thrower.name}'s pass sails long.`,
          `${runner.name} can't hang on.`,
          `The drive stalls in the mud.`,
        ]),
        popup: null,
        team: offense,
        spot: mid,
        actorId: thrower.id,
        targetId: runner.id,
        carrierId: null,
      });
      push({
        type: 'incomplete',
        dt: 1.0,
        text: 'No score. They turn it over on downs.',
        popup: null,
        team: offense,
        spot: mid,
        carrierId: null,
      });
    }

    return outcome === 'td';
  }

  push({
    type: 'whistle',
    dt: 1.5,
    text: `Full time. ${sides.A.name} ${scoreA}, ${sides.B.name} ${scoreB}.`,
    popup: null,
    team: scoreA === scoreB ? 'A' : scoreA > scoreB ? 'A' : 'B',
    spot: 50,
    carrierId: null,
  });

  return finish();

  function maybeCasualty(defenseSide, offenseSide, tackler, carrier) {
    const offTrait = traitOf(sides[offenseSide].trait);
    const defTrait = traitOf(sides[defenseSide].trait);
    if (casCount[offenseSide] >= 2) return;
    let chanceHit = 0.1 + defTrait.injuryBonus + offTrait.injuryTaken - offTrait.injuryResist;
    chanceHit = Math.min(0.42, Math.max(0.03, chanceHit));
    if (rng.next() >= chanceHit) return;
    const matchesOut = offTrait.regen ? 1 : (rng.next() < 0.65 ? 1 : rng.next() < 0.75 ? 2 : 3);
    casCount[offenseSide] += 1;
    const idx = sides[offenseSide].field.findIndex((p) => p.id === carrier.id);
    if (idx >= 0) sides[offenseSide].field.splice(idx, 1);
    down.add(carrier.id);
    casualties.push({
      team: offenseSide,
      playerId: carrier.id,
      name: carrier.name,
      matchesOut,
      by: tackler?.name || 'a hit',
    });
    push({
      type: 'casualty',
      dt: 1.45,
      text: `${carrier.name} is carried off after a hit from ${tackler ? tackler.name : 'the pack'}.`,
      popup: 'CASUALTY!',
      team: defenseSide,
      actorId: tackler?.id || null,
      targetId: carrier.id,
      carrierId: null,
      matchesOut,
    });
  }

  function finish() {
    for (const ev of events) ev.clock = clockLabel(ev.t, t);
    const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'draw';
    return {
      seed: seed >>> 0,
      scoreA,
      scoreB,
      winner,
      casualties,
      events,
      duration: t,
      playedA,
      playedB,
    };
  }
}

function clampSpot(n) {
  return Math.max(0, Math.min(100, n));
}

if (typeof window !== 'undefined') {
  window.simulateMatch = simulateMatch;
  window.makeRng = makeRng;
}
