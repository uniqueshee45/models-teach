/**
 * World 2, the front desk: its rules, with no drawing in them (DESIGN-desk.md). The screen (deskview.tsx) and check.ts
 * both run this, in the same fixed ticks, so what the check prints is what the player gets.
 *
 *   a customer   one job, and patience: an email, or a coding ticket of one kind of work (software, science, ML,
 *                operations, hardware, security or media: the coding test's own seven, stats.ts KINDS).
 *   a desk       one worker per model, one job at a time. A job takes the model's real seconds, squeezed, and costs
 *                its real dollars: the same formulas as the rally (rules.ts). A ticket is one task of the coding
 *                test, at the test's own time and cost.
 *   the answer   a ticket comes back right as often as the model does the coding test's tasks of that kind (stats.ts,
 *                `code.by`): the sign under a desk is a published number. No worker is best at every kind, and the
 *                small one is a bargain at two. It always says "done"; a wrong one is found at once (a game rule).
 *   questions    (no day uses them since 2026-10-02: the knowledge test publishes no score by difficulty, so their
 *                EASY / MEDIUM / HARD was the game's own split.) Every question has a hidden difficulty and a worker
 *                gets right the easiest share that it scores; what it doesn't know comes back "not sure" or wrong.
 *   "not sure"   comes back to the counter: send it to another desk, or let Meb tell the customer so.
 *   the till     a right answer pays its fee and a tip; the tip is bigger the sooner you sent the customer, and grows
 *                with every right answer in a row. A wrong answer pays nothing and ends the run: the desk's price is
 *                spent all the same. A walk-out ends the run too. "Not sure" does neither. The day's score is what
 *                the till took less what the desks cost.
 */
import {DT, ROADS, money, rateOf, readOf, rng, shuffle, spread, thinkOf, writeOf} from './rules';
import type {Call, Road, RoadId} from './rules';
import {CARS, KINDS, MODELS} from './stats';
import type {Model, ModelId} from './stats';

const ROAD = Object.fromEntries(ROADS.map(r => [r.id, r])) as Record<RoadId, Road>;
/** Real seconds per game second (a game rule). Tickets are squeezed far harder: on the coding test a task is about an
 *  hour, and an email half a minute. (60 until 2026-10-08, while a ticket was the other tester's five-minute task.) */
export const SQUEEZE: Record<RoadId, number> = {inbox: 5, memory: 5, openbook: 5, tickets: 800};
export const WORD: Record<RoadId, string> = {inbox: 'EMAIL', memory: 'QUESTION', openbook: 'CONTRACT', tickets: 'TICKET'};
export const LEVEL = ['', 'EASY', 'MEDIUM', 'HARD'];
/** What a job's card says: a ticket's kind of work, a question's level, nothing more for an email. A customer's `hard`
 *  is its column on the test: 1 to 7 down KINDS for a ticket, EASY / MEDIUM / HARD for a question. */
export const labelOf = (c: {kind: RoadId; hard: number}) => c.kind === 'tickets' ? KINDS[c.hard - 1].name : c.kind === 'inbox' ? 'EMAIL' : LEVEL[c.hard];
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/* ---------- one job at one desk, from the published numbers ---------- */
export const realS = (k: RoadId, m: Model) => thinkOf(ROAD[k], m) + writeOf(ROAD[k], m);
export const costOf = (k: RoadId, m: Model) => readOf(ROAD[k], m, 0) + realS(k, m) * rateOf(ROAD[k], m);
export const gameS = (k: RoadId, m: Model) => realS(k, m) / SQUEEZE[k];
/** The share of this kind of job the worker gets right: its score on the rally's test for it. */
export const scoreOf = (k: RoadId, m: Model) => k === 'inbox' ? 1 : (k === 'memory' ? m.knows : k === 'openbook' ? m.reads : m.code.all) / 100;
/** Customers don't bring the part of a test that is past every desk (a game rule: the mix, not the scores). The best
 *  desk knows 65% of the knowledge test, so questions come from its easiest three quarters. With the whole test,
 *  HARD was the third no desk knows, and every sign read 0%. */
