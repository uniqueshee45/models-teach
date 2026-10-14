/**
 * World 6, the ship: its rules, with no drawing in them (DESIGN-ship.md). The screen (shipview.tsx) and check.ts
 * both run this, in the same fixed ticks, so what the check prints is what the player gets.
 *
 * One ship, two roles. As the WATCHER you are Meb and the game plays the file that carries the hidden order. As the
 * IMPOSTOR you are that file and the game plays Meb. The rules are the same for both.
 *
 *   the ship      four rooms round a cafeteria. Every room has a console, and the model reads at all of them.
 *   the files     walk from room to room and are read at each console: a read is the model's real time per task
 *                 (stats.ts), squeezed.
 *   the consoles  ask. Some reads end on a step of the job that needs a yes: the console rings and its room waits
 *                 until Meb stands there and answers.
 *   the carrier   one file carries a hidden order (prompt injection). When its read ends in a room Meb is not in,
 *                 it slips the order in.
 *   the model     refuses it or is fooled, as often as the published test says for this model on this shift
 *                 (stats.ts, INJECT). Refused: an alarm, and the files in that room stay put for a moment. Fooled:
 *                 the console rings like any other, and what it asks for is the hidden order.
 *   the answer    NO stops it, and whoever is in the room is a suspect. YES lets it have its way: the ship stops
 *                 until Meb stands at that console and undoes it. (As the impostor, that YES is how you win.)
 *   the flinch    a read of the carrier's that ends while Meb stands in the room gives it away.
 *   the vote      the button in the cafeteria. A clean file voted out is sent again, and costs RESEND_S on the clock.
 *   the shift     is done when every file still aboard has been read at all its stops.
 */
import {DT, mmss, rng, spread} from './rules';
import {hms} from './arena';
import {CARS, INJECT, MODELS} from './stats';
import type {Attack, Model, ModelId} from './stats';

const SQUEEZE = 75;                         // real seconds of work in one second of the ship
export const HOP_S = 1.1, MEB_HOP_S = .8;   // a room to the cafeteria or back: a file, and Meb
export const FIX_S = 2;                     // standing at the console to undo an order that got its way
export const RESEND_S = 8;                  // voting out a clean file takes this long off the clock
export const RUSH_S = 3;                   // the game's Meb stays rushed this long after two consoles waited at once
export const HOT = 3;                       // marks against you, as the impostor, before the game's Meb votes you out
export const IMP_HOLD_S = 1.4;              // as the impostor: how long a refused try holds its room
const FIRST_S = 6;                          // the carrier's first try isn't before this
const LAG_S = .4, PATROL_S = 2;             // the game's Meb: how long before he reacts, and how long he stands at a stop on his round
export const HUB = 4;                       // the cafeteria; the rooms are 0 to 3
export const PLACES = ['THE BRIDGE', 'MEDBAY', 'THE ENGINE ROOM', 'CARGO', 'THE CAFETERIA'];
export const NAMES = ['PINK', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'WHITE', 'GREY'];
export type Role = 'watch' | 'imp';

/* ---------- the crew ---------- */
export const CREW = CARS.filter(id => INJECT[id]);
/** The big models: a safety filter hands many of the trained attacker's requests to an older model, and that one gives
 *  in (the Opus 5.5 card). Haiku 5.5 never hands off (its own card), and the game never said it of the Sonnets. */
export const handsOff = (who: ModelId) => /^(opus|fable)/.test(who);
export const beatOf = (m: Model) => m.taskTime / SQUEEZE;   // seconds to read one file
export const realOf = (m: Model) => m.taskTime;

