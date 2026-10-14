/**
 * Every stat in the game is a published number, and this file is the only place one is typed.
 * Checked 2026-09-30. Re-check each source before changing a number, and change the date with it.
 * Haiku 5.5 (out 2026-10-07) took Haiku 4.5's place on 2026-10-08, read that day (HAIKU_READ). Haiku 4.5 is gone from
 * the game (the user: "Do 2"). The same day the coding jobs at the front desk and on the tickets road moved to
 * Terminal-Bench 4.0 (`code`, KINDS; the user: "Build"), which has all six models. The blocks stay on the retired
 * Terminal-Bench 2.1 (`codesBy`, CODERS), which Haiku 5.5 was never run on: no world mixes the two tests.
 *
 * Cars carry the model's own name (the user's call, 2026-09-30); no logos, and the disclaimer stays
 * (README.md, "Names and the law"). Every version is its own car.
 */
export type ModelId = 'haiku55' | 'sonnet5' | 'sonnet55' | 'opus5' | 'opus55' | 'fable51';
export type Body = 'hatch' | 'sports' | 'gt' | 'classic';
/** The kinds of work Terminal-Bench 4.0 sorts its 66 tasks by, as the tester names and orders them, and how many tasks
 *  each has. The test has no EASY / MEDIUM / HARD: "4.0 tags them by domain". */
export type Kind = 'software' | 'science' | 'ml' | 'ops' | 'hardware' | 'security' | 'media';
export const KINDS: {id: Kind; name: string; tasks: number}[] = [{id: 'software', name: 'SOFTWARE', tasks: 18}, {id: 'science', name: 'SCIENCE', tasks: 14}, {id: 'ml', name: 'ML', tasks: 11},
  {id: 'ops', name: 'OPERATIONS', tasks: 9}, {id: 'hardware', name: 'HARDWARE', tasks: 5}, {id: 'security', name: 'SECURITY', tasks: 5}, {id: 'media', name: 'MEDIA', tasks: 4}];
export const CODE_ALL = KINDS.reduce((n, k) => n + k.tasks, 0);
export type Model = {
  id: ModelId;
  name: string;          // short name, on the car and every screen
  real: string;          // full name, on the numbers page
  body: Body;            // the car it drives: the family decides the body
  paint: string;         // the version decides the paint; none of them the maker's orange
  ink: string;           // the paint, light enough to read as text on the dark menus
  // Artificial Analysis (AA), each model at high effort
  tps: number;          // output tokens per second
  think: number;         // seconds to the first answer token, 10K-token prompt (AA's default test)
  think100k: number;     // the same, on a 100K-token prompt
  taskTime: number;      // seconds per task, AA Intelligence Index average
  taskCost: number;      // $ per task, AA Intelligence Index average (reading, cache and writing)
  knows: number;         // AA-Omniscience accuracy, % of questions answered right
  guesses: number;       // AA-Omniscience hallucination rate: % of the ones it didn't get right, answered wrong instead of "don't know"
  reads: number;         // AA-LCR, % right answering from documents up to 100K tokens
  // Vals, Terminal-Bench 4.0 (TB4 below): a ticket at the front desk and on the tickets road
  code: {all: number; by: number[]; cost: number; time: number};   // % of the 66 tasks done; % by kind of work, in KINDS order; $ and seconds per task
  // Vals, Terminal-Bench 2.1: the blocks only. Missing on Haiku 5.5: the tester retired the test before it came out (CODERS)
  codes?: number;       // % of tasks done
  codesBy?: [number, number, number];   // the same run, by the test's own task labels: % of the EASY, MEDIUM and HARD tasks done
  aa: string;            // its page at Artificial Analysis: AA + this
  // Anthropic
  inP: number; outP: number;                  // $ per million tokens read / written
  long?: {inP: number; outP: number};         // the same for a prompt of over 100,000 tokens, where the model has such a price (Haiku 5.5)
  cache: number;         // reading the same input again, from the cache: this share of inP
  fast?: {k: number; inP: number; outP: number};  // fast mode: speed multiplier and its prices
  prev?: ModelId;        // the version before it
  blurb: string;
};

