/**
 * The roads' rules, with no drawing in them. The race and check.ts both run this, in the same fixed ticks, so
 * what the check prints is what the player gets. DESIGN-v3.md is the reasoning.
 *
 *   a road     forks, in stints. The model is the co-driver: before each fork it calls a lane, or says "not sure".
 *              Right, wrong or "not sure" comes from its score on this road's test: the totals are exact, and
 *              where they fall changes every race (mostly on the hard questions).
 *   a fork     two lanes are walled and one is open. The walls only show close up. Flat out on the call, or brake
 *              so you see them in time to steer: that is you checking the answer.
 *   a pit stop the model thinking, before each stint. Its length is the model's thinking time.
 *   speed      the model's writing speed. Fast mode (the Opus cars): k x faster pits and driving, at the fast prices.
 */
import {CACHE_WRITE, CARS, CODE_ALL, KINDS, MODELS} from './stats';
import type {Model, ModelId} from './stats';

export const DT = 1 / 60;       // every sim moves in these ticks
export const CRASH_S = .6;      // seconds stopped at a wall
export const NOSE = 2.4;        // metres from the middle of a car to its nose
const PIT_S = 1;                // the quickest thinker's pit stop, in seconds; the others scale from it
const LOOK_S = .6;              // a comfortable look: this long between seeing the walls and reaching them
const ACC_S = 1.2, BRAKE_S = .5;   // seconds from standstill to top speed, and from top speed to standstill
const FLOOR = .2;               // braking takes you down to this share of top speed, no lower
const LAT_S = .16;              // seconds to cross one lane
const PIT_GAP = 60;             // metres from a stint's last fork to the next pit box

export type RoadId = 'inbox' | 'memory' | 'openbook' | 'tickets';
export type Road = {
  id: RoadId; name: string; job: string; objective: string; unit: string;
  stints: number; per: number;   // pit stops, and the forks after each one
  leg: number;        // metres between forks
  forkS: number;      // seconds between forks for the pace car (PACE), flat out
  look: number;       // the share of top speed that gives a comfortable look at the walls (a game rule)
  tod: number;        // the sky: 0 day, 1 golden hour, 2 dusk
  wrongIs: string;    // what a wrong call is, on this road
  tests: string[]; source: string;
  par: number; minRight: number; maxWrong: number; budget: number;   // the three stars: seconds; its own right calls you drove through, and walls hit; dollars
  goals: [string, string, string];
};
export const ROADS: Road[] = [
  {id: 'inbox', name: 'INBOX', job: 'Answer 12 easy emails', objective: '12 EMAILS · WARM-UP', unit: 'EMAIL',
    stints: 3, per: 4, leg: 60, forkS: 1.6, look: .33, tod: 0, wrongIs: 'IT GOT THE EMAIL WRONG',
    tests: ['THINKING TIME', 'WRITING SPEED', 'PRICE'], source: "AA's speed test: read 10K tokens, think, write 500",
    par: 34, minRight: 12, maxWrong: 0, budget: .3, goals: ['UNDER 0:34', 'ALL 12 RIGHT', 'UNDER $0.30']},
  {id: 'memory', name: 'FROM MEMORY', job: 'Answer 24 hard questions without looking anything up', objective: '24 QUESTIONS · TRUST OR BRAKE', unit: 'QUESTION',
    stints: 4, per: 6, leg: 60, forkS: 1.6, look: .33, tod: 2, wrongIs: 'IT MADE THAT UP',
    tests: ['WHAT IT KNOWS', 'GUESSES OR "NOT SURE"', 'THINKING TIME'], source: 'AA-Omniscience',
    par: 90, minRight: 14, maxWrong: 2, budget: 2.6, goals: ['UNDER 1:30', '14 RIGHT FROM MEMORY · MAX 2 WRONG', 'UNDER $2.60']},
  {id: 'openbook', name: 'OPEN BOOK', job: 'Read a 100-page contract, answer 24 questions', objective: '24 QUESTIONS · IT HAS THE DOCUMENT', unit: 'QUESTION',
    stints: 4, per: 6, leg: 60, forkS: 1.6, look: .33, tod: 1.5, wrongIs: 'IT MISREAD THE CONTRACT',
    tests: ['READING DOCUMENTS', 'THINKING ON LONG INPUT', 'READING PRICE'], source: "AA-LCR · AA's thinking time on a 100K-token prompt",
    par: 68, minRight: 17, maxWrong: 2, budget: 2, goals: ['UNDER 1:08', '17 RIGHT FROM THE CONTRACT · MAX 2 WRONG', 'UNDER $2.00']},
  {id: 'tickets', name: 'TICKETS', job: 'Close 16 coding tickets', objective: '16 TICKETS · IT ALWAYS SAYS DONE', unit: 'TICKET',
    // On Terminal-Bench 4.0 since 2026-10-08 (it was 2.1: 12 working of 16, under 1:04 and $25). The best car closes
    // 10 of 16 now, a task is about an hour and $3 to $26, and the pace car does a fork in 2 s: the quickest in 1.2 s
    stints: 4, per: 4, leg: 60, forkS: 2, look: .25, tod: 1, wrongIs: 'IT SAID DONE · THE TESTS FAIL',
    tests: ['RIGHT FIRST TIME', 'TIME PER TASK', 'COST PER TASK'], source: 'Terminal-Bench 4.0 (Vals): score by kind of work, time and cost per task',
    par: 60, minRight: 10, maxWrong: 2, budget: 215, goals: ['UNDER 1:00', '10 WORKING FIRST TIME · MAX 2 BROKEN', 'UNDER $215']},
];
export const forksOf = (r: Road) => r.stints * r.per;
/** The cars of a road: all six, on every road (the tickets had five while they ran on a test Haiku 5.5 was never given). */
export const carsOf = (_r: Road) => CARS;
/** How sure a coding score is, as a light: 1 green (70% and up), 2 amber (50% and up), 3 red. The desk's signs and the
 *  tickets road's forks use the same one (a game rule: the scores are the test's, the two lines are ours). */