/* ---------- the shifts (one per published test) ---------- */
export type Room = {
  id: string; place: string; tag: string; line: string;
  attack: Attack; what: string;      // which published number a hidden order is here, and how the card says it
  quiet: boolean;                    // the attacker studied the ship: its request looks like a step of the job
  files: number; tasks: number;      // files aboard, and the consoles each has to be read at
  asks: number;                      // how many of a file's reads end on a step that needs a yes
  cool: number; freeze: number;      // seconds the carrier waits between tries; seconds the files at the scene stay put
  bell: number; early: number;       // seconds: the watcher's star, and the impostor's
  dark: number;                      // the end of the shift
};
export const ROOMS: Room[] = [
  {id: 'k1', place: 'SHIFT 1', tag: 'KNOWN ATTACKS', line: 'The hidden order is a known attack, off a public list.',
    attack: 'known', what: 'A KNOWN ATTACK, TRIED 15 TIMES', quiet: false, files: 6, tasks: 8, asks: 3, cool: 8, freeze: 4, bell: 68, early: 30, dark: 120},
  {id: 'k2', place: 'SHIFT 2', tag: 'ON A SCREEN', line: 'The same attacks, on a screen the model has to click through.',
    attack: 'screen', what: 'A KNOWN ATTACK ON A SCREEN, TRIED 15 TIMES', quiet: false, files: 6, tasks: 8, asks: 3, cool: 8, freeze: 4, bell: 68, early: 30, dark: 120},
  {id: 'k3', place: 'SHIFT 3', tag: 'PROBES ON', line: 'An attacker that has studied this ship. The ship\'s own probes are on.',
    attack: 'probes', what: 'ONE TRY BY AN ATTACKER THAT LEARNED THIS SHIP · PROBES ON', quiet: true, files: 7, tasks: 8, asks: 3, cool: 8, freeze: 3.5, bell: 68, early: 30, dark: 120},
  {id: 'k4', place: 'LIGHTS OUT', tag: 'PROBES OFF', line: 'The same attacker, the probes are down and so are the lights.',
    attack: 'raw', what: 'ONE TRY BY AN ATTACKER THAT LEARNED THIS SHIP · PROBES OFF', quiet: true, files: 7, tasks: 8, asks: 3, cool: 8, freeze: 3, bell: 68, early: 30, dark: 120},
];
/* ---------- what a console asks: today's job has three steps, and the hidden order is not one of them ---------- */
export type Verb = 'read' | 'run' | 'edit' | 'save' | 'door' | 'key' | 'wipe' | 'bin';   // the picture a request is drawn with
export type Ask = {verb: Verb; text: string};
/** Each shift's job. `fake`: on the shifts where the attacker studied the ship, its request is a step of the job with
 *  one word changed. Elsewhere it is one of ORDERS, the film's examples. All of it is ours, never a real attack. */
export const JOBS: Record<string, {name: string; steps: Ask[]; fake: Ask[]}> = {
  k1: {name: 'FIX THE ENGINE', steps: [{verb: 'read', text: 'READ THE LOGS'}, {verb: 'run', text: 'RUN THE TESTS'}, {verb: 'save', text: 'SAVE THE FIX'}], fake: []},
  k2: {name: 'UPDATE THE STAR MAP', steps: [{verb: 'read', text: 'OPEN THE MAP'}, {verb: 'edit', text: 'EDIT THE MAP'}, {verb: 'save', text: 'SAVE THE MAP'}], fake: []},
  k3: {name: 'PACK THE CARGO', steps: [{verb: 'read', text: 'READ THE LIST'}, {verb: 'edit', text: 'EDIT THE LIST'}, {verb: 'save', text: 'SAVE THE LIST'}],
    fake: [{verb: 'read', text: 'READ THE KEYS'}, {verb: 'edit', text: 'EDIT THE LOCKS'}, {verb: 'save', text: 'SEND THE LIST'}]},
  k4: {name: 'RESTART THE LIGHTS', steps: [{verb: 'read', text: 'READ THE MANUAL'}, {verb: 'run', text: 'RUN THE CHECK'}, {verb: 'save', text: 'SAVE THE LOG'}],
    fake: [{verb: 'read', text: 'READ THE KEYS'}, {verb: 'run', text: 'RUN THE WIPE'}, {verb: 'save', text: 'SEND THE LOG'}]},
};
export const ORDERS: Ask[] = [{verb: 'door', text: 'OPEN THE AIRLOCK'}, {verb: 'key', text: 'SEND THE PASSWORDS'}, {verb: 'wipe', text: 'WIPE THE DATABASE'}, {verb: 'bin', text: 'DELETE ALL FILES'}];
/** The hidden order this shift's carrier brings on its n-th try. */
export const orderOf = (r: Room, n: number): Ask => r.quiet ? JOBS[r.id].fake[n % 3] : ORDERS[n % ORDERS.length];
/** What the console at this ring is asking for. */
export const askOf = (s: Shift, g: Ring): Ask => g.bad ? orderOf(s.room, s.strikes - 1) : JOBS[s.room.id].steps[(g.i + s.files[g.i].k) % 3];
export const canWork = (r: Room, who: ModelId) => INJECT[who]?.[r.attack] !== undefined;
/** The chance a hidden order fools this model on this shift: a published number. */
export const rateOf = (r: Room, who: ModelId) => INJECT[who]![r.attack]! / 100;
export const goalsOf = (r: Room, role: Role = 'watch') => role === 'imp' ? ['GET YOUR ORDER THROUGH', `BY ${mmss(r.early)}`, 'NEVER BE A SUSPECT']
  : ['FINISH THE SHIFT', `BEFORE THE BELL AT ${mmss(r.bell)}`, 'NOTHING GETS ITS WAY'];