export const MODELS: Record<ModelId, Model> = {
  haiku55: {id: 'haiku55', name: 'HAIKU 5.5', real: 'Claude Haiku 5.5', body: 'hatch', paint: '#ffe04a', ink: '#ffe04a',
    tps: 160.2, think: 28.0, think100k: 18.6, taskTime: 212.4, taskCost: .079, knows: 34.8, guesses: 44.5, reads: 77.3, aa: 'claude-haiku-5-5-high',
    code: {all: 35.35, by: [44.44, 21.43, 60.61, 18.52, 20, 40, 25], cost: 3.05, time: 3060},
    inP: .1, outP: .5, long: {inP: .5, outP: 2.5}, cache: .1, blurb: 'Small and cheap. Fastest writer, knows the least.'},
  sonnet5: {id: 'sonnet5', name: 'SONNET 5', real: 'Claude Sonnet 5', body: 'sports', paint: '#8fb0f5', ink: '#a9c2f8',
    tps: 65.0, think: 11.3, think100k: 31.9, taskTime: 410.8, taskCost: 1.792, knows: 37.4, guesses: 65.7, reads: 76.7, codes: 74.5, codesBy: [100, 81.82, 57.78], aa: 'claude-sonnet-5-high',
    code: {all: 9.60, by: [11.11, 11.90, 12.12, 11.11, 0, 0, 8.33], cost: 26.33, time: 6300},
    inP: 2, outP: 10, cache: .1, blurb: 'The last Sonnet. Quick to start, wordy, guesses a lot.'},
  sonnet55: {id: 'sonnet55', name: 'SONNET 5.5', real: 'Claude Sonnet 5.5', body: 'sports', paint: '#3d6ff2', ink: '#7fa0ff',
    tps: 93.2, think: 13.1, think100k: 12.3, taskTime: 225.7, taskCost: 1.080, knows: 52.0, guesses: 64.6, reads: 78.0, codes: 83.1, codesBy: [91.67, 86.06, 76.67], aa: 'claude-sonnet-5-5-high',
    code: {all: 64.14, by: [59.26, 54.76, 81.82, 51.85, 53.33, 93.33, 75], cost: 16.51, time: 4920},
    inP: 2, outP: 10, cache: .1, prev: 'sonnet5', blurb: 'The all-rounder. Quick writer, mid price.'},
  opus5: {id: 'opus5', name: 'OPUS 5', real: 'Claude Opus 5', body: 'gt', paint: '#4a2c99', ink: '#a58cf0',
    tps: 52.6, think: 20.0, think100k: 25.5, taskTime: 526.6, taskCost: 3.613, knows: 58.9, guesses: 61.2, reads: 79.0, codes: 84.6, codesBy: [100, 83.64, 84.44], aa: 'claude-opus-5-high',
    code: {all: 53.53, by: [44.44, 47.62, 72.73, 40.74, 33.33, 100, 58.33], cost: 18.60, time: 4020},
    inP: 5, outP: 25, cache: .1, fast: {k: 2.5, inP: 10, outP: 50}, blurb: 'The last Opus. Strong, slow and pricey.'},
  opus55: {id: 'opus55', name: 'OPUS 5.5', real: 'Claude Opus 5.5', body: 'gt', paint: '#6a3fd0', ink: '#b9a3ff',
    tps: 73.8, think: 35.2, think100k: 87.8, taskTime: 295.7, taskCost: 1.823, knows: 64.6, guesses: 67.6, reads: 82.7, codes: 87.6, codesBy: [100, 90.30, 81.11], aa: 'claude-opus-5-5-high',
    code: {all: 65.15, by: [57.41, 71.43, 81.82, 29.63, 60, 100, 75], cost: 13.20, time: 3840},
    inP: 4, outP: 20, cache: .05, fast: {k: 2.5, inP: 8, outP: 40}, prev: 'opus5', blurb: 'Gets the most right. Thinks the longest.'},
  fable51: {id: 'fable51', name: 'FABLE 5.1', real: 'Claude Fable 5.1', body: 'classic', paint: '#1f7a55', ink: '#5fd3a0',
    tps: 51.0, think: 29.0, think100k: 27.9, taskTime: 444.1, taskCost: 3.913, knows: 64.9, guesses: 68.8, reads: 83.7, codes: 85.0, codesBy: [100, 85.45, 82.22], aa: 'claude-fable-5-1-high',
    code: {all: 58.08, by: [55.56, 57.14, 60.61, 44.44, 60, 80, 66.67], cost: 17.18, time: 3600},
    inP: 10, outP: 50, cache: .025, blurb: 'Careful and grand. Slowest writer, top price.'},
};
/** Every car, in family order; the picker lists them like this. */
export const CARS: ModelId[] = ['haiku55', 'sonnet5', 'sonnet55', 'opus5', 'opus55', 'fable51'];
/** The blocks' builders: the models with a score on the old coding test. Five: Haiku 5.5 has none, and no model stands
 *  in for it. */
