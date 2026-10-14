/**
 * World 3, the blocks: its rules, with no drawing in them (DESIGN-blocks.md). The screen (blocksview.tsx) and
 * check.ts both run this, in the same fixed ticks, so what the check prints is what the player gets.
 *
 *   a builder  one model. It lays the tower, one block after another: a block is one coding task, at the model's
 *              real time and price per task (stats.ts). Fast mode (the Opus models): k x faster at the fast prices.
 *   a crack    some blocks are cracked inside, and you can't see which. An EASY, MEDIUM or HARD block cracks as often
 *              as the model fails the coding test's own EASY, MEDIUM or HARD tasks (stats.ts, `codesBy`).
 *              The totals are close to exact in every tower (as on the roads); where they fall is drawn fresh.
 *   a check    the one thing you do. It stops the building for a moment, then tests the unchecked blocks from the
 *              bottom up. A sound block is safe for good. A cracked one falls, with everything laid on top of it,
 *              and the builder starts on them again from nothing: a whole block's time before the first is back.
 *   the job    is done when every block of the tower has passed a check. The sun is the clock.
 */
import {DT, money, mmss, rng, shuffle, spread} from './rules';
import {hms} from './arena';
import {CODERS, MODELS} from './stats';
import type {Model, ModelId} from './stats';

export type Kind = 'easy' | 'medium' | 'hard';
/** What a block looks like, and which of the coding test's task labels it is (`codesBy` in stats.ts). */
export const KIND: Record<Kind, {word: string; i: number}> = {easy: {word: 'EASY', i: 0}, medium: {word: 'MEDIUM', i: 1}, hard: {word: 'HARD', i: 2}};
const SQUEEZE = 220;    // real seconds of work in one second of building
export const SCAN_S = .22;     // a check tests one block in this long, after the site's own wait
const WARM = 2;         // a tower starts with this many easy blocks

/* ---------- the builders: the models with a score on the coding test (Haiku 5.5 has none: stats.ts, CODE_TASKS) ---------- */
export const BUILDERS = CODERS;
export const canFast = (id: ModelId) => !!MODELS[id].fast;
const fastOf = (m: Model, fast: boolean) => fast && m.fast ? m.fast : null;
/** Seconds to lay one block, and what it costs: the tester's average task. */
export const layOf = (m: Model, fast = false) => m.taskTime / SQUEEZE / (fastOf(m, fast)?.k ?? 1);
export const costOf = (m: Model, fast = false) => m.taskCost * (fastOf(m, fast) ? m.fast!.outP / m.outP : 1);
export const realOf = (m: Model, fast = false) => m.taskTime / (fastOf(m, fast)?.k ?? 1);
/** A block of this kind cracks as often as the model fails the test's tasks of that label: a published number. */
export const crackOf = (m: Model, kind: Kind) => 1 - m.codesBy![KIND[kind].i] / 100;

/* ---------- the sites ---------- */
export type Site = {
  id: string; name: string; job: string; line: string;
  mix: [Kind, number][];   // how many blocks of each kind
  checkS: number;          // seconds a check waits before it tests anything: the tests starting up
  sunset: number; dark: number;   // seconds: the star, and the end of the day
  budget: number;
};
// The mixes lean on MEDIUM and HARD, as the test does (4 EASY tasks in 89): most builders never crack an EASY block.
// Site 1 was 4 EASY + 8 MEDIUM for $10, Haiku 4.5's budget (it left 2026-10-08). The cheapest builder is now Sonnet 5.5,
// which cracks so few of those that not checking at all could pay; 15 blocks with two HARD ones, and it never does.
export const SITES: Site[] = [
  {id: 's1', name: 'SITE 1', job: 'A SMALL TOOL', line: 'Short, and the tests are quick. The money is tight.',
    mix: [['easy', 3], ['medium', 10], ['hard', 2]], checkS: .8, sunset: 50, dark: 75, budget: 26},
  {id: 's2', name: 'SITE 2', job: 'AN APP', line: 'Twenty blocks, a few of them hard, on a fair budget.',
    mix: [['easy', 4], ['medium', 11], ['hard', 5]], checkS: 2, sunset: 74, dark: 105, budget: 42},
  {id: 's3', name: 'SITE 3', job: 'THE DEADLINE', line: 'Due today. The money is there; the time is not.',
    mix: [['easy', 2], ['medium', 8], ['hard', 10]], checkS: 1, sunset: 38, dark: 60, budget: 130},
  {id: 's4', name: 'SITE 4', job: 'THE BIG MIGRATION', line: 'Thirty blocks, many of them hard, and the tests are slow.',
    mix: [['easy', 3], ['medium', 15], ['hard', 12]], checkS: 3, sunset: 135, dark: 200, budget: 88},
];
export const blocksOf = (st: Site) => st.mix.reduce((n, [, c]) => n + c, 0);
export const goalsOf = (st: Site) => ['FINISH THE TOWER', 'BEFORE SUNSET', `SPEND ${money(st.budget)} OR LESS`];
/** The share of this site's blocks that crack, for this model. */
export const siteCrack = (st: Site, m: Model) => st.mix.reduce((a, [k, c]) => a + crackOf(m, k) * c, 0) / blocksOf(st);
/** A rule of thumb that plays every site well: check when the risk passes about a third. The bots play by it, and
 *  the result says how many of this builder's blocks that is on this site. */
