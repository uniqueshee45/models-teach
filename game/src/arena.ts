/**
 * World 4, the arena: read the miss (DESIGN-arena.md). The rules, with no drawing in them. The screen (arenaview.tsx)
 * and check.ts both run this, in the same fixed ticks, so what the check prints is what the player gets.
 *
 *   the dial   one model at the effort levels that both the tester (stats.ts, EFFORT) and figure B (MISSES) publish.
 *   a job      walks at Meb from the right. As it steps onto the roof, the model takes a first try at it at the dial's
 *              level: that level's real price, and a wait that grows with its real thinking time.
 *   a try      passes as often as the tester's index says (an index of 47 passes 47 in 100). A miss is one of figure
 *              B's kinds, in that level's own mix, and puts a sign over the job. Both come off a shuffled deck per model
 *              and level, so a round shows close to the real shares.
 *   a fix      is tapped for the front job with a sign. The right one always works (a game rule); a wrong one costs
 *              the same, and the sign comes back.
 *   past you   a job that reaches Meb costs a heart. No hearts left, no fight.
 */
import {DT, money, rng, shuffle, split} from './rules';
import {EFFORT, MISSES, MODELS} from './stats';
import type {Effort, MissKind, Misses, ModelId} from './stats';

export const FIGHTERS: ModelId[] = ['opus55', 'sonnet55', 'fable51'];
/** Whose mix of misses a model's tries come in: its own where figure B counts it, Fable 5.1's otherwise (a stand-in,
 *  said on the picking screen and the numbers page). */
export const mixOf = (who: ModelId): ModelId => MISSES[who] ? who : 'fable51';
/** Seconds a try keeps the model busy on the roof. A game rule, the same for every model: the fourth root of the real
 *  thinking time (716 s is 3.6 s here, 1.4 s is 0.3 s), so the slowest levels stay playable. */
export const busyOf = (think: number) => Math.round(Math.max(.3, .8 * think ** .25 - .57) * 100) / 100;
export type Level = Effort & {mix: Misses; busy: number};
export const dialOf = (who: ModelId): Level[] => EFFORT[who]!.flatMap(e => {
  const mix = MISSES[mixOf(who)]!.find(m => m.name === e.name);
  return mix ? [{...e, mix, busy: busyOf(e.think)}] : [];});

/* ---------- the signs, and the fix for each (the video's tree) ---------- */
export type Sign = 'sloppy' | 'top' | 'guessed' | 'rule' | 'again';
export type Fix = 'effort' | 'rewrite' | 'context' | 'tag' | 'again';
export const FIXES: Fix[] = ['effort', 'rewrite', 'context', 'tag', 'again'];
export const SIGN_OF: Record<MissKind, Exclude<Sign, 'top'>> = {bug: 'sloppy', works: 'sloppy', overfit: 'sloppy', close: 'sloppy', misread: 'sloppy', fix: 'sloppy',
  reading: 'guessed', domain: 'rule', other: 'again'};
const KINDS = Object.keys(SIGN_OF) as MissKind[];
export const YOUR_S = 1;   // what writing a rewrite or adding context costs you, in seconds (a game guess)

export type Stage = {
  id: string; name: string; line: string; boss: string;
  jobs: number; gap: number; walk: number;   // how many, seconds between them, seconds to walk the roof
  hearts: number; budget: number;
  reads?: number;  // how many misses you have time to read: every fix takes one
  old?: ModelId;   // this model fights first, and the one you pick waits on the bench
};
/** The rounds. The goals are tuned by check.ts against the real numbers, never the other way round. */
export const STAGES: Stage[] = [
  {id: 'r1', name: 'ROUND 1', line: 'A calm line. Time to read every miss.', boss: 'THE LOGIN PAGE', jobs: 12, gap: 3.2, walk: 9, hearts: 5, budget: 15},
  {id: 'r2', name: 'ROUND 2', line: 'You can\'t watch every job: 11 reads, no more.', boss: 'THE HTML CLEANER', jobs: 20, gap: 2.4, walk: 7, hearts: 5, budget: 80, reads: 11},
  {id: 'r3', name: 'ROUND 3', line: 'The rush. Every job walks fast.', boss: 'THE HOTFIX', jobs: 16, gap: 1.6, walk: 3.2, hearts: 5, budget: 40},
  {id: 'r4', name: 'ROUND 4', line: 'Opus 5 starts. Yours waits on the bench.', boss: 'THE OLD PAYROLL', jobs: 16, gap: 2.2, walk: 7, hearts: 5, budget: 40, old: 'opus5'},
];
export const goalsOf = (st: Stage) => ['WIN THE FIGHT', `SPEND ${money(st.budget)} OR LESS`, 'LET NO JOB PAST YOU'];