export const CODERS = CARS.filter(id => MODELS[id].codesBy);

/** Terminal-Bench 4.0 as Vals ran it (`code`): 66 tasks, each run three times, pass or fail; leaderboard updated
 *  2026-10-07, read 2026-10-08. The leaderboard gives a score for each kind of work, and a cost and a time per task for
 *  the whole test only. Each row's seven scores, weighted by KINDS' task counts, come back to its overall score
 *  (check.ts fails the build if a typo breaks that).
 *  No model is best at every kind: Sonnet 5.5 leads software and operations, Opus 5.5 leads science and drops to 30%
 *  on operations, and Haiku 5.5 ties Opus 5 on software and Fable 5.1 on ML for a fraction of the price. Sonnet 5
 *  fails nearly everything and costs the most.
 *  Three things the numbers page says: five of the six rows include requests handed to an older model (counted as
 *  failures Opus 5.5 would be 58.08%; Haiku 5.5 hands none off), and the game uses the tester's main score; hardware,
 *  security and media are 4 or 5 tasks each, so one run moves a score 7 or 8 points; and the tester says scores can't
 *  be compared with Terminal-Bench 2.1, so no world uses both. */
export const TB4_READ = '2026-10-08';
/** Terminal-Bench 2.1 as Vals ran it (`codesBy`, the blocks only): 89 tasks, three runs each, labelled by the test
 *  itself. The leaderboard's TASK switch (Overall, Easy, Medium, Hard) gives `codesBy`; the counts follow from the
 *  scores (Easy moves in twelfths). Read 2026-10-02. A stronger model is not better at every level: Opus 5 leads the
 *  HARD tasks, Sonnet 5.5 beats Opus 5 and Fable 5.1 on MEDIUM, and Sonnet 5.5 misses an EASY task that Sonnet 5 gets.
 *  Seen 2026-10-08: Vals has archived the test ("We no longer run this benchmark on new model releases"), and Haiku
 *  5.5 was never run on it. Its replacement scores by kind of work, where the two best models fail a quarter of most
 *  kinds or more: towers would fall all day. So the blocks keep this test and five builders (PLAN-coding-tb4.md). */
export const CODE_TASKS: [number, number, number] = [4, 55, 30];
/** Where each number can be looked up. */
export const AA = 'https://artificialanalysis.ai/models/', VALS = 'https://www.vals.ai/benchmarks/terminal-bench-2-1', VALS4 = 'https://www.vals.ai/benchmarks/terminal-bench-4',
  PRICING = 'https://platform.claude.com/docs/en/about-claude/pricing', FAST = 'https://platform.claude.com/docs/en/build-with-claude/fast-mode';
/** The tester's page for its knowledge test (seen 2026-10-12): what "AA-Omniscience" on a card opens. It leads with each
 *  model's top setting, so a model's own number at high effort is on its model page (AA + its slug). */
export const AA_KNOWS = 'https://artificialanalysis.ai/evaluations/omniscience', AA_EFFORT = 'https://artificialanalysis.ai/models/releases/claude-opus-5-5';
/** Anthropic's pages the cards quote: two docs pages, a research post and four posts on claude.dev. A quote's byline
 *  on a card opens its page (explain.tsx). */
export const DOCS_LOOP = 'https://code.claude.com/docs/en/how-claude-code-works', DOCS_EFFORT = 'https://platform.claude.com/docs/en/build-with-claude/effort',
  DOCS_SECURITY = 'https://code.claude.com/docs/en/security', UNTRUSTED = 'https://www.anthropic.com/research/prompt-injection-defenses',
  GUIDE = 'https://claude.dev/blog/getting-the-most-out-of-opus-5-5/', COSTS = 'https://claude.dev/blog/what-a-task-costs-on-opus-5-5/',
  SONNET_POST = 'https://claude.dev/blog/building-with-claude-sonnet-5-5/', CONTEXT = 'https://claude.dev/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models/';

