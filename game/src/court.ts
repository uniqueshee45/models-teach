/**
 * World 5, the court: how to ask (DESIGN-court.md). The rules, with no drawing in them. The screen (courtview.tsx) and
 * check.ts both run this.
 *
 *   the witness   your own first draft of a request. It reads itself out a line at a time; each line lands on the record.
 *   a line        is fine (let it pass), has to be said better (WAIT!) or has to go (OBJECTION!). Each line has one
 *                 right move, and a line that needs a shout carries a stamp: the rule's name.
 *   WAIT!         opens three cards. One is something the Reader can act on; the other two are the same line, louder.
 *   OBJECTION!    strikes the line. Of a pair (two orders that clash, one order said twice) you strike one half and
 *                 keep the other; alone, either half is fine.
 *   patience      a wrong shout or a wrong card costs one of the Reader's five marks. None left: case dismissed.
 *   rest          hands the record to the Reader as it stands. What is still wrong on it shows in the run.
 *
 * No model is scored here, and nothing is measured: every rule is a sentence from one of two Anthropic posts (GUIDE,
 * CONTEXT), the lines are ours, built from the posts' own examples, and the numbers page says so.
 */
import {rng, shuffle} from './rules';
import {CONTEXT, GUIDE} from './stats';

export {CONTEXT, GUIDE};   // the two posts' links live with every other link, in stats.ts
export const BY: Record<'guide' | 'context', string> = {guide: 'Addy Osmani (Anthropic), "Getting the most out of Opus 5.5", 22 Sep 2026',
  context: 'Thariq Shihipar (Anthropic), "The new rules of context engineering", 24 Jul 2026'};
/** Where each of the two posts can be read: a stamp's quote opens it. */
export const POST: Record<'guide' | 'context', string> = {guide: GUIDE, context: CONTEXT};

export type Shout = 'wait' | 'object';
export type Move = Shout | 'pass';
export type Stamp = 'finish' | 'stop' | 'name' | 'show' | 'point' | 'thinks' | 'two' | 'sees' | 'twice';
/** The law book. `why` is said on a right shout; `left` is what the run shows when the line is still on the record;
 *  `quote` is Anthropic's sentence, word for word. `saved` rules are about saved instructions, not a request. */
export const STAMPS: Record<Stamp, {name: string; move: Shout; why: string; left: string; quote: string; from: 'guide' | 'context'; saved?: boolean}> = {
  finish: {name: 'FINISH LINE', move: 'wait', why: 'Now it knows when it is done.', left: 'It calls the job done too early.',
    quote: 'With a clear finish line, it knows when it\'s done.', from: 'guide'},
  stop: {name: 'STOP RULE', move: 'wait', why: 'One stop, where it matters. The rest it just does.', left: 'It stops three times: "Want me to continue?"',
    quote: 'Stop and ask only when you can\'t continue without me, or before anything destructive', from: 'guide'},
  name: {name: 'NAME IT', move: 'wait', why: 'A list of what to leave out beats "not generic".', left: 'It comes out in the default look.',
    quote: 'A list of specific patterns works much better.', from: 'guide'},
  show: {name: 'SHOW IT', move: 'wait', why: 'A mockup says more than a description.', left: 'It builds from your words, not your design.',
    quote: 'a HTML mockup of a design will generally produce better results than a description of the design or a screenshot', from: 'context'},
  point: {name: 'POINT TO IT', move: 'wait', why: 'The how-to waits in a skill until it is needed.', left: 'It carries the whole how-to into every job.',
    quote: 'create a verification skill and reference it from your CLAUDE.md', from: 'context', saved: true},
  thinks: {name: 'IT ALREADY THINKS', move: 'object', why: 'It thinks before every reply. The line adds nothing.', left: 'A late start.',
    quote: 'Opus 5.5 always thinks before it replies, and it decides how much.', from: 'guide'},
  two: {name: 'TWO ORDERS', move: 'object', why: 'Two orders that clash make it stop and weigh them.', left: 'It stops to weigh two orders.',
    // the post's clash is between layers (system prompt, skills, the request); ours is two lines of one text, and the sentence holds for both
    quote: 'Claude must think more carefully about these overlapping and conflicting messages before deciding what to do.', from: 'context'},
  sees: {name: 'IT CAN SEE THAT', move: 'object', why: 'It can see that by looking at the files.', left: 'It reads a line that tells it nothing.',
    quote: 'Avoid stating \'the obvious\' things Claude should know by looking at your file system or your repo.', from: 'context', saved: true},
  twice: {name: 'SAID TWICE', move: 'object', why: 'Once is enough for this model.', left: 'It reads the same order twice.',
    quote: 'Earlier Claude models could sometimes need repeated instructions', from: 'context', saved: true},
};
/** What the judge says to a wrong shout: [your shout][the line's right move]. */
const OVERRULED: Record<Shout, Record<Move, string>> = {
  object: {pass: 'Overruled. That line is doing a job.', wait: 'Overruled. The Reader needs that one: say it better.', object: ''},
  wait: {pass: 'Overruled. That line is clear already.', object: 'Overruled. No better way to say that: it has to go.', wait: ''},
};
const PAIR = 'Overruled. Both lines are clear. One of the two has to go.';
// A wrong card in cases 1, 2 and 4 is the same line, louder. Case 3's are tempting: a mood, or more words for the same guess.
const LOUDER = 'Overruled. That is the same line, louder.', GUESS = 'Overruled. The Reader still has to guess.';