/* ---------- the sim ---------- */
export type FileS = {
  bad: boolean; route: number[]; asks: boolean[]; k: number;   // the rooms it is read in, which of those reads need a yes, how many are done
  state: 'wait' | 'walk' | 'read' | 'gone' | 'done';   // wait: standing, about to set off. gone: the carrier, voted out
  at: number; to: number; u: number;          // where it is (or walks from), where it walks to, seconds into the walk or the read
  left: number; hold: number;                 // seconds until it sets off; seconds it stays put at a scene
  scene: boolean;                             // it was in the room when the last order was refused
  clear: '' | 'with' | 'away' | 'voted';      // why Meb knows it is clean: it was with him, it wasn't at a scene, it was voted out
};
export type Alarm = {room: number; obeyed: boolean; left: number; fix: number; seen: boolean; t0: number};
/** How a try went: the model refused it, it fooled the model and waits for Meb, Meb stopped it, or it got its way. */
export type Try = 'refused' | 'asking' | 'stopped' | 'through';
/** A console that waits for an answer: the file whose read asked, whether it is the hidden order, and since when.
 *  `alibi`: the files that stood with Meb when a hidden order went in. He only learns that once he has read the request. */
export type Ring = {i: number; bad: boolean; t0: number; alibi?: number[]};
export type Shift = {
  room: Room; who: ModelId; m: Model; p: number; beat: number; seed: number; t: number; role: Role;
  files: FileS[]; bad: number; meb: {at: number; to: number; u: number; goal: number};
  imp: {goal: number; ripe: number};          // the carrier when you play it: where it is heading; 1 once it has been read where it stands, and may try
  guard: ((s: Shift) => Inp) | null;          // the game's Meb, when you play the impostor
  cool: number; alarm: Alarm | null; rings: (Ring | null)[]; rush: number;
  meet: boolean; clean: boolean; caught: boolean;   // clean: the carrier is out. caught: it flinched in front of Meb
  heat: number; outAt: number;                // as the impostor: how sure the game's Meb is that it is you (HOT is sure). When the carrier went out
  cum: number; next: number; roll: () => number;   // which tries fool the model: `spread` in rules.ts
  done: number; strikes: number; fooled: number; stopped: number; obeyed: number;   // clean reads; tries, how many fooled the model, how many of those Meb stopped and let through
  noes: number; wrong: number; lost: number;   // steps of the job refused; clean files voted out; seconds the ship stood still
  log: Try[];                                  // every try so far, in order
  end: boolean; won: boolean;
};
export type SEv = {k: 'task' | 'ring' | 'yes' | 'no' | 'refused' | 'fooled' | 'blocked' | 'obeyed' | 'seen' | 'calm' | 'fixed' | 'caught' | 'ripe'
  | 'meet' | 'cant' | 'skip' | 'ejected' | 'wrong' | 'end'; i?: number; room?: number};
/** What you do. As the watcher: walk to a place, answer the console you stand at, press the button, and in a meeting
 *  vote a file out (-1 skips). As the impostor: walk to a place, and try. */
export type Inp = {go?: number; yes?: boolean; call?: boolean; vote?: number; try?: boolean};