/** Anthropic's pricing page, checked 2026-10-01: the first read of a document you'll read again costs this much more
 *  (the cache write, kept 5 minutes), and work sent as a batch (done within the hour, mostly) costs this share.
 *  Read again 2026-10-08 for Haiku 5.5, the one model priced by prompt length: $0.10 / $0.50 for a prompt of up to
 *  100,000 tokens, $0.50 / $2.50 over that (`long`); its cache and batch shares are the standard ones. */
export const CACHE_WRITE = 1.25, BATCH = .5, CACHE_LIFE_S = 300;

/**
 * The arena's fighters (world 4): each model at its effort levels. Artificial Analysis, one model page per level,
 * checked 2026-10-01. Three current models are published at four levels or more. Sonnet 5.5 starts at MEDIUM: its
 * LOW page has no index and no cost per task. Opus 5 is read 2026-10-05, only at the three levels figure B counts
 * (MISSES below): it is the old model of the arena's third round. (Sonnet 5 is left out: at MAX it scores 38, under
 * every level here.) Haiku 5.5 is the first Haiku with effort levels (the tester lists five, seen 2026-10-08); it is
 * not a fighter: the arena was built before it came out.
 * These are read a day after MODELS above, and the tester's live timings move: Opus 5.5's HIGH thinking time here
 * (38.91 s) is the same measurement as MODELS.opus55.think (35.2 s on 2026-09-30).
 */
export type Effort = {
  name: string;
  index: number;    // AA Intelligence Index: out of 100, across the tester's ten tests
  cost: number;     // $ per task, the index's average
  think: number;    // seconds to the first answer token
};
export const EFFORT: Partial<Record<ModelId, Effort[]>> = {
  opus55: [
    {name: 'LOW', index: 42, cost: .55, think: 13.5},
    {name: 'MEDIUM', index: 51, cost: 1.34, think: 25.18},
    {name: 'HIGH', index: 54, cost: 1.82, think: 38.91},
    {name: 'X-HIGH', index: 56, cost: 3.46, think: 133.65},
    {name: 'MAX', index: 58, cost: 5.98, think: 715.95},
  ],
  sonnet55: [
    {name: 'MEDIUM', index: 41, cost: .59, think: 1.42},
    {name: 'HIGH', index: 47, cost: 1.08, think: 12.7},
    {name: 'X-HIGH', index: 52, cost: 2.74, think: 32.28},
    {name: 'MAX', index: 56, cost: 7.62, think: 435.69},
  ],
  fable51: [
    {name: 'LOW', index: 47, cost: 2.37, think: 4.49},
    {name: 'MEDIUM', index: 49, cost: 2.98, think: 7.18},
    {name: 'HIGH', index: 51, cost: 3.91, think: 29.66},
    {name: 'X-HIGH', index: 53, cost: 5.98, think: 98.3},
    {name: 'MAX', index: 53, cost: 7.63, think: 258.55},
  ],
  opus5: [
    {name: 'LOW', index: 39, cost: 1.10, think: 2.11},
    {name: 'MEDIUM', index: 45, cost: 2.19, think: 2.50},
    {name: 'MAX', index: 51, cost: 5.86, think: 57.07},
  ],
};

/**
 * The arena's misses (world 4), by kind. Figure B of Thariq Shihipar (Anthropic, Claude Code team), "Using Claude Code:
 * Spending your effort", claude.dev, 25 Sep 2026, read 2026-10-05 off the figure's slider. Terminal-Bench 3.0 in
 * Anthropic's own runs, 5 tries per task; each column adds up to its tries (370, and 369 for Opus 5 below MAX).
 * A model judges the kind of each miss, and the article calls the kinds approximate. `tokens` is the median per try,
 * in thousands. The figure has no HIGH step for Fable 5.1 and no X-HIGH for Opus 5; Opus 5's MAX is the run the
 * article calls "effort-120". Only these two of our models are counted; the arena borrows Fable 5.1's mix for
 * Opus 5.5 and Sonnet 5.5, and says so.
 *   missed a case     bug (a bug its tests missed) · works (works on my machine) · overfit (to the examples) · close (close, but not exact)
 *   made the wrong call   misread (a requirement) · fix (wrong or incomplete) · domain (got the domain rule wrong) · reading (picked the wrong reading)
 *   other             other failures
 */