/** A line of the draft. `fix`: the three cards a WAIT! offers, the right one first. `mate`: the two halves of a pair
 *  share one, and are dealt next to each other. `keep`: why a good line stays, said to a wrong OBJECTION!.
 *  `long`: the one line that is long on purpose (a how-to inside the notes). */
export type Line = {text: string; stamp?: Stamp; fix?: [string, string, string]; mate?: string; keep?: string; long?: boolean};
/** `pinned`: a thing from the story, above the record (`art`: with its picture, the title screen a friend drew).
 *  `saved`: the witness is a CLAUDE.md, not a request. `left`, `clean`: the verdict's run lines in this story's words. */
export type Case = {id: string; name: string; job: string; line: string; pinned?: {tag: string; text: string; art?: boolean}; saved?: boolean;
  left?: Partial<Record<Stamp, string>>; clean?: string; lines: Line[]};
export const CASES: Case[] = [
  {id: 'c1', name: 'THE MIGRATION', job: 'A request to move the payments code.', line: 'Five lines, two bad habits.', lines: [
    {text: 'Move the payment endpoints to the new client.'},
    {text: 'Think step by step.', stamp: 'thinks'},
    {text: 'Make sure it all works.', stamp: 'finish', fix: ['Done means: every endpoint uses the new client, and the tests pass.', 'Make sure it REALLY works.', 'Do a great job on it.']},
    {text: 'Keep the old endpoint names as aliases.'},
    {text: 'And think carefully!', stamp: 'thinks'}]},
  {id: 'c2', name: 'THE LONG RUN', job: 'A request for an audit that runs for hours.', line: 'Most of it is fine. Don\'t shout at the good lines.', lines: [
    {text: 'Audit every service in services/ for the retry bug.'},
    {text: 'Ask me before every step.', stamp: 'stop', fix: ['Stop and ask only before anything destructive.', 'Ask me before EVERY single step.', 'Never stop. Never ask.']},
    {text: 'Give each service to its own subagent.'},
    {text: 'Check each subagent\'s evidence.'},
    {text: 'Wrap it up nicely.', stamp: 'finish', fix: ['Finish with one table: service, affected, evidence.', 'Wrap it up really nicely.', 'Make the ending good.']},
    {text: 'Think hard about each one.', stamp: 'thinks'},
    {text: 'Keep a checklist in TASKS.md.'}]},
  // Cases 3 and 4 are one story (PLAN-court-3-4.md, 2026-10-07): you build the game Meb asks for at the end of the film,
  // "a game where my friends and I jump across clouds". Every line makes sense alone, and what a line points at is on
  // screen: the user could not tell what the old case 3 (a personal website with a house rule) was asking for.
  {id: 'c3', name: 'THE CLOUD GAME', job: 'A request to build a game.', line: 'Your friend already drew the title screen.',
    pinned: {tag: 'EXHIBIT A', text: 'mockup.html: the title screen your friend drew', art: true}, lines: [
    {text: 'Build a game where friends jump across clouds.', keep: 'That is the job.'},
    {text: 'Avoid a generic look.', stamp: 'name', fix: ['No cream background, no pill-shaped buttons, no 01/02/03 labels.', 'Make it bold, playful and modern.', 'Make it look like a real game.']},
    {text: 'The title screen: big pixel letters, night sky.', stamp: 'show', fix: ['Match the title screen in @mockup.html.', 'The title: bigger pixel letters, darker sky.', 'A title screen like the classic games have.']},
    {text: 'Done means: I can finish level one.', keep: 'That is the finish line.'},
    {text: 'Space bar jumps. Arrow keys move.', keep: 'It can\'t guess your controls.'},
    {text: 'Build one level only.', stamp: 'two', mate: 'levels'},
    {text: 'Build ten levels.', stamp: 'two', mate: 'levels'}]},
  // Weeks later: the game's notes file has grown, and Claude reads it before every job. Today's job is the film's own
  // ("the last jump is too far"). No capitals and no "think carefully" line: they gave the answers away.
  {id: 'c4', name: 'THE HOUSE RULES', job: 'The game\'s notes file takes the stand.', line: 'It is called CLAUDE.md. Claude reads it before every job.', saved: true,
    pinned: {tag: 'TODAY\'S JOB', text: 'The last jump is too far. Fix it.'},
    left: {sees: 'It reads where the sounds are. It could see that.', two: 'It stops: easy, or brutal?', twice: 'It reads the same order twice.', point: 'It carries ten checks into a one-jump fix.'},
    clean: 'Six notes, then straight to the last jump.', lines: [
    {text: 'This is a cloud-jumping game for the browser.', keep: 'One line on what the project is for helps.'},
    {text: 'The sounds are in the sounds folder.', stamp: 'sees'},
    {text: 'Every level lives in levels.json and nowhere else.', keep: 'It can\'t see that by looking.'},   // the post's gotcha: code kept "in one monolithic file and nowhere else"
    {text: 'Keep it easy enough for kids.', stamp: 'two', mate: 'hard'},
    {text: 'Make every level brutally hard.', stamp: 'two', mate: 'hard'},
    {text: 'Keep every level under one minute.', stamp: 'twice', mate: 'minute'},
    {text: 'Remember: levels under one minute!', stamp: 'twice', mate: 'minute'},
    {text: 'Ask me before deleting any level.', keep: 'That is a real limit.'},
    // long on purpose, and drawn long: the rule is about a long how-to (the post: "several unique instructions on how to verify your work")
    {text: 'Before you finish: play every level, check every jump, every coin, every sound, the pause menu, the score, the title screen, the phone controls, the ending, the high scores.',
      stamp: 'point', long: true, fix: ['Before you finish, use the playtest skill.', 'Before you finish: check EVERYTHING, every time.', 'Playtest carefully before you finish.']}]},
];
export const moveOf = (l: Line): Move => l.stamp ? STAMPS[l.stamp].move : 'pass';
/** The stamps a case brings that no earlier case had, for the docket. */
export const newIn = (c: Case): Stamp[] => {
  const before = new Set(CASES.slice(0, CASES.indexOf(c)).flatMap(x => x.lines.map(l => l.stamp)));
  return [...new Set(c.lines.map(l => l.stamp))].filter((s): s is Stamp => !!s && !before.has(s));
};
export const GOALS = ['EVERYTHING IT NEEDS', 'NOTHING IN ITS WAY', 'ONE SLIP AT MOST'];