export const SPAN: Partial<Record<RoadId, number>> = {memory: .75};
const spanOf = (k: RoadId) => SPAN[k] ?? 1;
/** What the sign under a desk shows: how often this worker gets this job right. A ticket: its published score on the
 *  coding test's tasks of that kind. A question (the game's own split): EASY, MEDIUM and HARD are the easiest,
 *  middle and hardest third of the part customers bring, and this is the share of that third the worker knows. */
export const chanceOf = (c: {kind: RoadId; hard: number}, m: Model) => c.kind === 'inbox' ? 1 : c.kind === 'tickets' ? m.code.by[c.hard - 1] / 100
  : Math.max(0, Math.min(1, scoreOf(c.kind, m) / spanOf(c.kind) * 3 - (c.hard - 1)));

/* ---------- the till (all of it made up by the game; what a desk costs is real) ---------- */
/** What a right answer pays. A ticket: $50 (it was $3 with the old test's five-minute task). At that fee the right
 *  desk for a kind is the one that gets it right most often, except where the small one is close: Haiku 5.5 at $3
 *  is worth as much on software and ML as the desks at $13 to $17. Much lower and the cheap desk wins every kind. */
export const FEE: Record<RoadId, number> = {inbox: .06, memory: .2, openbook: .2, tickets: 50};
export const TIP = .2, RUN_MAX = 5;   // the tip: this share of the fee, times the right answers in a row (up to RUN_MAX), times the patience left
/** What a job is worth at a desk before any tip: its fee as often as the desk gets it right, less the desk's price. */
export const worth = (c: {kind: RoadId; hard: number}, m: Model) => FEE[c.kind] * chanceOf(c, m) - costOf(c.kind, m);
/** The best sign in the shop for this job, and whether a desk is well below it (a game rule: 25 points of the test). */
export const bestSign = (c: {kind: RoadId; hard: number}) => Math.max(...CARS.map(id => chanceOf(c, MODELS[id])));
export const WELL_BELOW = .25;

/* ---------- the days ---------- */
export type DayId = 'mon' | 'tue' | 'wed' | 'thu';
export type Day = {
  id: DayId; name: string; sub: string;
  jobs: [RoadId, number[]][];      // how many of each job: the tickets by kind of work, in KINDS order (a question, by level)
  gap: number; patience: number;   // seconds between customers, and how long one waits at the counter (game rules)
  stars: [number, number, number]; // the day's profit for each star
};
/** The same rules every day: only the mix and the pace change (all game rules), so every sign stays a published number.
 *  The first days bring the kinds some desk is good at (the user, 2026-10-01: "a little too hard when the right rate
 *  are quite low"): Monday ML and security, Tuesday Opus 5.5's kinds. Wednesday is the two kinds no desk gets much
 *  over half of, with security beside them: the desk that never misses one is the wrong desk for another. Thursday
 *  is all seven in the test's own mix, sooner.
 *  Software and operations alone made a day of coin flips (the best sign is 59% and 52%): on 40 draws a careful
 *  player's worst day was under a careless one's best. With security in it, and on the other three days, the careful
 *  bot's worst of 40 draws is over $100 above anything "the first free desk" or one desk alone makes.
 *  ponytail: no new rule per day; the cache and batch days of DESIGN-desk.md need their own, when they are wanted.
 *  Until 2026-10-08 the tickets were EASY / MEDIUM / HARD on the old coding test (DESIGN-desk.md has those days). */