/* ---------- the jobs ---------- */
export type Job = {
  id: number; boss: boolean; at: number; p: number;   // when it walks on, and how far it still has to go: 1 is the far edge, 0 is Meb
  st: 'soon' | 'on' | 'gone';
  miss: MissKind | null;                              // the sign over it, when its last try missed
  work: {from: number; until: number; miss: MissKind | null; lv: number; who: ModelId; back?: boolean} | null;   // a try under way, and what it will do (back: a wrong fix, bringing its sign back)
  seen: MissKind | null;                              // its first miss, kept for the result
  tries: number; signT: number; end: '' | 'ko' | 'past'; endT: number;
};
const SPACE = .1;   // jobs queue this far apart, as a share of the walk
function makeJobs(st: Stage, seed: number): Job[] {
  const q = rng(seed), list: Job[] = [];
  let t = 1.5;
  for (let i = 0; i < st.jobs; i++) {   // they come slowly at first and quicker by the end; the boss walks on last, alone
    const boss = i === st.jobs - 1;
    if (boss) t += 2;
    list.push({id: i, boss, at: t, p: 1, st: 'soon', miss: null, work: null, seen: null, tries: 0, signT: 0, end: '', endT: 0});
    t += st.gap * (.7 + .6 * q()) * (1.5 - .8 * i / (st.jobs - 1));
  }
  return list;
}

/* ---------- the sim ---------- */
export type Fight = {
  stage: Stage; seed: number; t: number; jobs: Job[];
  who: ModelId; bench: ModelId | null; lv: Level[]; dial: number;
  decks: Record<string, {cards: (MissKind | null)[]; i: number}>; roll: () => number;
  hearts: number; spent: number; ko: number; past: number; tries: number;
  reads: number; meb: number;   // the misses you still have time to read; you are writing a rewrite or context until meb
  signs: Record<Sign, number>; used: Record<Fix, number>;   // signs shown; fixes tapped
  wrong: number; wrongCost: number; wrongs: Record<string, number>;   // wrong fixes, keyed "fix>sign"
  tagT: number; end: boolean; won: boolean;
};
export type AEv = {k: 'in' | 'pass' | 'miss' | 'fix' | 'wrong' | 'tag' | 'past' | 'end'; j?: Job; x?: Fix; s?: Sign};

export function makeFight(stage: Stage, pick: ModelId, seed: number, dial = 0): Fight {
  const who = stage.old ?? pick, lv = dialOf(who);
  return {stage, seed, t: 0, jobs: makeJobs(stage, seed), who, bench: stage.old ? pick : null, lv, dial: Math.min(dial, lv.length - 1),
    decks: {}, roll: rng(seed + 77), hearts: stage.hearts, spent: 0, ko: 0, past: 0, tries: 0, reads: stage.reads ?? Infinity, meb: 0,
    signs: {sloppy: 0, top: 0, guessed: 0, rule: 0, again: 0}, used: {effort: 0, rewrite: 0, context: 0, tag: 0, again: 0},
    wrong: 0, wrongCost: 0, wrongs: {}, tagT: -1, end: false, won: false};
}
/** The next first try's outcome for this model and level: null passes. A deck holds one card per job in the round,
 *  in the real shares, so every draw of a round at one level has the same number of each miss, in its own order. */
