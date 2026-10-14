/** The video's own sound effects (episodes/opus-55-update/sfx, copied into dist/sfx by build.cjs). */
export const SOUNDS = ['beep', 'go', 'zap', 'fail', 'whoosh', 'hit', 'nitro', 'ding', 'victory', 'drain', 'buzz', 'select', 'blip', 'engine',
  'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5', 'maxup', 'swish', 'jab', 'smack', 'beam', 'explode', 'parry', 'hurt', 'ko', 'bossland',
  'place', 'scan', 'tick', 'break', 'land', 'alarm', 'eject', 'pop', 'check', 'key', 'slam', 'stamp', 'door', 'coin', 'sale', 'paper',
  'gavel', 'deskslam', 'shout', 'talk', 'present', 'verdict', 'rip'];   // the arena's, from lvl1; the blocks', from place; the ship's, from alarm; the cards' and menus', from pop; the court's, from gavel (build.cjs reads this list: no comment inside it)

let muted = false;
try {muted = localStorage.getItem('pym.muted') === '1';} catch {}
export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try {localStorage.setItem('pym.muted', muted ? '1' : '0');} catch {}
  for (const a of loops.values()) a.muted = muted;
}

const base = new Map<string, HTMLAudioElement>();
/** One-shot: a fresh copy each time, so repeats overlap. */
export function sfx(name: string, vol = .5) {
  if (muted) return;
  let a = base.get(name);
  if (!a) {a = new Audio(`sfx/${name}.wav`); base.set(name, a);}
  const c = a.cloneNode() as HTMLAudioElement;
  c.volume = vol; c.play().catch(() => {});
}

const loops = new Map<string, HTMLAudioElement>();
/** A looping bed: the engine, the music. vol 0 stops it. */
export function loop(file: string, vol: number, rate = 1) {
  let a = loops.get(file);
  if (!a) {a = new Audio(`sfx/${file}`); a.loop = true; a.muted = muted; loops.set(file, a);}
  a.volume = Math.max(0, Math.min(1, vol));
  a.playbackRate = rate;
  if (vol > 0 && a.paused) a.play().catch(() => {});
  if (vol <= 0 && !a.paused) {a.pause(); a.currentTime = 0;}
}