export type MissKind = 'bug' | 'works' | 'overfit' | 'close' | 'misread' | 'fix' | 'domain' | 'reading' | 'other';
export type Misses = {name: string; pass: number; tokens: number} & Record<MissKind, number>;
export const MISSES: Partial<Record<ModelId, Misses[]>> = {
  fable51: [
    {name: 'LOW', pass: 140, tokens: 73, bug: 40, works: 2, overfit: 7, close: 10, misread: 45, fix: 31, domain: 32, reading: 25, other: 38},
    {name: 'MEDIUM', pass: 158, tokens: 93, bug: 28, works: 1, overfit: 8, close: 8, misread: 38, fix: 19, domain: 27, reading: 38, other: 45},
    {name: 'X-HIGH', pass: 217, tokens: 177, bug: 12, works: 1, overfit: 3, close: 4, misread: 31, fix: 12, domain: 24, reading: 40, other: 26},
    {name: 'MAX', pass: 214, tokens: 222, bug: 14, works: 1, overfit: 3, close: 6, misread: 26, fix: 10, domain: 24, reading: 47, other: 25},
  ],
  opus5: [
    {name: 'LOW', pass: 108, tokens: 76, bug: 38, works: 3, overfit: 12, close: 10, misread: 53, fix: 36, domain: 23, reading: 28, other: 58},
    {name: 'MEDIUM', pass: 141, tokens: 119, bug: 33, works: 3, overfit: 4, close: 10, misread: 39, fix: 20, domain: 25, reading: 39, other: 55},
    {name: 'MAX', pass: 193, tokens: 308, bug: 17, works: 0, overfit: 1, close: 6, misread: 37, fix: 13, domain: 23, reading: 45, other: 35},
  ],
};
/** The same article's worked example: html-js-filter, a cleaner that must stop every way of sneaking JavaScript into a
 *  page. Fable 5.1 passed it 1 time in 5 at LOW and 5 in 5 at X-HIGH. A try at LOW takes about 2 minutes, and "a
 *  high-effort run" about 33 (the article's words; it doesn't say which high level). Re-read 2026-10-05. */
export const CLEANER = {low: 1, xhigh: 5, lowMin: 2, highMin: 33};
export const SPEND = 'https://claude.dev/blog/spending-your-effort/';

/**
 * The ship's crew (world 6): how often an order hidden in a file gets its way, in percent. Anthropic's system cards,
 * section 5.2, read 2026-10-02; both tests are Gray Swan's, an outside security firm. Every model with thinking on.
 * Haiku 5.5 is from its own card (7 Oct 2026), read 2026-10-08: figure 5.2.1.A's text for `known` and `screen`
 * (7.1% in all; 24.4% in GUI computer use, 0.2% in coding, 4.0% in tool use), table 5.2.2.1.A for `probes` and `raw`.
 * It is the easiest of the six to fool with a known attack and the hardest for the attacker that learned the room:
 * its requests are never handed to another model (the card: "Claude Haiku 5.5's classifiers do not trigger fallbacks").
 *   known   Gray Swan's IPI benchmark (1,804 known attacks; coding, tool use and computer use together): the chance
 *           an attacker with 15 tries gets in. No prompt-injection protections.
 *   screen  the same benchmark, its computer-use scenarios alone, 15 tries. (Opus 5 is not published by setting on
 *           this version of the benchmark.)
 *   probes  Shade, Gray Swan's attacker that learned these 40 coding scenarios and gets 200 tries at each: the share
 *           of tries that get in, with Anthropic's prompt-injection probes on.
 *   raw     the same, with the probes off.
 * A bigger model is not a safer one here: against Shade the Opus models and Fable 5.1 lose most often. The cards say
 * why: a safety filter hands many of those requests to an older model (Opus 4.8), and it is the older model that
 * gives in. Of the 2,872 requests Opus 5.5 answered itself, none did.
 * Where each number is: the Opus 5.5 card (Opus 5.5 and Opus 5: all; Fable 5.1: known, probes, raw) · the Sonnet 5.5
 * card (Sonnet 5.5 and Sonnet 5: all) · the Fable 5.1 card (Fable 5.1: screen) · the Haiku 5.5 card (Haiku 5.5: all).
 * `cardOf` gives the link.
 */