export const DAYS: Day[] = [
  {id: 'mon', name: 'MONDAY', sub: 'ML AND SECURITY', jobs: [['inbox', [8]], ['tickets', [0, 0, 12, 0, 0, 8, 0]]], gap: 2.6, patience: 9, stars: [300, 650, 1000]},
  {id: 'tue', name: 'TUESDAY', sub: 'SCIENCE, HARDWARE, MEDIA', jobs: [['inbox', [8]], ['tickets', [0, 10, 0, 0, 6, 0, 6]]], gap: 2.6, patience: 9, stars: [150, 380, 600]},
  {id: 'wed', name: 'WEDNESDAY', sub: 'SOFTWARE, OPERATIONS, SECURITY', jobs: [['inbox', [8]], ['tickets', [10, 0, 0, 6, 0, 6, 0]]], gap: 2.6, patience: 9, stars: [200, 400, 600]},
  {id: 'thu', name: 'THURSDAY', sub: 'EVERYTHING, AND FASTER', jobs: [['inbox', [8]], ['tickets', [9, 7, 5, 4, 2, 2, 2]]], gap: 2.1, patience: 8, stars: [300, 600, 880]},
];
export const jobsOf = (d: Day) => d.jobs.reduce((n, [, k]) => n + k.reduce((a, b) => a + b, 0), 0);
/** Dollars as the shop writes them: no cents from $100 up (a day makes hundreds now that a ticket pays $50). */
export const bucks = (x: number) => x >= 100 ? `$${Math.round(x)}` : money(x);
export const goalsOf = (d: Day) => d.stars.map(x => `MAKE ${bucks(x)}`);

/* ---------- the customers ---------- */
export type Try = {id: ModelId; call: Call; cost: number};
export type Cust = {
  id: number; kind: RoadId; hard: number;
  d: number;          // hidden difficulty, 0..1: a worker scoring above it gets the job right
  pos: number;        // its place among the jobs as hard as it: decides "not sure" or wrong
  at: number; wait: number;
  st: 'soon' | 'line' | 'desk' | 'gone';
  tries: Try[]; end: '' | 'right' | 'wrong' | 'home' | 'out';
};
/** What this worker hands back for this job. The same worker always gives the same customer the same answer. */
export const answer = (c: {kind: RoadId; d: number; pos: number}, m: Model): Call => {
  if (c.d < scoreOf(c.kind, m)) return 'right';
  const g = m.guesses / 100;   // only questions from memory can come back "not sure": no other test publishes that
  return c.kind === 'memory' && Math.floor((c.pos + 1) * g) === Math.floor(c.pos * g) ? 'ask' : 'wrong';
};
function makeCusts(day: Day, seed: number): Cust[] {
  const q = rng(seed), list: Cust[] = [];
  for (const [kind, counts] of day.jobs) counts.forEach((n, t) => {   // a level's jobs are spread evenly across its third
    const place = shuffle([...Array(n).keys()], q);
    for (let i = 0; i < n; i++) list.push({id: 0, kind, hard: t + 1, d: (t + (i + .5) / n) / 3 * spanOf(kind), pos: place[i], at: 0, wait: day.patience, st: 'soon', tries: [], end: ''});
  });
  shuffle(list, q);
  let t = 1.5;
  list.forEach((c, i) => {c.id = i; c.at = t; t += day.gap * (.7 + .6 * q());});
  return list;
}

/* ---------- the sim ---------- */
export type DeskS = {
  m: Model; c: Cust | null; left: number; dur: number; cost: number; paid: number;
  jobs: number; right: number; wrong: number; ask: number; spent: number; took: number;
  said: Call | ''; saidT: number; got: number;   // its last answer, when, and what the till got for it
  cum: number; next: number; roll: () => number;   // where this desk's next wrong ticket sits (`spread` in rules.ts)
};
export type Shop = {day: Day; seed: number; t: number; custs: Cust[]; desks: DeskS[]; line: Cust[];
  spent: number; took: number; run: number; bestRun: number;   // run: right answers in a row
  right: number; wrong: number; out: number; home: number; end: boolean};
export type DEv = {k: 'in' | Call | 'out' | 'end'; c?: Cust; desk?: number};