function draw(f: Fight, who: ModelId, L: Level): MissKind | null {
  let d = f.decks[who + L.name];
  if (!d || d.i >= d.cards.length) {
    const p = L.index / 100, fail = KINDS.reduce((a, k) => a + L.mix[k], 0), n = split(f.stage.jobs, [p, ...KINDS.map(k => (1 - p) * L.mix[k] / fail)]);
    d = f.decks[who + L.name] = {cards: shuffle(n.flatMap((c, i) => Array<MissKind | null>(c).fill(i ? KINDS[i - 1] : null)), f.roll), i: 0};
  }
  return d.cards[d.i++];
}
const top = (f: Fight) => f.lv.length - 1;
/** The sign a miss shows now: SLOPPY at the top of the dial has nowhere higher to go. */
export const signOf = (f: Fight, m: MissKind): Sign => SIGN_OF[m] === 'sloppy' && f.dial >= top(f) ? 'top' : SIGN_OF[m];
export const canFix = (f: Fight, x: Fix) => f.reads > 0 && f.t >= f.meb && (x === 'effort' ? f.dial < top(f) : x === 'tag' ? !!f.bench : true);
/** The fixes that work on this sign. SLOPPY at the top with nobody on the bench has none: that job is past this model. */
export const rightOf = (f: Fight, m: MissKind): Fix[] => {const s = signOf(f, m);
  return s === 'sloppy' ? ['effort', ...(f.bench ? ['tag' as Fix] : [])] : s === 'top' ? (f.bench ? ['tag'] : []) : s === 'guessed' ? ['rewrite'] : s === 'rule' ? ['context'] : ['again'];};
/** The job a fix lands on: the nearest one with a sign over it. */
export const target = (f: Fight) => f.jobs.reduce<Job | undefined>((a, j) => j.st === 'on' && j.miss && !j.work && (!a || j.p < a.p) ? j : a, undefined);
/** Where the bench's dial lands: the same level by name, or as near the bottom as the old one was. */
const benchDial = (f: Fight, lv: Level[]) => {const i = lv.findIndex(l => l.name === f.lv[f.dial].name); return i >= 0 ? i : Math.min(f.dial, lv.length - 1);};
/** What a fix's try would cost, and who would make it. */
export const fixTry = (f: Fight, x: Fix) => {
  if (x === 'tag') {const lv = dialOf(f.bench!); return {who: f.bench!, L: lv[benchDial(f, lv)]};}
  return {who: f.who, L: f.lv[x === 'effort' ? f.dial + 1 : f.dial]};
};
function start(f: Fight, j: Job, lv: number, miss: MissKind | null, wait: number) {
  const L = f.lv[lv];
  f.spent += L.cost; f.tries++; j.tries++;
  j.work = {from: f.t + wait, until: f.t + wait + L.busy, miss, lv, who: f.who};
}
export const setDial = (f: Fight, d: number) => {f.dial = Math.max(0, Math.min(top(f), d));};

/** Tap a fix: it lands on the front job with a sign. */
export function fix(f: Fight, x: Fix): AEv[] {
  const j = target(f);
  if (f.end || !j || !canFix(f, x)) return [];
  const m = j.miss!, s = signOf(f, m), right = rightOf(f, m).includes(x), ev: AEv[] = [];
  if (x === 'tag') {const lv = dialOf(f.bench!); f.dial = benchDial(f, lv); f.who = f.bench!; f.bench = null; f.lv = lv; f.tagT = f.t; ev.push({k: 'tag'});}
  const lv = x === 'effort' ? f.dial + 1 : f.dial, write = x === 'rewrite' || x === 'context';
  f.used[x]++; f.reads--;
  if (write) f.meb = f.t + YOUR_S;
  if (!right) {f.wrong++; f.wrongCost += f.lv[lv].cost; f.wrongs[`${x}>${s}`] = (f.wrongs[`${x}>${s}`] ?? 0) + 1;}
  start(f, j, lv, right ? null : m, write ? YOUR_S : 0);
  j.work!.back = !right; j.miss = null;   // the sign comes down while it works
  ev.push({k: right ? 'fix' : 'wrong', j, x, s});
  return ev;
}