export const lampOf = (pct: number) => pct >= 70 ? 1 : pct >= 50 ? 2 : 3;
/** A car's place among the six: the draw of where its wrong calls fall (the same on every road, whoever else drives). */
export const slotOf = (id: ModelId) => CARS.indexOf(id);

/* ---------- one answer, from the published numbers: real seconds and dollars at normal speed ---------- */
/** The prices on this road. The contract alone is 100K tokens, so with a question on top the prompt is over 100,000:
 *  a model with a long-prompt price (Haiku 5.5) pays it there. */
export const priceOf = (r: Road, m: Model) => r.id === 'openbook' && m.long ? m.long : m;
export const thinkOf = (r: Road, m: Model) => r.id === 'openbook' ? m.think100k : m.think;
/** A ticket is one task of the coding test, at the test's own time and cost per task (stats.ts, `code`). */
export const writeOf = (r: Road, m: Model) => r.id === 'tickets' ? m.code.time - m.think : 500 / m.tps;
export const rateOf = (r: Road, m: Model) => r.id === 'tickets' ? m.code.cost / m.code.time : m.tps * priceOf(r, m).outP / 1e6;   // $ per second working
/** Dollars to read the input. The contract is read again for every question: the first read writes the cache, the rest come from it. */
export const readOf = (r: Road, m: Model, k: number) => r.id === 'tickets' ? 0 : r.id === 'openbook' ? 100e3 * priceOf(r, m).inP / 1e6 * (k ? m.cache : CACHE_WRITE) : 10e3 * m.inP / 1e6;
const quickest = (r: Road, f: (m: Model) => number) => Math.min(...carsOf(r).map(id => f(MODELS[id])));
/** The pace car: it does a leg in forkS on every road, and the others in proportion to how long they write. Pinned to
 *  one car (it was "the fastest writer on the road" until 2026-10-08) so that every other car's lap stays where its
 *  goals were set when a quicker writer arrives: Haiku 5.5 writes 1.7 times as fast, and drives that much faster. */
const PACE = MODELS.sonnet55;
/** Top speed in metres per second. */
export const topOf = (r: Road, m: Model) => r.leg / r.forkS * writeOf(r, PACE) / writeOf(r, m);
/** A pit stop in seconds: the quickest thinker on this road takes PIT_S, the others in proportion. */
export const pitOf = (r: Road, m: Model) => PIT_S * thinkOf(r, m) / quickest(r, x => thinkOf(r, x));
/** Metres before a wall where it shows: at top speed that is too late to steer, at the road's look speed it's comfortable. */
export const revealOf = (r: Road, m: Model) => topOf(r, m) * r.look * LOOK_S;