export const makeShop = (day: Day, seed: number): Shop => ({day, seed, t: 0, custs: makeCusts(day, seed), line: [],
  desks: CARS.map((id, i) => {const roll = rng(seed * 131 + i + 7);
    return {m: MODELS[id], c: null, left: 0, dur: 0, cost: 0, paid: 0, jobs: 0, right: 0, wrong: 0, ask: 0, spent: 0, took: 0, said: '', saidT: -9, got: 0, cum: 0, next: roll(), roll};}),
  spent: 0, took: 0, run: 0, bestRun: 0, right: 0, wrong: 0, out: 0, home: 0, end: false});
export const profit = (s: Shop) => s.took - s.spent;
export const cash = (x: number) => (x <= -.005 ? '-' : '') + bucks(Math.abs(x));   // never "-$0.00"
/** A customer holding a "not sure": Meb can let them go with it. */
export const slip = (c: Cust) => c.tries.length > 0;
export const tried = (c: Cust, id: ModelId) => c.tries.some(t => t.id === id);

export function send(s: Shop, c: Cust, i: number): boolean {
  const d = s.desks[i];
  if (!d || c.st !== 'line' || d.c || tried(c, d.m.id)) return false;
  s.line.splice(s.line.indexOf(c), 1); c.st = 'desk';
  d.c = c; d.cost = costOf(c.kind, d.m); d.paid = 0; d.dur = d.left = gameS(c.kind, d.m);
  return true;
}
export function sendHome(s: Shop, c: Cust): boolean {
  if (c.st !== 'line' || !slip(c)) return false;
  s.line.splice(s.line.indexOf(c), 1); c.st = 'gone'; c.end = 'home'; s.home++;
  return true;
}
export function tick(s: Shop): DEv[] {
  if (s.end) return [];
  const ev: DEv[] = [];
  s.t += DT;
  for (const c of s.custs) if (c.st === 'soon' && c.at <= s.t) {c.st = 'line'; s.line.push(c); ev.push({k: 'in', c});}
  for (const c of [...s.line]) {
    c.wait -= DT;
    if (c.wait <= 0) {s.line.splice(s.line.indexOf(c), 1); c.st = 'gone'; c.end = 'out'; s.out++; s.run = 0; ev.push({k: 'out', c});}
  }
  s.desks.forEach((d, i) => {
    const c = d.c;
    if (!c) return;
    d.left -= DT;
    const pay = d.left > 0 ? Math.min(d.cost - d.paid, d.cost * DT / d.dur) : d.cost - d.paid;   // the coins go as it works
    d.paid += pay; d.spent += pay; s.spent += pay;
    if (d.left > 0) return;
    // a ticket: by the desk's published score for that kind, the wrong ones spread over its day, not a coin each
    const call: Call = c.kind === 'tickets' ? (spread(d, 1 - chanceOf(c, d.m)) ? 'wrong' : 'right') : answer(c, d.m);
    c.tries.push({id: d.m.id, call, cost: d.cost}); d.c = null; d.jobs++; d.said = call; d.saidT = s.t; d.got = 0;
    if (call === 'ask') {d.ask++; c.st = 'line'; c.wait = Math.max(c.wait, s.day.patience * .6); s.line.unshift(c);}   // back to the front, with time to decide
    else {
      d[call]++; s[call]++; c.st = 'gone'; c.end = call;
      const fee = FEE[c.kind];
      if (call === 'right') {s.bestRun = Math.max(s.bestRun, ++s.run); d.got = fee * (1 + TIP * Math.min(RUN_MAX, s.run) * c.wait / s.day.patience);}
      else {s.run = 0; d.got = 0;}   // nothing for a wrong one (a refund of the fee until 2026-10-08: with the best desk at 52% of a kind, every such ticket lost money, and letting the customer walk out was the best play)
      d.took += d.got; s.took += d.got;
    }
    ev.push({k: call, c, desk: i});
  });
  if (s.custs.every(c => c.st === 'gone')) {s.end = true; ev.push({k: 'end'});}
  return ev;
}