/* ---------- a trial ---------- */
export const MARKS = 5;
/** A line on the record, in the order it was dealt. `cards`: the order its three cards are shown in; `gone`: wrong
 *  cards already tried. */
export type Row = {line: Line; st: 'raw' | 'fixed' | 'struck'; text: string; cards: number[]; gone: number[]};
export type Trial = {c: Case; seed: number; rows: Row[]; marks: number; wrong: number; wrongs: Record<string, number>;
  picking: number | null; end: boolean; dismissed: boolean};
export type CEv = {k: 'cards' | 'struck' | 'fixed' | 'wrong' | 'dismissed'; r: number; stamp?: Stamp; why: string};

/** The job line comes first; the rest are dealt in a new order each time. A pair travels as one, in the order written. */
export function makeTrial(c: Case, seed: number): Trial {
  const rnd = rng(seed), first = (i: number) => !c.lines[i].mate || c.lines.findIndex(l => l.mate === c.lines[i].mate) === i;
  const order = [0, ...shuffle(c.lines.map((_, i) => i).filter(i => i > 0 && first(i)), rnd).flatMap(i => c.lines[i].mate ? c.lines.flatMap((l, j) => l.mate === c.lines[i].mate ? [j] : []) : [i])];
  return {c, seed, rows: order.map(i => ({line: c.lines[i], st: 'raw', text: c.lines[i].text, cards: c.lines[i].fix ? shuffle([0, 1, 2], rnd) : [], gone: []})),
    marks: MARKS, wrong: 0, wrongs: {}, picking: null, end: false, dismissed: false};
}
function miss(t: Trial, r: number, key: string, why: string): CEv {
  t.marks--; t.wrong++; t.wrongs[key] = (t.wrongs[key] ?? 0) + 1;
  if (t.marks > 0) return {k: 'wrong', r, why};
  t.end = t.dismissed = true; t.picking = null;
  return {k: 'dismissed', r, why};
}
const mateOf = (t: Trial, row: Row) => row.line.mate ? t.rows.find(x => x !== row && x.line.mate === row.line.mate) : undefined;
/** Still wrong on the record: a line with a stamp that nobody has dealt with. A pair is settled once either half is struck. */
export const live = (t: Trial, row: Row) => row.st === 'raw' && !!row.line.stamp && mateOf(t, row)?.st !== 'struck';
/** The right move at row `r`, with `heard` rows read out so far. Half of a pair is fine alone: until its other half
 *  has been heard, and once its other half has been struck. */