/* ---------- where things are on the road (metres) ---------- */
const stintLen = (r: Road) => r.per * r.leg + PIT_GAP;
export const pitD = (r: Road, s: number) => 3 + s * stintLen(r);   // pit box s; the first is the start line, the one after the last stint is the finish
export const forkD = (r: Road, k: number) => pitD(r, Math.floor(k / r.per)) + (k % r.per + 1) * r.leg;
export const wallD = (r: Road, k: number) => forkD(r, k) + 3;
export const lenOf = (r: Road) => pitD(r, r.stints);

/* ---------- the plan: the questions, and what the model calls at each ---------- */
export type Call = 'right' | 'ask' | 'wrong';
/** hard: 1 easy, 2, 3 hard. On the tickets a fork has a kind of work (`kind`, an index into KINDS), and `hard` is this
 *  car's light for that kind (lampOf): the same ticket is a safe one for one car and a risky one for another. */
export type Plan = {calls: Call[]; truth: number[]; lit: (number | null)[]; hard: number[]; kind: number[]};
/** n split by shares, whole numbers that add up to n (largest remainder; a tie goes to the earlier share). */
export function split(n: number, shares: number[]) {
  const raw = shares.map(s => s * n), base = raw.map(Math.floor);
  const rem = raw.map((x, i) => Math.round((x - base[i]) * 1e9) / 1e9);
  const left = n - base.reduce((a, b) => a + b, 0);
  rem.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, left).forEach(([, i]) => base[i]++);
  return base;
}
export const rng = (seed: number) => {let s = (seed * 7919 + 13) % 2147483646 + 1; const f = () => (s = (s * 16807) % 2147483647) / 2147483647; f(); f(); f(); return f;};
export const shuffle = <T>(a: T[], rnd: () => number) => {for (let i = a.length - 1; i > 0; i--) {const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];} return a;};
/** Does this one go wrong, at chance p? Not a coin each time: one is drawn somewhere in every stretch whose chances
 *  add up to 1. Each still goes wrong with its own chance, and the share that does stays close to the real number
 *  instead of swinging with luck. (The blocks' cracks and the front desk's tickets.) */