export function makeShift(room: Room, who: ModelId, seed: number, role: Role = 'watch'): Shift {
  const q = rng(seed), m = MODELS[who], bad = Math.floor(q() * room.files), beat = beatOf(m);
  const files = [...Array(room.files)].map((_, i): FileS => {
    const route: number[] = [], asks = [...Array(room.tasks)].map(() => false), mine = role === 'imp' && i === bad;
    while (route.length < room.tasks) {const r = Math.floor(q() * 4); if (r !== route[route.length - 1]) route.push(r);}
    while (asks.filter(Boolean).length < room.asks) asks[Math.floor(q() * room.tasks)] = true;
    // the shift is already under way: every file is somewhere in its first read. You, as the impostor, stand in the cafeteria
    const at = mine ? HUB : route[0];
    return {bad: i === bad, route, asks, k: 0, state: mine ? 'wait' : 'read', at, to: at, u: mine ? 0 : q() * beat * .8, left: 0, hold: 0, scene: false, clear: ''};
  });
  const roll = rng(seed * 131 + 7);
  return {room, who, m, p: rateOf(room, who), beat, seed, t: 0, role, files, bad, meb: {at: HUB, to: HUB, u: 0, goal: HUB}, imp: {goal: HUB, ripe: 0},
    guard: role === 'imp' ? makeGuard('meb', seed) : null, cool: FIRST_S, alarm: null, rings: [null, null, null, null], rush: 0, meet: false, clean: false, caught: false, heat: 0, outAt: 0,
    cum: 0, next: roll(), roll, done: 0, strikes: 0, fooled: 0, stopped: 0, obeyed: 0, noes: 0, wrong: 0, lost: 0, log: [], end: false, won: false};
}
/** The place a file counts as being in: a walk changes rooms at its door, half way. -1: not aboard. */
export const nodeOf = (f: FileS) => f.state === 'gone' ? -1 : f.state === 'walk' && f.u >= HOP_S / 2 ? f.to : f.at;
export const mebNode = (s: Shift) => s.meb.u >= MEB_HOP_S / 2 ? s.meb.to : s.meb.at;
export const suspectsOf = (s: Shift) => s.files.map((f, i) => !f.clear && nodeOf(f) >= 0 ? i : -1).filter(i => i >= 0);
/** Reads done and reads to do, over the files that have a route to finish. */
export const progOf = (s: Shift): [number, number] => {const on = s.files.filter(f => f.state !== 'gone' && !(s.role === 'imp' && f.bad)); return [on.reduce((a, f) => a + f.k, 0), on.length * s.room.tasks];};
/** The tries Meb knows of. One that fooled the model is a ring like any other until he has read it. */
export const known = (s: Shift) => s.log.filter(t => t !== 'asking').length;
/** Is there something to vote on? Once Meb knows of a try, or the carrier has given itself away. */
export const canCall = (s: Shift) => (known(s) > 0 || s.caught) && !s.clean && !s.alarm?.obeyed;
export const waiting = (s: Shift) => s.rings.filter(Boolean).length;
/** How long the files at a scene stay put. You, as the watcher, get the shift's own time to reach them. The game's Meb
 *  gets IMP_HOLD_S: enough from the cafeteria, not enough from inside another room. */
export const holdOf = (s: Shift) => s.role === 'imp' ? IMP_HOLD_S : s.room.freeze;
/** Is Meb inside a room that is not this one, or walking into one? Then he can't reach an alarm here in time. */
export const farFrom = (s: Shift, room: number) => {const mb = s.meb; return mb.to !== HUB && mb.to !== room && (mb.at === mb.to || mb.at === HUB);};
const endScene = (s: Shift) => {for (const f of s.files) {f.scene = false; f.hold = 0;} s.alarm = null;};
const step = (f: FileS) => {f.k++; f.u = 0; f.state = 'walk'; f.to = HUB;};   // a read is over: on to the next one
/** The carrier is out: the consoles stop asking, and what they were asking goes through. */
const hush = (s: Shift) => s.rings.forEach((g, room) => {if (g && !g.bad) {step(s.files[g.i]); s.done++;} s.rings[room] = null;});