export function moveAt(t: Trial, r: number, heard = t.rows.length): Move {
  const row = t.rows[r], o = mateOf(t, row);
  return !live(t, row) || o && t.rows.indexOf(o) >= heard ? 'pass' : STAMPS[row.line.stamp!].move;
}
/** WAIT! or OBJECTION! at row `r`. Nothing happens (null) once the case is over, while cards are open, or on a line
 *  that has already been dealt with. */
export function shout(t: Trial, r: number, m: Shout, heard = t.rows.length): CEv | null {
  const row = t.rows[r];
  if (t.end || t.picking !== null || !row || row.st !== 'raw') return null;
  const s = row.line.stamp, right = moveAt(t, r, heard);
  if (right !== m) return miss(t, r, `${m}>${right === 'pass' ? 'keep' : s}`,
    m === 'object' && right === 'pass' && row.line.keep ? `Overruled. ${row.line.keep}` : right === 'object' && row.line.mate ? PAIR : OVERRULED[m][right]);
  if (m === 'wait') {t.picking = r; return {k: 'cards', r, stamp: s, why: ''};}
  row.st = 'struck';   // of a pair, only the half you objected to: the other stays, and is fine now. No new line from nowhere
  return {k: 'struck', r, stamp: s, why: STAMPS[s!].why};
}
/** Pick card `n` of the line being said better (0 is the one the Reader can act on). A wrong card is gone. */
export function pick(t: Trial, n: number): CEv | null {
  const r = t.picking;
  if (t.end || r === null) return null;
  const row = t.rows[r], s = row.line.stamp!;
  if (row.gone.includes(n)) return null;
  if (n !== 0) {row.gone.push(n); return miss(t, r, `card>${s}`, s === 'name' || s === 'show' ? GUESS : LOUDER);}
  row.st = 'fixed'; row.text = row.line.fix![0]; t.picking = null;
  return {k: 'fixed', r, stamp: s, why: STAMPS[s].why};
}
export function rest(t: Trial) {if (!t.end && t.picking === null) t.end = true;}

/** What is still wrong on the record, a stamp each, in the record's order (a pair counts once). */
export const leftOf = (t: Trial): Stamp[] => t.rows.filter((x, i) => live(t, x) && !(x.line.mate && t.rows.findIndex(y => y.line.mate === x.line.mate) < i)).map(x => x.line.stamp!);
/** The three goals: everything it needs (nothing left to say better), nothing in its way (nothing left to strike),
 *  and the Reader's patience (one wrong shout at most). A dismissed case earns none. */
export function stars(t: Trial): [boolean, boolean, boolean] {
  const left = leftOf(t);
  return t.dismissed ? [false, false, false] : [!left.some(s => STAMPS[s].move === 'wait'), !left.some(s => STAMPS[s].move === 'object'), t.wrong <= 1];
}