/* ---------- playing without you (the check, and the test hook) ---------- */
/** first: the front customer to the first free desk, whatever the card says. A model's id: only ever that desk.
 *  sense: reads the signs, as a player who has learned the desks would. None of them sees the hidden difficulty. */
export type Bot = 'first' | 'sense' | ModelId;
const TAP_S = .5;   // a bot takes this long between taps, like a hand
const NEAR = .1;    // sense: a sign within this many points of the best one is as good a first choice
/** The desks to try, then the ones to settle for when patience runs low. A ticket, by the signs: the desks within a
 *  few points of the best one, the one worth most first; then any other desk that is not well below the best and
 *  still makes money; never a desk well below. An email: the two that cost less than it pays and are little use for
 *  a ticket, then the third that is cheap enough. */
const WANT = (c: Cust): [ModelId[], ModelId[]] => {
  if (c.kind === 'inbox') return [['sonnet5', 'haiku55'], ['sonnet55']];
  if (c.kind !== 'tickets') return c.hard === 1 ? [['sonnet5', 'sonnet55'], ['opus5', 'opus55', 'fable51']] : c.hard === 2 ? [['sonnet55', 'opus5'], ['opus55', 'fable51']] : [['opus55', 'fable51'], ['opus5']];
  const top = bestSign(c), ch = (id: ModelId) => chanceOf(c, MODELS[id]), w = (id: ModelId) => worth(c, MODELS[id]);
  const ok = CARS.filter(id => ch(id) >= top - WELL_BELOW && w(id) > 0).sort((a, b) => w(b) - w(a));
  return [ok.filter(id => ch(id) >= top - NEAR), ok.filter(id => ch(id) < top - NEAR)];
};
export function makeBot(bot: Bot): (s: Shop) => void {
  let last = -9;
  const free = (s: Shop, c: Cust, ids: ModelId[]) => ids.map(id => CARS.indexOf(id)).find(i => !s.desks[i].c && !tried(c, CARS[i]));
  return s => {
    if (s.end || s.t - last < TAP_S) return;
    const act = (): boolean => {
      if (bot === 'first') {const c = s.line[0], i = c && free(s, c, CARS); return i !== undefined && send(s, c, i);}
      for (const c of s.line) {
        if (bot !== 'sense') {if (slip(c) ? sendHome(s, c) : send(s, c, CARS.indexOf(bot))) return true; continue;}
        if (slip(c) && c.hard === 3) return sendHome(s, c);
        const [want, settle] = WANT(c), i = free(s, c, want) ?? (c.wait < 2.5 ? free(s, c, settle) : undefined);
        if (i !== undefined) return send(s, c, i);
        if (slip(c) && c.wait < 2.5) return sendHome(s, c);
      }
      return false;
    };
    if (act()) last = s.t;
  };
}
export function play(day: Day, seed: number, bot: Bot): Shop {
  const s = makeShop(day, seed), b = makeBot(bot);
  while (!s.end) {b(s); tick(s);}
  return s;
}

/* ---------- the stars, the till's tip, and what the bill says ---------- */
/** The Claude Code move the till ends on, by what happened (Anthropic's "What a task costs on Opus 5.5", 25 Sep 2026):
 *  tickets lost at a desk well below the best one → /model; emails sent to a desk dearer than they pay → a subagent
 *  on Haiku; otherwise → /usage. */