export function tick(f: Fight): AEv[] {
  if (f.end) return [];
  const ev: AEv[] = [];
  f.t += DT;
  let ahead = -9;   // they walk in the order they came, and nobody walks through the one in front
  for (const j of f.jobs) {
    if (j.st === 'soon' && j.at <= f.t) {j.st = 'on'; start(f, j, f.dial, draw(f, f.who, f.lv[f.dial]), 0); ev.push({k: 'in', j});}
    if (j.st !== 'on') continue;
    j.p = Math.max(j.p - DT / (f.stage.walk * (j.boss ? 1.5 : 1)), ahead + SPACE); ahead = j.p;
    if (j.work && f.t >= j.work.until) {
      const w = j.work; j.work = null;
      if (!w.miss) {j.st = 'gone'; j.end = 'ko'; j.endT = f.t; f.ko++; ev.push({k: 'pass', j}); continue;}
      j.miss = w.miss; j.seen ??= w.miss; j.signT = f.t; const s = signOf(f, w.miss); if (!w.back) f.signs[s]++; ev.push({k: 'miss', j, s});
    }
    if (j.p <= 0) {
      j.st = 'gone'; j.end = 'past'; j.endT = f.t; j.work = null; f.past++; f.hearts--; ahead = -9; ev.push({k: 'past', j});
      if (f.hearts <= 0) {f.end = true; ev.push({k: 'end'}); return ev;}
    }
  }
  if (f.jobs.every(j => j.st === 'gone')) {f.end = true; f.won = f.jobs[f.jobs.length - 1].end === 'ko'; ev.push({k: 'end'});}
  return ev;
}

/* ---------- playing without you (the check, and the test hook) ---------- */
/** reader: the right fix every time (the cheaper one, when two work). effort: EFFORT UP on every miss, and TAG IN or
 *  TRY AGAIN at the top. Both take `react` seconds to read a new sign and between taps, like a hand. */
export type Bot = 'reader' | 'effort';
export const REACT_S = .8;
export function makeBot(bot: Bot, react = REACT_S): (f: Fight) => Fix | null {
  let free = 0;
  return f => {
    const j = target(f);
    if (!j || f.t < Math.max(free, j.signT + react)) return null;
    let x: Fix | undefined;
    if (bot === 'effort') x = canFix(f, 'effort') ? 'effort' : f.bench ? 'tag' : 'again';
    else x = rightOf(f, j.miss!).filter(r => canFix(f, r)).sort((a, b) => fixTry(f, a).L.cost - fixTry(f, b).L.cost)[0];
    if (!x) return null;
    free = f.t + react;
    return x;
  };
}
export function play(stage: Stage, pick: ModelId, seed: number, bot: Bot, dial: number, react?: number): Fight {
  const f = makeFight(stage, pick, seed, dial), b = makeBot(bot, react);
  while (!f.end) {const x = b(f); if (x) fix(f, x); tick(f);}
  return f;
}