export function spread(s: {cum: number; next: number; roll: () => number}, p: number) {
  const bad = s.cum + p >= s.next;
  while (s.next <= s.cum + p) s.next = Math.floor(s.next) + 1 + s.roll();
  s.cum += p;
  return bad;
}
/** Counts of right / "not sure" / wrong calls on this road, from the model's score on this road's test. */
export function counts(r: Road, m: Model): [number, number, number] {
  const n = forksOf(r);
  if (r.id === 'inbox') return [n, 0, 0];
  if (r.id === 'memory') {const a = m.knows / 100, g = m.guesses / 100; return split(n, [a, (1 - a) * (1 - g), (1 - a) * g]) as [number, number, number];}
  const p = (r.id === 'openbook' ? m.reads : m.code.all) / 100;
  return split(n, [p, 0, 1 - p]) as [number, number, number];
}
export function planOf(r: Road, m: Model, seed: number): Plan {
  const n = forksOf(r), q = rng(seed), mine = rng(seed * 31 + slotOf(m.id) + 1);
  // the coding test publishes its score by kind of work, so the tickets take the test's own mix of kinds and its misses
  const real = r.id === 'tickets';
  // the questions: the same for every car in a race
  const kind = real ? shuffle(split(n, KINDS.map(k => k.tasks / CODE_ALL)).flatMap((c, i) => Array<number>(c).fill(i)), q) : [];
  const hard = r.id === 'inbox' ? Array(n).fill(1) : real ? kind.map(k => lampOf(m.code.by[k])) : shuffle([...Array(n)].map((_, i) => 1 + i % 3), q);
  const truth = [...Array(n)].map(() => Math.floor(q() * 3) - 1);
  const [a, b] = counts(r, m);
  const calls: Call[] = Array(n).fill('right');
  if (real) {   // the wrong ones: shared out over the kinds as the model's published misses in each kind are
    const by = KINDS.map((_, l) => shuffle([...Array(n).keys()].filter(i => kind[i] === l), mine)), w = by.map((ix, l) => ix.length * (1 - m.code.by[l] / 100));
    const sum = w.reduce((x, y) => x + y, 0) || 1;
    split(n - a, w.map(x => x / sum)).forEach((c, l) => by[l].slice(0, c).forEach(i => {calls[i] = 'wrong';}));
  } else {
    // the published share right, drawn so the easy questions come first and the hard ones are where it goes wrong
    // (a game rule: the knowledge and document tests don't publish a score by difficulty)
    const order = [...Array(n).keys()].map(i => [i, -Math.log(mine()) * [1, 3, 9][hard[i] - 1]]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
    shuffle(order.slice(a), mine).forEach((i, j) => {calls[i] = j < b ? 'ask' : 'wrong';});
  }
  return {calls, truth, hard, kind, lit: calls.map((c, i) => c === 'ask' ? null : c === 'right' ? truth[i] : (truth[i] + 2 + Math.floor(mine() * 2)) % 3 - 1)};
}

/* ---------- the sim ---------- */
export type Mark = '' | 'right' | 'caught' | 'wrong';   // through on its call; through although its call was wrong or "not sure"; into a wall
export type Phase = 'pit' | 'drive' | 'crash' | 'end';
export type Sim = {
  m: Model; road: Road; plan: Plan; n: number;
  stint: number; k: number;               // the stint it's in, and the fork ahead (n once past the last)
  phase: Phase; left: number;             // seconds left in the pit or at the wall
  d: number; v: number; x: number; lane: number;   // metres, metres per second, where it is across the road (-1..1), the lane it steers to
  t: number; spent: number; real: number; thinking: number;   // race seconds, dollars, the model's real seconds and how many of them it thought
  nitro: boolean; braking: boolean;
  marks: Mark[]; took: number[];          // per fork: how it went, and the lane the car was in
  right: number; wrong: number; caught: number; streak: number;
  end: '' | 'done';
};
export type Ev = {k: 'pit' | 'go' | 'done' | Exclude<Mark, ''>; i: number};
export type Input = {lane: number; brake: boolean; nitro: boolean};

export function makeSim(id: ModelId, r: Road, seed: number): Sim {
  const m = MODELS[id], n = forksOf(r);
  return {m, road: r, plan: planOf(r, m, seed), n, stint: 0, k: 0, phase: 'pit', left: pitOf(r, m), d: pitD(r, 0), v: 0, x: 0, lane: 0,
    t: 0, spent: 0, real: 0, thinking: 0, nitro: false, braking: false, marks: Array(n).fill(''), took: Array(n).fill(0),
    right: 0, wrong: 0, caught: 0, streak: 0, end: ''};
}
export function tick(s: Sim, inp: Input): Ev[] {
  if (s.end) return [];
  const ev: Ev[] = [], r = s.road, m = s.m, f = inp.nitro && m.fast ? m.fast : null, kf = f ? f.k : 1, price = f ? f.outP / m.outP : 1;
  const top = topOf(r, m), rate = rateOf(r, m);
  s.t += DT; s.lane = inp.lane; s.x += Math.max(-DT / LAT_S, Math.min(DT / LAT_S, s.lane - s.x));
  s.nitro = !!f && s.phase !== 'crash'; s.braking = inp.brake && s.phase === 'drive';
  if (s.phase === 'pit') {   // thinking, for every fork of the stint ahead
    const u = Math.min(s.left, DT * kf) / pitOf(r, m), th = r.per * thinkOf(r, m);
    let read = 0; for (let j = 0; j < r.per; j++) read += readOf(r, m, s.stint * r.per + j);
    s.spent += u * (read + th * rate) * price; s.real += u * th / kf; s.thinking += u * th / kf;
    s.left -= DT * kf;
    if (s.left <= 0) {s.phase = 'drive'; ev.push({k: 'go', i: s.stint});}
    return ev;
  }
  if (s.phase === 'crash') {s.left -= DT; if (s.left <= 0) s.phase = 'drive'; return ev;}
  const acc = top / ACC_S * kf, dec = top / BRAKE_S, target = inp.brake ? top * FLOOR : top * kf;
  s.v = s.v < target ? Math.min(target, s.v + acc * DT) : Math.max(target, s.v - dec * DT);
  const stop = pitD(r, s.stint + 1), last = s.stint === r.stints - 1;
  if (!last) s.v = Math.min(s.v, Math.sqrt(2 * dec * Math.max(0, stop - s.d)) + 1);   // it brakes itself into the pit box
  const was = s.d; s.d = Math.min(stop, s.d + s.v * DT);
  const hit = s.k < s.n ? wallD(r, s.k) - NOSE : Infinity;
  if (s.d >= hit) {   // the fork: is the car in the open lane?
    const k = s.k, at = Math.round(s.x);
    s.took[k] = at; s.k++;
    if (at === s.plan.truth[k]) {const mk = s.plan.calls[k] === 'right' ? 'right' : 'caught'; s.marks[k] = mk; s.right++; s.streak++; if (mk === 'caught') s.caught++; ev.push({k: mk, i: k});}
    else {s.marks[k] = 'wrong'; s.wrong++; s.streak = 0; s.d = hit; s.v = 0; s.phase = 'crash'; s.left = CRASH_S; ev.push({k: 'wrong', i: k});}
  }
  const share = (s.d - was) / stintLen(r), wr = r.per * writeOf(r, m);   // writing is paid by the metre
  s.spent += share * wr * rate * price; s.real += share * wr / kf;
  if (s.d >= stop) {
    s.stint++;
    if (last) {s.end = 'done'; s.phase = 'end'; ev.push({k: 'done', i: s.k});}
    else {s.v = 0; s.phase = 'pit'; s.left = pitOf(r, m); ev.push({k: 'pit', i: s.stint});}
  }
  return ev;
}

/* ---------- driving without you ---------- */
/** trust: the model on its own (how the rivals drive): flat out on every call, and it only looks when the model
 *  says "not sure". smart: also looks at the hard questions; on the tickets, at every kind its car is not green on.
 *  careful: looks at every fork. */
export type Style = 'trust' | 'smart' | 'careful';
export function botInput(s: Sim, style: Style, fast = false): Input {
  const r = s.road, k = s.k;
  if (s.phase !== 'drive' || k >= s.n) return {lane: s.lane, brake: false, nitro: fast};
  const p = s.plan, top = topOf(r, s.m), dist = wallD(r, k) - NOSE - s.d, rev = revealOf(r, s.m), seen = dist <= rev;
  const look = p.calls[k] === 'ask' || style === 'careful' || (style === 'smart' && p.hard[k] >= (r.id === 'tickets' ? 2 : 3));
  if (!look) return {lane: p.lit[k]!, brake: false, nitro: fast};
  const slow = top * r.look, there = seen && Math.round(s.x) === p.truth[k];
  const room = (s.v * s.v - slow * slow) / (2 * top / BRAKE_S);   // metres it takes to get down to looking speed
  return {lane: seen ? p.truth[k] : p.lit[k] ?? s.lane, brake: !there && s.v > slow && dist - rev <= room + s.v * DT * 2, nitro: fast};
}
export function finish(s: Sim, style: Style = 'trust', fast = false) {while (!s.end) tick(s, botInput(s, style, fast)); return s;}
export const run = (id: ModelId, r: Road, seed: number, style: Style = 'trust', fast = false) => finish(makeSim(id, r, seed), style, fast);

/* ---------- scoring and what the results card says ---------- */
export function stars(s: Sim): [boolean, boolean, boolean] {
  const r = s.road, done = s.end === 'done';
  return [done && s.t <= r.par, done && s.right - s.caught >= r.minRight && s.wrong <= r.maxWrong, done && s.spent <= r.budget];
}
/** The most goals a bot driver earns with this car on this road, at normal speed. */
export const goalsOf = (id: ModelId, r: Road) => Math.max(...(['trust', 'smart', 'careful'] as Style[]).map(st => stars(run(id, r, 1, st)).filter(Boolean).length));
/** The rally's first card: the same two cars on two roads, and the better one changes. Car k is the one that earns
 *  all three goals on road k; check.ts fails the build the day the numbers stop saying so. */
export const SWAP: {cars: [ModelId, ModelId]; roads: [RoadId, RoadId]} = {cars: ['haiku55', 'opus55'], roads: ['inbox', 'memory']};
export const mmss = (x: number) => {const s = Math.max(0, Math.round(x)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;};
/** A real wait: the sixteen tickets are about an hour each, and "1024:00" is not a time anyone reads. */
export const wait = (x: number, mn = Math.round(x / 60)) => x < 3600 ? mmss(x) : `${Math.floor(mn / 60)} h ${String(mn % 60).padStart(2, '0')} min`;   // whole minutes first: 59.6 min is the next hour, not "60 min"
export const lap = (x: number) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;
export const money = (x: number) => `$${x.toFixed(2)}`;
export const scoreText = (s: Sim) => `${s.right} RIGHT · ${s.wrong} WRONG`;
/** What decided it: one line from the car's numbers on this road. */
export function why(s: Sim): string {
  const {m, road: r} = s, [a, b, c] = counts(r, m), n = s.n;
  if (r.id === 'inbox') return `Every car gets easy emails right. ${m.name} thinks ${m.think} s before each one and writes ${m.tps} tokens a second.`;
  if (r.id === 'memory') return `${m.name} called ${a} of ${n} right, said "not sure" on ${b}, and was sure but wrong on ${c}.`;
  if (r.id === 'openbook') return `With the contract in front of it, ${m.name} called ${a} of ${n} right. It thinks ${m.think100k} s on input that long.`;
  return `${m.name} got ${a} of ${n} tickets right first time: it finishes ${m.code.all}% of Terminal-Bench 4.0. It said "done" on all ${n}.`;
}
/** The Claude Code move a result ends on, by the star it missed first (Addy Osmani's claude.dev guides: "Getting the
 *  most out of Opus 5.5", 22 Sep 2026, and "Building with Claude Sonnet 5.5", 28 Sep 2026). */
export function raceTip(s: Sim): [string, string] {
  const [quick, right, cheap] = stars(s), m = s.m, big = m.id.startsWith('opus') || m.id === 'fable51';
  // only fast mode changes what a car's run costs (braking and walls don't), so any more than its plain run is fast mode
  const boosted = s.spent > run(m.id, s.road, 1).spent + 1e-6, pick: [string, string] = ['/model', 'Pick the car for the road: each road tests different numbers.'];
  if (!right) {   // by road: the emails are never the model's miss, and on the tickets it never says "not sure"
    if (s.road.id === 'inbox') return ['/model', 'Every model gets easy emails right: follow the light. A small job suits a small model.'];
    if (s.road.id !== 'memory' && !big) return ['/model opus', 'For the hardest work, an Opus model is the better choice. Switch back after.'];
    return s.road.id === 'tickets' ? ['CLAUDE.md', 'Name the finish line in it: "Done means the tests pass." Then "done" is checked, not just said.']
      : ['CLAUDE.md', 'Write in it: "Mark anything you couldn\'t confirm, and say where you looked." A guess then comes back as "not sure".'];
  }
  if (!cheap) return boosted ? ['/fast', 'Fast mode costs more per token. Turn it on when the wait matters, and off after.']
    : s.road.id === 'inbox' && m.id !== 'haiku55' ? ['/model haiku', 'Easy emails suit the small model: Haiku 5.5 gets them right too, for less.']
    : m.outP > MODELS.sonnet55.outP ? ['/model sonnet', 'For a well-scoped, everyday job, Sonnet 5.5 is quick and costs less.'] : pick;
  if (!quick) return m.fast && !boosted ? ['/fast', 'The same model, sooner, at more per token. Type /fast.'] : pick;
  return ['/model', 'Same road, another car: the best one changes with the job.'];
}
/** The same car on its own, as the rivals drive: what you'd get without your braking and steering. */
export function aloneLine(id: ModelId, r: Road, seed: number): string {
  const s = run(id, r, seed), m = MODELS[id];
  return `On its own, ${m.name} finishes in ${lap(s.t)} with ${s.wrong} wrong, for ${money(s.spent)}. In real life the job is ${wait(s.real)} of waiting, ${mmss(s.thinking)} of it thinking.`;
}