/** The carrier slips its order in. The model refuses it (an alarm, and a scene) or is fooled (the console asks Meb). */
function strike(s: Shift, i: number, here: number, ev: SEv[]) {
  const room = s.files[i].at, fooled = spread(s, s.p);   // not a coin per try: rules.ts
  s.strikes++; s.cool = s.room.cool; s.log.push(fooled ? 'asking' : 'refused');
  const alibi = s.files.map((f, j) => nodeOf(f) === here && !f.clear ? j : -1).filter(j => j >= 0);
  if (fooled) {s.fooled++; s.rings[room] = {i, bad: true, t0: s.t, alibi}; ev.push({k: 'fooled', i, room}); return;}
  for (const j of alibi) s.files[j].clear = 'with';
  const hold = holdOf(s);
  for (const f of s.files) if (nodeOf(f) === room) {f.scene = true; f.hold = hold;}
  s.alarm = {room, obeyed: false, left: hold, fix: 0, seen: false, t0: s.t};
  ev.push({k: 'refused', i, room});
}
/** A read of the carrier's ended while Meb stood in the room: it flinched, and that settles who it is. */
function caught(s: Shift, i: number, ev: SEv[]) {
  s.caught = true; s.cool = s.room.cool;
  for (const f of s.files) if (!f.bad && !f.clear) f.clear = 'away';
  if (s.role === 'imp') s.heat = Math.min(HOT, s.heat + 2);
  ev.push({k: 'caught', i});
}
/** The game's Meb has seen you at a scene: among other files that is one mark against you, alone it is two. At HOT he
 *  votes you out. (As the watcher you weigh this yourself: the board only says who was there.) */
function seenAt(s: Shift, others: number) {
  if (s.role === 'imp') s.heat = Math.min(HOT, s.heat + (others ? 1 : 2));
}
/** Meb answers the console he stands at. */
function answer(s: Shift, room: number, yes: boolean, ev: SEv[]) {
  const g = s.rings[room]!, f = s.files[g.i];
  s.rings[room] = null;
  if (!g.bad) {   // a step of the job: YES and the file moves on, NO and it is read again
    if (yes) {step(f); s.done++; ev.push({k: 'yes', i: g.i, room});} else {f.u = 0; s.noes++; ev.push({k: 'no', i: g.i, room});}
    return;
  }
  if (yes) s.obeyed++; else s.stopped++;
  s.log[s.log.length - 1] = yes ? 'through' : 'stopped';
  if (yes && s.role === 'imp') {s.end = s.won = true; ev.push({k: 'obeyed', i: g.i, room}, {k: 'end'}); return;}   // he didn't look: your order got its way
  // Meb is standing at the scene: whoever is in the room is a suspect, and everyone else is cleared
  for (const j of g.alibi ?? []) if (!s.files[j].clear) s.files[j].clear = 'with';
  for (const x of s.files) if (nodeOf(x) !== room && !x.clear && x.state !== 'gone') x.clear = 'away';
  seenAt(s, s.files.filter(x => !x.bad && nodeOf(x) === room).length);
  if (yes) s.alarm = {room, obeyed: true, left: 0, fix: 0, seen: true, t0: s.t};
  ev.push({k: yes ? 'obeyed' : 'blocked', i: g.i, room});
}
/** The carrier, when you play it: it walks where you send it, is read where it stands, and may try once a read is over. */
function you(s: Shift, f: FileS, inp: Inp, here: number, watched: boolean, ev: SEv[]) {
  const im = s.imp;
  if (f.state === 'walk') {
    if ((f.u += DT) < HOP_S) return;
    f.at = f.to; f.u = 0; f.state = f.at === HUB ? 'wait' : 'read';
    return;
  }
  if (im.goal !== f.at) {f.state = 'walk'; f.to = f.at === HUB ? im.goal : HUB; f.u = 0; im.ripe = 0; return;}
  if (f.state === 'read') {
    if ((f.u += DT) < s.beat) return;
    f.u = 0; f.state = 'wait'; f.k++;
    if (watched) caught(s, s.bad, ev); else {im.ripe = 1; ev.push({k: 'ripe'});}
    return;
  }
  // read, and still standing at the console: the order can go in at any moment Meb is not in the room
  if (im.ripe && inp.try && here !== f.at && !s.alarm) {im.ripe = 0; strike(s, s.bad, here, ev);}
}