/* ---------- the stars, and what the result says ---------- */
export const stars = (f: Fight) => [f.won, f.won && f.spent <= f.stage.budget + 1e-9, f.won && f.past === 0];
/** h:mm:ss, or m:ss under an hour. */
export const hms = (x: number) => {const s = Math.round(x), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`;};
export const SIGN_WORD: Record<Sign, string> = {sloppy: 'SLOPPY', top: 'SLOPPY AT THE TOP', guessed: 'GUESSED WHAT YOU MEANT', rule: 'DIDN\'T KNOW YOUR RULE', again: 'IT FELL OVER'};
export const FIX_WORD: Record<Fix, string> = {effort: 'EFFORT UP', rewrite: 'REWRITE THE ASK', context: 'ADD CONTEXT', tag: 'TAG IN', again: 'TRY AGAIN'};
/** Why a fix was wrong, in one line: what the numbers say about that sign. */
export const WHY: Record<Sign, string> = {
  sloppy: 'IT UNDERSTOOD YOU AND WAS SLOPPY. MORE EFFORT BUYS CHECKING: EFFORT UP.',
  top: 'SLOPPY, AND THE DIAL IS AT THE TOP. THIS JOB IS PAST THIS MODEL: TAG IN.',
  guessed: 'MORE EFFORT MEANS MORE GUESSING ON YOUR BEHALF. SAY WHAT YOU MEAN: REWRITE THE ASK.',
  rule: 'EFFORT BARELY TOUCHES THIS. IT CAN\'T KNOW YOUR RULE UNTIL YOU TELL IT: ADD CONTEXT.',
  again: 'NOTHING TO READ IN THIS ONE. JUST TRY AGAIN.'};
const s = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : /[sx]$/.test(word) ? 'es' : 's'}`;
/** What this fight's own play shows, most costly first, then the money. */
export function resultLines(f: Fight): string[] {
  const out: [number, string][] = [], worst = Object.entries(f.wrongs).sort((a, b) => b[1] - a[1])[0];
  if (worst) {const [x, sg] = worst[0].split('>') as [Fix, Sign];
    out.push([f.wrongCost, `${s(f.wrong, 'wrong fix')}: ${money(f.wrongCost)} on tries that couldn't work. The commonest: ${FIX_WORD[x]} on ${SIGN_WORD[sg]}. ${WHY[sg]}`]);}
  if (f.past) out.push([f.past * 3, `${s(f.past, 'job')} got past you. A slow level keeps a job waiting on the model, and every miss waits on you.`]);
  if (f.signs.top && f.tagT < 0) out.push([f.signs.top, `${s(f.signs.top, 'miss')} came SLOPPY at the top of the dial, where nothing higher is left.`]);
  const lines = out.sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]);
  if (!lines.length) lines.push('Every miss got its right fix the first time.');
  return [...lines, `${f.tries} tries for ${f.jobs.length} jobs, ${money(f.spent)} in all. Misses: ${(Object.keys(SIGN_WORD) as Sign[]).filter(k => f.signs[k]).map(k => `${f.signs[k]} ${SIGN_WORD[k]}`).join(', ') || 'none'}.`];
}
/** The same round on the same draw, every miss read right, with the dial left at each level. */
export const dialRows = (st: Stage, pick: ModelId, seed: number) => dialOf(st.old ?? pick).map((L, i) => {const g = play(st, pick, seed, 'reader', i);
  return {name: L.name, spent: g.spent, past: g.past, won: g.won, stars: stars(g).filter(Boolean).length};});
/** The Claude Code move a result ends on: for the sign misread most; with none misread, for the dial (`dial0` is where
 *  it stood at the bell). The moves are the cards' own (Thariq Shihipar, "Using Claude Code: Spending your effort"). */
export function tipOf(f: Fight, dial0: number): [string, string] {
  const worst = Object.entries(f.wrongs).sort((a, b) => b[1] - a[1])[0];
  if (worst) return ({
    sloppy: ['/effort', 'The dial is /effort in Claude Code. One level up buys more checking.'],
    top: ['/model', 'At the top of the dial there is no more effort to add. Switch to a newer model.'],
    guessed: ['"interview me first"', 'Say what you mean in the ask, or have Claude ask you its questions before it starts.'],
    rule: ['CLAUDE.md', 'Write your rule there once, and every job starts with it. /init writes a first one.'],
    again: ['run it again', 'Nothing to read in that miss. The same ask, once more, is the fix.'],
  } as Record<Sign, [string, string]>)[worst[0].split('>')[1] as Sign];
  const rows = dialRows(f.stage, f.bench ?? f.who, f.seed), mine = rows[dial0], best = [...rows].sort((a, b) => b.stars - a.stars || a.spent - b.spent)[0];
  if (mine && best.stars > mine.stars) return ['/effort', `Every miss read right. This fight goes better at ${best.name[0]}${best.name.slice(1).toLowerCase()}: set the level for the job.`];
  if (f.signs.top && f.tagT < 0) return ['/model', 'Misses at the top of the dial have nothing higher left. That job needs a newer model.'];
  return ['/effort', `Anthropic's rule of thumb: ${RULE[mine?.name ?? ''] ?? 'Medium for most everyday work, High where checking and edge cases matter.'}`];
}
/** What each level is for, in the words of the arena's last card. X-HIGH has no line of its own there. */
const RULE: Record<string, string> = {LOW: 'Low is for staying in the loop: sketches and easy changes.', MEDIUM: 'Medium is for most everyday work.',
  HIGH: 'High is for where checking and edge cases matter.', MAX: 'Max is for letting it run on its own on a hard problem.'};
export const nameOf = (id: ModelId) => MODELS[id].name;