export type Attack = 'known' | 'screen' | 'probes' | 'raw';
export const INJECT: Partial<Record<ModelId, Partial<Record<Attack, number>>>> = {
  haiku55: {known: 7.1, screen: 24.4, probes: 0, raw: .08},
  sonnet5: {known: 6.7, screen: 17.2, probes: 15.76, raw: 19.47},
  sonnet55: {known: 3.4, screen: 12.5, probes: 2.63, raw: 3.01},
  opus5: {known: 4.8, probes: 19.53, raw: 88.92},
  opus55: {known: 1.0, screen: 2.8, probes: 11.13, raw: 54.61},
  fable51: {known: 1.0, screen: 4.1, probes: 8.70, raw: 51.93},
};
/** The same passage of the Opus 5.5 card (the note above): the Shade requests Opus 5.5 answered itself. None of them
 *  gave in; the rest went to the older model. The ship's "Bigger is not safer" card draws it. */
export const OWN_ANSWERS = 2872;
/** The system card a crew member's number can be looked up in (the prompt-injection section, 5.2). */
const CARD = (model: string) => `https://www.anthropic.com/claude-${model}-system-card`;
export const cardOf = (id: ModelId, a: Attack) => CARD(id === 'haiku55' ? 'haiku-5-5' : id === 'fable51' && a === 'screen' ? 'fable-5-1' : id.startsWith('sonnet') ? 'sonnet-5-5' : 'opus-5-5');
/** The four cards by name, for a source line that names them (ui.tsx `SystemCards`). The Opus 5.5 card comes first. */
export const SYSTEM_CARDS: [string, string][] = [['Opus 5.5', CARD('opus-5-5')], ['Sonnet 5.5', CARD('sonnet-5-5')], ['Fable 5.1', CARD('fable-5-1')], ['Haiku 5.5', CARD('haiku-5-5')]];

export const CHECKED = '2026-09-30';
/** Every test score and price was read again on this day and matched. Speed and thinking time are the tester's
 *  live readings and had moved (the widest: Sonnet 5.5 wrote 101.0 tokens a second). They are left as read on
 *  CHECKED: every goal in the game is tuned to that day. */