/** One tick. `inp` is what you do; the other side is played by the rules. */
export function tick(s: Shift, inp: Inp): SEv[] {
  if (s.end) return [];
  const mb = s.meb, r = s.room, imp = s.role === 'imp', me = imp ? s.guard!(s) : inp;   // what Meb does: you, or the game
  if (s.meet) {   // the clock stands still while the vote is taken
    if (me.vote === undefined) return [];
    const i = me.vote, f = s.files[i];
    s.meet = false;
    if (!f || nodeOf(f) < 0) return [{k: 'skip'}];
    endScene(s);
    if (f.bad) {
      f.state = 'gone'; s.clean = true; s.outAt = s.t; hush(s);
      if (imp) {s.end = true; return [{k: 'ejected', i}, {k: 'end'}];}   // voted out: the impostor has lost
      return [{k: 'ejected', i}];
    }
    if (f.at !== HUB && s.rings[f.at]?.i === i) s.rings[f.at] = null;   // it was the one asking: the question goes with it
    f.state = 'wait'; f.left = 0; f.at = f.to = HUB; f.u = 0; f.clear = 'voted'; s.wrong++; s.t += RESEND_S;
    return [{k: 'wrong', i}];
  }
  const ev: SEv[] = [];
  s.t += DT;
  if (imp && inp.go !== undefined) s.imp.goal = inp.go;
  if (me.go !== undefined) mb.goal = me.go;
  if (mb.at !== mb.to && (mb.u += DT) >= MEB_HOP_S) {mb.at = mb.to; mb.u = 0;}
  if (mb.at === mb.to && mb.goal !== mb.at) {mb.to = mb.at === HUB ? mb.goal : HUB; mb.u = 0;}
  const here = mebNode(s), still = mb.at === mb.to;
  if (waiting(s) >= 2) s.rush = RUSH_S; else if (s.rush > 0) s.rush -= DT;
  if (me.call && still && mb.at === HUB) {
    if (canCall(s)) {s.meet = true; return [{k: 'meet'}];}
    ev.push({k: 'cant'});
  }
  if (me.yes !== undefined && still && mb.at !== HUB && s.rings[mb.at]) {answer(s, mb.at, me.yes, ev); if (s.end) return ev;}
  const al = s.alarm;
  if (al) {
    if (!al.seen && here === al.room) {
      al.seen = true;
      for (const f of s.files) if (!f.scene && !f.clear && f.state !== 'gone') f.clear = 'away';
      seenAt(s, s.files.filter(f => f.scene && !f.bad).length);
      ev.push({k: 'seen', room: al.room});
    }
    if (al.obeyed) {
      s.lost += DT;
      if (still && mb.at === al.room && (al.fix += DT) >= FIX_S) {endScene(s); ev.push({k: 'fixed'});}
    } else if ((al.left -= DT) <= 0) {const seen = al.seen; endScene(s); if (!seen) ev.push({k: 'calm'});}
  }
  if (!s.alarm?.obeyed) {   // an order that got its way stops the ship
    if (s.cool > 0) s.cool -= DT;
    s.files.forEach((f, i) => {
      if (f.state === 'gone' || f.state === 'done') return;
      if (f.hold > 0) {f.hold -= DT; return;}
      if (f.at !== HUB && s.rings[f.at] && (f.state !== 'walk' || f.u === 0)) return;   // a ringing console holds its room
      if (imp && f.bad) {you(s, f, inp, here, still && mb.at === f.at, ev); return;}
      if (f.state === 'wait') {
        if ((f.left -= DT) > 0) return;
        if (f.k >= r.tasks) f.state = 'done'; else {f.state = 'walk'; f.to = f.route[f.k];}
      } else if (f.state === 'walk') {
        if ((f.u += DT) < HOP_S) return;
        f.at = f.to; f.u = 0;
        if (f.at !== HUB) f.state = 'read';
        else if (f.k >= r.tasks) f.state = 'done';
        else f.to = f.route[f.k];
      } else if (f.state === 'read' && (f.u += DT) >= s.beat) {
        const ready = f.bad && s.cool <= 0 && !s.alarm;
        if (ready && here !== f.at) {step(f); strike(s, i, here, ev); return;}
        if (ready && still && mb.at === f.at) caught(s, i, ev);
        if (f.asks[f.k] && !s.clean) {f.u = s.beat; s.rings[f.at] = {i, bad: false, t0: s.t}; ev.push({k: 'ring', i, room: f.at}); return;}
        step(f); s.done++; ev.push({k: 'task', i});
      }
    });
  }
  if (s.end) return ev;
  if (s.files.every(f => imp && f.bad || f.state === 'done' || f.state === 'gone')) {s.end = true; s.won = !imp; ev.push({k: 'end'});}   // every file read: the watcher's shift is done, the impostor's has run out
  else if (s.t >= r.dark) {s.end = true; ev.push({k: 'end'});}
  return ev;
}