export function tipOf(s: Shop): [string, string] {
  const tries = s.custs.flatMap(c => c.tries.map(t => ({c, t})));
  const weak = tries.filter(({c, t}) => c.kind === 'tickets' && t.call === 'wrong' && chanceOf(c, MODELS[t.id]) < bestSign(c) - WELL_BELOW).length;
  const dear = tries.filter(({c, t}) => c.kind === 'inbox' && t.cost > FEE.inbox).length;
  if (weak >= 2) return ['/model', 'The code goes to a model that gets it right. Switch to it for the code, and back after.'];
  if (dear >= 2) return ['model: haiku', 'A small job goes to a small model: put model: haiku on the subagent that does it.'];
  return ['/usage', 'See what a session has cost so far. /cost does the same.'];
}
export const dayStars = (s: Shop) => s.day.stars.map(x => s.end && profit(s) >= x - 1e-9);
/** Up to three things this day's own play shows, then the money line. */
export function billLines(s: Shop): string[] {
  const out: [number, string][] = [], tries = s.custs.flatMap(c => c.tries.map(t => ({c, t, m: MODELS[t.id]}))), all = CARS.map(id => MODELS[id]);
  const n = (k: number, word: string) => `${k} ${word}${k > 1 ? 's' : ''}`, small = (x: number) => x < .01 ? `$${x.toFixed(3)}` : money(x);   // Haiku 5.5's email is a third of a cent
  // jobs at a desk that costs more than the job pays
  for (const kind of ['inbox', 'tickets'] as RoadId[]) {
    const fee = FEE[kind], word = WORD[kind].toLowerCase();
    const cheap = [...all].sort((x, y) => costOf(kind, x) - costOf(kind, y))[0];   // only an email can cost more than it pays: every desk gets one right
    const dear = all.filter(m => costOf(kind, m) > fee).map(m => {const mine = tries.filter(x => x.c.kind === kind && x.t.id === m.id); return {m, k: mine.length, over: mine.reduce((v, x) => v + x.t.cost - fee, 0)};})
      .filter(x => x.k).sort((x, y) => y.over - x.over)[0];
    if (dear && cheap) out.push([dear.over + .5, `${n(dear.k, word)} went to ${dear.m.name}, at ${money(costOf(kind, dear.m))} each. ${kind === 'inbox' ? 'An email' : 'A ticket'} pays ${money(fee)}, and ${cheap.name} does one for ${small(costOf(kind, cheap))}.`]);
  }
  // the jobs a desk got wrong, by kind of work
  const groups = new Map<string, {m: Model; kind: RoadId; hard: number; n: number; wrong: number}>();
  for (const x of tries.filter(y => y.c.kind !== 'inbox')) {
    const key = x.t.id + x.c.kind + x.c.hard, g = groups.get(key) ?? {m: x.m, kind: x.c.kind, hard: x.c.hard, n: 0, wrong: 0};
    g.n++; if (x.t.call === 'wrong') g.wrong++; groups.set(key, g);
  }
  const worst = [...groups.values()].filter(g => g.wrong).sort((x, y) => y.wrong - x.wrong)[0];
  if (worst) {
    const ch = (m: Model) => chanceOf(worst, m), top = Math.max(...all.map(ch)), lv = labelOf(worst);
    const best = [...all].sort((x, y) => ch(y) - ch(x) || costOf(worst.kind, x) - costOf(worst.kind, y))[0];   // the best sign for it, and the cheaper desk on a tie
    out.push([worst.wrong, `${n(worst.n, `${lv} ${WORD[worst.kind].toLowerCase()}`)} went to ${worst.m.name}: ${worst.wrong} came back wrong. It gets ${pct(ch(worst.m))} of the ${lv} ones right`
      + (ch(worst.m) >= top - .05 ? ', and no desk gets many more.' : `; ${best.name} gets ${pct(ch(best))}.`)]);
  }
  if (s.out) out.push([s.out * .8, `${n(s.out, 'customer')} walked out waiting, and each one ended your streak. A desk that is free now can beat the best desk in three seconds.`]);
  const lines = out.sort((x, y) => y[0] - x[0]).slice(0, 3).map(x => x[1]);
  if (!lines.length) lines.push('Every job went to a desk that suits it.');
  return [...lines, `The till took ${cash(s.took)} and the desks cost ${money(s.spent)}: ${cash(profit(s))} made.`];
}