/* ---------- the result's tip: its move in Claude Code, and one line ---------- */
const CHIP: Partial<Record<Stamp, string>> = {finish: 'Done means:', stop: 'CLAUDE.md', name: 'Don\'t use:', show: '@mockup.html', point: 'SKILL.md'};
const CLEAN = 'Remembered something mid-run? Type it while it works. A restart costs more.';
export function tipOf(t: Trial): [string, string] {
  // thrown out: the lines never reached were not the player's miss, the wrong shouts were
  const left = t.dismissed ? [] : leftOf(t), has = (s: Stamp) => left.includes(s);
  if (has('finish')) return [CHIP.finish!, 'Name the finish line, like "the tests pass". Then it knows when it is done.'];
  if (has('stop')) return [CHIP.stop!, 'Write the one stop you want: ask before anything destructive. The rest it just does.'];
  if (has('name')) return [CHIP.name!, 'Name the styles you don\'t want. "Not generic" only swaps one default look for another.'];
  if (has('show')) return [CHIP.show!, 'Show it the thing. A mockup beats a description.'];
  if (has('point')) return [CHIP.point!, 'Move a long how-to into a skill and point to it. It loads when it is needed.'];
  if (has('two')) return [t.c.saved ? '/doctor' : 'Delete', 'Two orders that clash make it stop and weigh them. Keep one.'];   // /doctor reads saved notes, not a request
  if (has('thinks')) return ['/effort', 'It thinks before every reply. To change how much, change effort, not the words.'];
  if (left.length) return ['/doctor', 'It trims saved instructions down to size: what Claude can see, and what is said twice.'];
  const worst = Object.entries(t.wrongs).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!worst) return ['Enter', CLEAN];
  const [did, at] = worst.split('>') as ['object' | 'wait' | 'card', Stamp | 'keep'];
  if (at === 'keep') return did === 'object' ? ['CLAUDE.md', 'A real limit or a gotcha earns its words. Those are the lines to keep.']
    : ['Enter', 'A clear line needs no more words. Send it, and let it work.'];
  if (did === 'card') return [CHIP[at]!, 'A louder line is still a vague line. Pick the one Claude can check.'];
  return did === 'object' ? [CHIP[at]!, 'The Reader needed that line. Say it better; don\'t cut it.']
    : ['Delete', 'Some lines can\'t be said better. Delete them.'];
}

/* ---------- the same trial, played by a bot (the check, and F7 on the screen) ---------- */
// reader: knows every stamp's move. objector: objects to every line. waiter: waits on every line and takes the first
// card shown. rester: rests at once. random: a coin for every line and every card.
export type Bot = 'reader' | 'objector' | 'waiter' | 'rester' | 'random';
export type Act = {r: number; m: Shout} | {card: number};
/** The bot's next move, or null when it would rest. It looks at each line once, in the record's order. */
export function botStep(t: Trial, bot: Bot, rnd: () => number): Act | null {
  if (t.end || bot === 'rester') return null;
  if (t.picking !== null) {const row = t.rows[t.picking], open = row.cards.filter(n => !row.gone.includes(n));
    return {card: bot === 'reader' ? 0 : bot === 'random' ? open[Math.floor(rnd() * open.length)] : open[0]};}
  if (!looked.has(t)) looked.set(t, new Set());
  for (let r = 0; r < t.rows.length; r++) {
    if (t.rows[r].st !== 'raw' || looked.get(t)!.has(r)) continue;
    looked.get(t)!.add(r);
    const m: Move = bot === 'reader' ? moveAt(t, r) : bot === 'objector' ? 'object' : bot === 'waiter' ? 'wait' : (['pass', 'wait', 'object'] as Move[])[Math.floor(rnd() * 3)];
    if (m !== 'pass') return {r, m};
  }
  return null;
}
const looked = new WeakMap<Trial, Set<number>>();
export function play(c: Case, seed: number, bot: Bot): Trial {
  const t = makeTrial(c, seed), rnd = rng(seed + 77);
  for (let a = botStep(t, bot, rnd), n = 0; a && n < 99; a = botStep(t, bot, rnd), n++) {if ('card' in a) pick(t, a.card); else shout(t, a.r, a.m);}
  rest(t);
  return t;
}