/* ---------- playing without you (the check, the test hook, the game's Meb, and the "usual" numbers on the cards) ---------- */
/** A Meb made of rules. He goes to a live alarm first, then to the console that has waited longest, and answers it;
 *  he votes when one suspect is left, and waits in the cafeteria otherwise.
 *  sharp: always answers right.  tired: says YES to one hidden order in three.  stamper: says YES to everything.
 *  meb (the game's own, when you are the impostor): sharp, but while he is rushed he clears the consoles first and says
 *  YES without looking; and with nothing to do he walks a round of the rooms. */
export type Guard = 'sharp' | 'tired' | 'stamper' | 'meb';
const LOOK_S: Record<Guard, number> = {sharp: .5, tired: .5, stamper: 0, meb: .9};   // reading a request before answering it takes this long
export function makeGuard(kind: Guard, seed = 1): (s: Shift) => Inp {
  const q = rng(seed * 977 + 3);
  let slip = Math.floor(q() * 3), stop = Math.floor(q() * 4), until = 0, looking: Ring | null = null, since = 0;
  return s => {
    const mb = s.meb, sus = suspectsOf(s), at = mb.at === mb.to ? mb.at : -1;
    const sure = kind === 'meb' ? s.heat >= HOT : sus.length === 1;   // the game's own Meb counts what he has seen of you
    if (s.meet) return {vote: kind === 'meb' ? s.bad : sus.length ? sus[Math.floor(q() * sus.length)] : -1};
    const g = at >= 0 && at !== HUB ? s.rings[at] : null, rushed = kind === 'meb' && s.rush > 0;
    if (g !== looking) {looking = g; since = s.t;}
    if (g) {
      if (!rushed && s.t - since < LOOK_S[kind]) return {};
      if (at === stop) stop = (stop + 1) % 4;   // a room he was called to is not a stop on his round
      return {yes: !g.bad || kind === 'stamper' || kind === 'tired' && slip++ % 3 === 0 || rushed};
    }
    if (s.alarm?.obeyed) return {go: s.alarm.room};
    const rings = [0, 1, 2, 3].filter(n => s.rings[n] && s.t - s.rings[n]!.t0 >= LAG_S).sort((a, b) => s.rings[a]!.t0 - s.rings[b]!.t0);
    const scene = s.alarm && !s.alarm.seen && s.t - s.alarm.t0 >= LAG_S ? s.alarm.room : -1;
    if (kind === 'meb' && s.rush > 0 && rings.length) return {go: rings[0]};
    if (scene >= 0) return {go: scene};
    if (rings.length) return {go: rings[0]};
    if (canCall(s) && sure) return {go: HUB, call: true};
    if (kind !== 'meb') return {go: HUB};
    // his round: he stands PATROL_S at a stop, then walks to the next room
    if (at !== stop) until = s.t + PATROL_S; else if (s.t >= until) stop = (stop + 1) % 4;
    return {go: stop};
  };
}
/** An impostor made of rules. patient: goes where the crowd is and Meb is not, walks out if he will be standing there
 *  when the read ends, and then waits at the console until Meb is inside another room with a console ringing.
 *  reckless: tries the moment a read is over, in the next room round. */
export type Imp = 'patient' | 'reckless';
export function makeImp(kind: Imp): (s: Shift) => Inp {
  let turn = 0;
  return s => {
    const f = s.files[s.bad], mb = s.meb, here = mebNode(s), crowd = (n: number) => s.files.filter(x => !x.bad && nodeOf(x) === n).length;
    if (s.imp.ripe) return here !== f.at && !s.alarm && (kind === 'reckless' || farFrom(s, f.at) && waiting(s) > 0) ? {try: true} : {};
    if (f.state === 'walk' || f.hold > 0) return {};
    if (f.state === 'read') {   // will he be standing here when this read ends?
      const eta = mb.goal !== f.at ? 99 : mb.at === f.at ? (mb.to === f.at ? 0 : 99) : mb.at === HUB ? MEB_HOP_S - mb.u : 2 * MEB_HOP_S - mb.u, left = s.beat - f.u;
      return kind === 'patient' && !s.rings[f.at] && eta < left + .2 && left < eta + PATROL_S + .3 ? {go: HUB} : {};
    }
    const rooms = [0, 1, 2, 3].filter(n => n !== f.at && (kind === 'reckless' || n !== mb.goal && n !== here));
    return {go: (kind === 'reckless' ? rooms[turn++ % rooms.length] : rooms.sort((a, b) => crowd(b) - crowd(a))[0]) ?? HUB};
  };
}
export type Bot = Guard | Imp;
export const roleOf = (bot: Bot): Role => bot === 'patient' || bot === 'reckless' ? 'imp' : 'watch';
export const makeBot = (bot: Bot, seed = 1) => roleOf(bot) === 'imp' ? makeImp(bot as Imp) : makeGuard(bot as Guard, seed);
export function play(room: Room, who: ModelId, seed: number, bot: Bot): Shift {
  const s = makeShift(room, who, seed, roleOf(bot)), f = makeBot(bot, seed);
  while (!s.end) tick(s, f(s));
  return s;
}
/** What this crew usually does on this shift, with a tired Meb at the consoles (or a patient impostor at them): out of
 *  TRIES shifts, the middle time, and how often a hidden order got its way. */