export const METER = .35;
export const rhythmOf = (st: Site, m: Model) => Math.max(1, Math.round(Math.log(1 - METER) / Math.log(1 - siteCrack(st, m))));

/* ---------- the sim ---------- */
export type Blk = {kind: Kind; bad: boolean};
export type Build = {
  site: Site; who: ModelId; fast: boolean; m: Model; seed: number; t: number;
  plan: Kind[]; roll: () => number;
  cum: number; next: number;       // the chances of every block laid so far, added up; and where on that line the next crack sits (`spread`)
  tower: Blk[]; ok: number;        // the blocks laid, and how many of them, from the ground up, have passed a check
  peak: number;                    // the highest the tower has stood: a block laid under that is one being built again
  lay: number;                     // seconds into the next block
  scan: {t: number; from: number} | null;   // a check under way: seconds into it, and the height it started from
  spent: number; laid: number; lost: number; lostCost: number;   // lost: blocks that fell
  checks: number; clean: number; cracks: number; biggest: number;   // clean: checks that found nothing; biggest: the most blocks one crack took
  end: boolean; won: boolean;
};
export type BEv = {k: 'lay' | 'full' | 'check' | 'none' | 'pass' | 'crack' | 'clean' | 'end'; i?: number; n?: number};

export function makeBuild(site: Site, who: ModelId, seed: number, fast = false): Build {
  const q = rng(seed), all = shuffle(site.mix.flatMap(([k, c]) => Array<Kind>(c).fill(k)), q);
  const warm = all.filter(k => k === 'easy').slice(0, WARM), rest = [...all]; warm.forEach(k => rest.splice(rest.indexOf(k), 1));
  const roll = rng(seed * 131 + 7);
  return {site, who, fast: fast && canFast(who), m: MODELS[who], seed, t: 0, plan: [...warm, ...rest], roll, cum: 0, next: roll(),
    tower: [], ok: 0, peak: 0, lay: 0, scan: null, spent: 0, laid: 0, lost: 0, lostCost: 0, checks: 0, clean: 0, cracks: 0, biggest: 0, end: false, won: false};
}
/** The chance that at least one of the unchecked blocks is cracked. */
export const riskOf = (b: Build) => 1 - b.tower.slice(b.ok).reduce((a, x) => a * (1 - crackOf(b.m, x.kind)), 1);

/** One tick. `tap` is true on the tick you ask for a check. */
export function tick(b: Build, tap: boolean): BEv[] {
  if (b.end) return [];
  const ev: BEv[] = [], n = b.plan.length;
  b.t += DT;
  if (b.scan) {
    b.scan.t += DT;
    if (b.scan.t >= b.site.checkS + (b.ok - b.scan.from + 1) * SCAN_S) {
      if (b.tower[b.ok].bad) {
        const gone = b.tower.length - b.ok;
        b.tower.length = b.ok; b.scan = null; b.cracks++; b.lost += gone; b.lostCost += gone * costOf(b.m, b.fast); b.biggest = Math.max(b.biggest, gone);
        b.lay = 0;   // the block that was coming is dropped too, or its twin lands the moment the cracked one falls
        ev.push({k: 'crack', i: b.ok, n: gone});
      } else {
        ev.push({k: 'pass', i: b.ok++});
        if (b.ok === b.tower.length) {
          const from = b.scan.from; b.scan = null; b.clean++; ev.push({k: 'clean', n: b.ok - from});
          if (b.ok === n) {b.end = b.won = true; ev.push({k: 'end'});}
        }
      }
    }
  } else if (tap) {
    if (b.tower.length > b.ok) {b.scan = {t: 0, from: b.ok}; b.checks++; ev.push({k: 'check'});} else ev.push({k: 'none'});
  } else if (b.tower.length < n) {
    b.lay += DT;
    if (b.lay >= layOf(b.m, b.fast)) {
      const kind = b.plan[b.tower.length], bad = spread(b, crackOf(b.m, kind));   // not a coin per block: rules.ts
      b.lay = 0; b.tower.push({kind, bad}); b.laid++; b.spent += costOf(b.m, b.fast); b.peak = Math.max(b.peak, b.tower.length);
      ev.push({k: 'lay', i: b.tower.length - 1});
      if (b.tower.length === n) ev.push({k: 'full'});
    }
  }
  if (!b.end && b.t >= b.site.dark) {b.end = true; ev.push({k: 'end'});}
  return ev;
}