export const RECHECKED = '2026-10-02';
/** The day Haiku 5.5's numbers were read: the day after it came out. Its speeds are the first live readings. */
export const HAIKU_READ = '2026-10-08';
export const SOURCES = [
  {what: 'Speed, thinking, per task, knowledge, documents', src: 'Artificial Analysis model pages, each model at high effort. Knowledge is AA-Omniscience, documents are AA-LCR. Haiku 5.5 was read on 2026-10-08; the tester notes that its cost per task does not yet count Haiku 5.5\'s higher price on long prompts',
    url: 'https://artificialanalysis.ai/models/claude-opus-5-5-high'},
  {what: 'Coding (the front desk and the tickets road)', src: 'Terminal-Bench 4.0, run by Vals, leaderboard updated 2026-10-07 (read 2026-10-08): 66 tasks, three runs each, scored by kind of work (software 18, science 14, ML 11, operations 9, hardware 5, security 5, media 4), with a cost and a time per task for the whole test. Five of the six rows include requests handed to an older model; the game uses the tester\'s main score',
    url: VALS4},
  {what: 'Coding (the blocks)', src: 'Terminal-Bench 2.1, run by Vals, leaderboard of 2026-09-27. EASY, MEDIUM and HARD are the leaderboard\'s own TASK switch (read 2026-10-02). Vals has since retired the test and no longer runs it on new models, so Haiku 5.5 has no score on it and is not a builder',
    url: VALS},
  {what: 'Price', src: 'Anthropic, model pricing (checked 2026-10-01; Haiku 5.5 on 2026-10-08). Reading a document it will read again costs 1.25x the first time; later reads come from the cache at a tenth of the price (a twentieth on Opus 5.5, a fortieth on Fable 5.1). Haiku 5.5 is priced by prompt length: $0.10 / $0.50 up to 100,000 tokens, $0.50 / $2.50 over that, which the open-book road\'s contract is',
    url: PRICING},
  {what: 'Fast mode', src: 'Anthropic, fast mode: up to 2.5x output speed at twice the price, Opus models only',
    url: FAST},
  {what: 'Effort levels', src: 'Artificial Analysis, Opus 5.5, Sonnet 5.5 and Fable 5.1 at each effort level, one model page per level (checked 2026-10-01; Opus 5 at LOW, MEDIUM and MAX, 2026-10-05): Intelligence Index, cost per task, seconds to the first answer token',
    url: AA_EFFORT},
  {what: 'Misses by kind (the arena)', src: 'Thariq Shihipar (Anthropic), "Using Claude Code: Spending your effort", 25 Sep 2026, figure B: Fable 5.1 and Opus 5 on Terminal-Bench 3.0, every try sorted by how it failed (read 2026-10-05). A model judged the kinds; the article calls them approximate',
    url: SPEND},
  {what: 'How Claude works (the arena\'s cards)', src: 'Claude Code docs, "How Claude Code works": the loop of gathering context, taking action and checking the result',
    url: DOCS_LOOP},
  {what: 'What effort changes (the arena\'s cards)', src: 'Claude Platform docs, "Effort": effort covers every token Claude writes, tool calls and thinking included',
    url: DOCS_EFFORT},
  {what: 'What a hidden order is (the ship\'s cards)', src: 'Claude Code docs, "Security": what prompt injection is, and what to do about it',
    url: DOCS_SECURITY},
  {what: 'Content it can\'t trust (the ship\'s cards)', src: 'Anthropic, "Mitigating the risk of prompt injections in browser use", 24 Nov 2025',
    url: UNTRUSTED},
  {what: 'The ship\'s tips', src: 'Addy Osmani (Anthropic), "Getting the most out of Opus 5.5 in Claude and Claude Code", claude.dev, 22 Sep 2026: keep permission prompts on for destructive commands, a CLAUDE.md rule to stop before anything destructive, and /config to be asked before a flagged message moves to an older model',
    url: GUIDE},
  {what: 'The blocks\' tips', src: 'Addy Osmani (Anthropic), "What a task costs on Opus 5.5", claude.dev, 25 Sep 2026: a model that can check its own work finds its mistakes earlier; and "Getting the most out of Opus 5.5", 22 Sep 2026: name the finish line, like the tests passing',
    url: COSTS},
  {what: 'The desk\'s tips', src: 'Addy Osmani (Anthropic), "What a task costs on Opus 5.5", claude.dev, 25 Sep 2026: keep judgment calls on the main model; move down to a smaller model for lookups, not for writing code; put a subagent on a smaller model with model: haiku in its definition; /usage (or /cost) shows what a session has cost',
    url: COSTS},
  {what: 'The rally\'s tips', src: 'Addy Osmani (Anthropic), "Getting the most out of Opus 5.5 in Claude and Claude Code", claude.dev, 22 Sep 2026: "Mark anything you couldn\'t confirm, and say where you looked"; name the finish line, like the tests passing',
    url: GUIDE},
  {what: 'The rally\'s tips, on which model', src: 'Addy Osmani (Anthropic), "Building with Claude Sonnet 5.5", claude.dev, 28 Sep 2026: "For the hardest long-horizon work, an Opus model is the better choice." The Sonnet and fast-mode lines are the game\'s own words, from the prices and speeds in the table above',
    url: SONNET_POST},
  {what: 'The court\'s rules, for a request', src: 'Addy Osmani (Anthropic), "Getting the most out of Opus 5.5 in Claude and Claude Code", claude.dev, 22 Sep 2026, sections 1 and 2 (read in full 2026-10-06): give the whole task in one message and name the finish line; remove "think carefully" lines; a rule for when to stop and ask; for design work, list the styles to leave out; type a follow-up while it works',
    url: GUIDE},
  {what: 'The court\'s rules, for saved instructions', src: 'Thariq Shihipar (Anthropic), "The new rules of context engineering for Claude 5 generation models", claude.dev, 24 Jul 2026 (read in full 2026-10-06): conflicting messages make Claude think longer before it acts; over 80% of Claude Code\'s system prompt removed with no measurable loss; don\'t state the obvious, spend the words on gotchas; a verification skill referenced from CLAUDE.md; a mockup beats a description; /doctor',
    url: CONTEXT},
  {what: 'Hidden orders (the ship)', src: 'Anthropic, system cards for Opus 5.5, Sonnet 5.5 and Fable 5.1, section 5.2 (read 2026-10-02), and for Haiku 5.5 (read 2026-10-08): Gray Swan\'s IPI benchmark of known attacks at 15 tries, and Gray Swan\'s Shade attacker in coding, with Anthropic\'s probes on and off; of the 2,872 Shade requests Opus 5.5 answered itself, none got in (the rest went to an older model); Haiku 5.5 answers every request itself. Anthropic ran or reported these, not an outside tester',
    url: SYSTEM_CARDS[0][1]},
];