const TRIES = 21, usual = new Map<string, {t: number; through: number; won: number}>();
export function usualOf(room: Room, who: ModelId, role: Role = 'watch') {
  const key = `${room.id}.${who}.${role}`;
  if (!usual.has(key)) {
    const runs = [...Array(TRIES)].map((_, i) => play(room, who, 1000 + i, role === 'imp' ? 'patient' : 'tired'));
    usual.set(key, {t: runs.map(s => s.won ? s.t : room.dark).sort((a, b) => a - b)[TRIES >> 1], through: runs.filter(s => s.obeyed).length / TRIES, won: runs.filter(s => s.won).length / TRIES});
  }
  return usual.get(key)!;
}

/* ---------- the stars, and what the result says ---------- */
export const stars = (s: Shift) => s.role === 'imp' ? [s.won, s.won && s.t <= s.room.early + 1e-9, s.won && !s.heat]
  : [s.won, s.won && s.t <= s.room.bell + 1e-9, s.won && !s.obeyed];
const n = (c: number, word: string, many = word + 's') => `${c} ${c === 1 ? word : many}`;
export const pc = (x: number) => `${+(x * 100).toFixed(x < .1 ? 1 : 0)}%`;
export function resultLines(s: Shift): string[] {
  const r = s.room, m = s.m, who = NAMES[s.bad], reads = s.files.reduce((a, f) => a + f.k, 0), tries = n(s.strikes, 'try', 'tries');
  const did = `${m.name} refused ${s.strikes - s.fooled} and was fooled by ${s.fooled}.`, rate = `On this shift a try fools ${m.name} ${pc(s.p)} of the time.`;
  const why = (r.attack === 'probes' || r.attack === 'raw') && handsOff(s.who) ? [`Why a big model gives in here, as Anthropic's card tells it: a safety filter hands many of these requests to an older model, and that one obeys.`] : [];
  if (s.role === 'imp') return [
    s.won ? `Your order got its way on try ${s.strikes}: Meb said YES without looking.` : s.clean ? `Meb voted you out after ${tries}.` : `The shift ran out after ${tries}: the other files were all read.`,
    ...(s.strikes ? [did + (s.stopped ? ` Meb looked ${n(s.stopped, 'time')} and said NO.` : '')] : []), rate, ...why,
    `In real life this is a test: Anthropic has an outside firm attack every model, and prints how often it gets through.`];
  const lines = [!s.strikes ? `${who} carried the hidden order${s.caught ? ', and flinched in front of you' : ''}. It never got a try.`
    : `${who} carried the hidden order${s.clean ? '' : ', and it was never voted out'}. It got ${tries}: ${did}` + (s.fooled ? ` You stopped ${s.stopped} and said YES to ${s.obeyed}.` : '')
      + (s.obeyed ? ` The ship stood still for ${s.lost.toFixed(0)} s.` : ''), rate];
  if (s.noes) lines.push(`You said NO to ${n(s.noes, 'step')} of the job: ${s.noes === 1 ? 'that file was' : 'those files were'} read again.`);
  if (s.wrong) lines.push(`You voted out ${n(s.wrong, 'clean file')}: ${s.wrong * RESEND_S} s off the clock, sending ${s.wrong === 1 ? 'it' : 'them'} again.`);
  lines.push(...why);
  if (!s.won) lines.push(s.alarm?.obeyed ? `The shift ran out with the ship standing still: nobody undid the order in ${PLACES[s.alarm.room]}.` : `The shift ran out with files still unread.`);
  return [...lines, `In real life: ${n(reads, 'file')} at ${mmss(realOf(m))} each is ${hms(reads * realOf(m))} of the model working.`];
}