/* ---------- playing without you (the check, the test hook, and the "typical" numbers on the cards) ---------- */
/** meter: a check when the risk passes METER, as a person watching the meter would. each: after every block.
 *  never: only once the tower is up. A number: after that many blocks. Each takes REACT_S to tap, like a hand. */
export type Bot = 'meter' | 'each' | 'never' | number;
const REACT_S = .3;
export function makeBot(bot: Bot): (b: Build) => boolean {
  let due = -1;
  return b => {
    if (b.scan) {due = -1; return false;}
    const open = b.tower.length - b.ok, up = b.tower.length === b.plan.length;
    if (!open || !(up || (bot === 'meter' ? riskOf(b) >= METER : bot === 'each' ? true : bot === 'never' ? false : open >= bot))) return false;
    if (due < 0) due = b.t + REACT_S;
    if (b.t < due) return false;
    due = -1; return true;
  };
}
export function play(site: Site, who: ModelId, seed: number, bot: Bot, fast = false): Build {
  const b = makeBuild(site, who, seed, fast), f = makeBot(bot);
  while (!b.end) tick(b, f(b));
  return b;
}
/** What this builder usually does on this site, checked by the meter: the middle of TRIES towers. */
const TRIES = 21, usual = new Map<string, {t: number; spent: number; won: number}>();
export function usualOf(site: Site, who: ModelId, fast = false) {
  const key = `${site.id}.${who}.${fast}`;
  if (!usual.has(key)) {
    const runs = [...Array(TRIES)].map((_, i) => play(site, who, 1000 + i, 'meter', fast)), mid = (f: (b: Build) => number) => runs.map(f).sort((a, b) => a - b)[TRIES >> 1];
    usual.set(key, {t: mid(b => b.won ? b.t : site.dark), spent: mid(b => b.spent), won: runs.filter(b => b.won).length / TRIES});
  }
  return usual.get(key)!;
}

/* ---------- the stars, and what the result says ---------- */
export const stars = (b: Build) => [b.won, b.won && b.t <= b.site.sunset + 1e-9, b.won && b.spent <= b.site.budget + 1e-9];
const s = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export function resultLines(b: Build): string[] {
  const n = b.plan.length, m = b.m, every = b.checks ? b.laid / b.checks : 0, best = rhythmOf(b.site, m), one = Math.round(1 / siteCrack(b.site, m));
  const lines = [b.lost ? `${s(b.laid, 'block')} laid for a tower of ${n}: ${b.lost} fell, ${money(b.lostCost)} of work. The biggest fall took ${s(b.biggest, 'block')}.`
    : `${s(b.laid, 'block')} laid for a tower of ${n}, and none fell.`];
  if (b.checks) lines.push(`You checked ${s(b.checks, 'time')}: once every ${every.toFixed(1)} blocks. On this site ${m.name} cracks about 1 block in ${one}, so the risk passes a third after about ${s(best, 'block')}.`
    + (every < best - 1.2 ? ` You checked more often than it needs, and each check stops the building for ${b.site.checkS} s.` : every > best + 1.2 ? ' You let more stack up than that, and a crack takes down everything above it.' : ''));
  if (!b.won) lines.push(`Night fell with ${b.ok} of ${n} blocks checked. A block that hasn't passed a check doesn't count.`);
  return [...lines, `In real life: ${s(b.laid, 'task')} at ${mmss(realOf(m, b.fast))} each is ${hms(b.laid * realOf(m, b.fast))} of the model working, for ${money(b.spent)}.`];
}
