/**
 * The menus' kit: the screens before and after a game (pickers, results, the cards, the numbers page). Be Vietnam Pro
 * in two weights. The arena's menus copy a fighting game (the user's "Do A", 2026-10-05, DESIGN-menus.md): gold slanted
 * main button (`Hit`), drawn stars, numbers as gauges. The playing screens keep race.tsx's own kit (Btn, GLASS, GameText).
 * Behind a menu the world is blurred once (WORLD_BLUR on the world's layer, which stops drawing), so a panel is only
 * a tint over it: no backdrop filter to recompute every frame on a phone.
 */
import React, {useEffect} from 'react';
import {TOUCH} from './race';
import {MODELS, SYSTEM_CARDS} from './stats';
import type {ModelId} from './stats';

export const UI = "'GV', system-ui, sans-serif";   // @font-face in main.tsx: 500 and 700
/** A tap target's height on the 1920 stage: 100 on a touch screen is 36 to 44 px on a phone held sideways. */
export const TAP = TOUCH ? 100 : 72;
export const MUTE = 'rgba(255,255,255,.68)', GOLD = '#ffc93f', INK = '#1b1033';
/** A thick outline round big title letters, as text-shadows. */
export const outline = (c: string, w: number) => [...Array(16)].map((_, i) => {const a = i / 16 * Math.PI * 2; return `${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${c}`;}).join(',');
export const WORLD_BLUR: React.CSSProperties = {filter: 'blur(14px) brightness(.55) saturate(1.15)'};
export const glass = (on = false): React.CSSProperties => ({background: on ? 'rgba(255,255,255,.17)' : 'rgba(24,18,48,.5)', border: `2.5px solid ${on ? '#fff' : 'rgba(255,255,255,.16)'}`,
  borderRadius: 28, boxSizing: 'border-box', color: '#fff'});
export const txt = (size: number, weight: 500 | 700 = 500, color = '#fff'): React.CSSProperties => ({fontFamily: UI, fontSize: size, fontWeight: weight, color, lineHeight: 1.25});

/** "SPEND $15.00 OR LESS" → "Spend $15.00 or less", keeping names: the rules write in capitals for the HUD. */
const NAMES = /\b(claude|anthropic|opus|sonnet|haiku|fable|gray swan|html)\b/g;
export const cap = (s: string) => s.toLowerCase().replace(NAMES, w => w === 'html' ? 'HTML' : w.replace(/\b\w/g, c => c.toUpperCase()))
  .replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
export const nm = (id: ModelId) => MODELS[id].real.replace('Claude ', '');

export type IconName = 'back' | 'arrow' | 'help' | 'retry' | 'map' | 'list' | 'close' | 'clock' | 'target' | 'coin' | 'users' | 'check' | 'cross';
const PATH: Record<IconName, string> = {
  back: 'M15 5 L8 12 L15 19', arrow: 'M5 12 H19 M13 6 L19 12 L13 18', close: 'M6 6 L18 18 M18 6 L6 18', list: 'M5 7 H19 M5 12 H19 M5 17 H14',
  help: 'M12 3 A9 9 0 1 1 11.99 3 M9.6 9.6 A2.5 2.5 0 1 1 13 11.9 C12.4 12.2 12 12.7 12 13.4 V14',
  retry: 'M19 12 A7 7 0 1 1 16.9 7 M17.5 3.5 V7.5 H13.5', map: 'M4 7 L9 5 L15 7 L20 5 V17 L15 19 L9 17 L4 19 Z M9 5 V17 M15 7 V19', clock: 'M12 3 A9 9 0 1 1 11.99 3 M12 7.5 V12 L15 14',
  target: 'M12 3 A9 9 0 1 1 11.99 3 M12 7.5 A4.5 4.5 0 1 1 11.99 7.5', check: 'M5 12.5 L10 17 L19 7', cross: 'M6 6 L18 18 M18 6 L6 18',
  coin: 'M12 3 A9 9 0 1 1 11.99 3 M14.5 9 C14 8 13 7.6 12 7.6 C10.5 7.6 9.6 8.4 9.6 9.4 C9.6 12 14.6 11 14.6 13.8 C14.6 15 13.4 15.8 12 15.8 C10.8 15.8 9.8 15.2 9.4 14.2 M12 6 V7.6 M12 15.8 V17.5',
  users: 'M9 11 A3.5 3.5 0 1 0 9 4 A3.5 3.5 0 1 0 9 11 M3 20 C3 16 6 14 9 14 S15 16 15 20 M16 4.5 A3.5 3.5 0 0 1 16 11 M18 14 C20 15 21 17 21 20'};
const DOT: Partial<Record<IconName, [number, number]>> = {help: [12, 17.2], target: [12, 12]};
export const Icon: React.FC<{name: IconName; size?: number; w?: number}> = ({name, size = 32, w = 2.2}) => <svg width={size} height={size} viewBox="0 0 24 24" style={{flex: 'none'}}>
  <path d={PATH[name]} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/>
  {DOT[name] && <circle cx={DOT[name]![0]} cy={DOT[name]![1]} r={1.3} fill="currentColor"/>}</svg>;

/** A tap target. `main` is the screen's one white button; with no label it is a round icon button. */
export const Button: React.FC<{label?: string; icon?: IconName; act: () => void; main?: boolean; style?: React.CSSProperties}> = ({label, icon, act, main, style}) =>
  <div data-ui="btn" onClick={e => {e.stopPropagation(); act();}} style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'pointer', whiteSpace: 'nowrap',
    boxSizing: 'border-box', borderRadius: 999, height: main ? 104 : TAP, padding: label ? `0 ${main ? 54 : 30}px` : 0, width: label ? undefined : TAP,
    ...(main ? {background: '#fff', color: '#1b1630'} : glass()), ...txt(main ? 40 : 27, 700, main ? '#1b1630' : '#fff'), ...style}}>
    {icon && icon !== 'arrow' && <Icon name={icon} size={main ? 40 : 32}/>}{label}{icon === 'arrow' && <Icon name={icon} size={main ? 40 : 32}/>}</div>;

/** The screen's one main action, as a fighting game draws it: gold, slanted, chunky. */
export const Hit: React.FC<{label: string; icon?: IconName; act: () => void; size?: number; style?: React.CSSProperties}> = ({label, icon, act, size = 46, style}) =>
  <div data-ui="btn" onClick={e => {e.stopPropagation(); act();}} style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'pointer', whiteSpace: 'nowrap',
    boxSizing: 'border-box', height: Math.max(TAP, size * 2.2), padding: `0 ${size}px`, borderRadius: 16, background: GOLD, transform: 'skewX(-10deg)', boxShadow: '0 10px 0 #a87400', ...txt(size, 700, INK), ...style}}>
    {icon && icon !== 'arrow' && <Icon name={icon} size={size * .9} w={3}/>}{label}{icon === 'arrow' && <Icon name={icon} size={size * .9} w={3}/>}</div>;

const STAR = 'M' + [...Array(10)].map((_, i) => {const r = i % 2 ? 44 : 100, a = -Math.PI / 2 + i * Math.PI / 5; return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;}).join('L') + 'Z';
/** One drawn star: gold with a dark edge when earned, a dim shape when not. */
export const Star: React.FC<{on: boolean; size: number; rot?: number; off?: string}> = ({on, size, rot = 0, off = 'rgba(255,255,255,.16)'}) =>
  <svg width={size} height={size} viewBox="-118 -118 236 236" style={{flex: 'none', transform: rot ? `rotate(${rot}deg)` : undefined}}>
    <path d={STAR} fill={on ? GOLD : off} stroke={INK} strokeWidth={14} strokeLinejoin="round"/>
    {on && <path d="M-38 -28 L-14 -58" stroke="#fff" strokeWidth={13} strokeLinecap="round" opacity={.75}/>}</svg>;
export const Stars: React.FC<{n: number; size: number; off?: string}> = ({n, size, off}) => <span style={{display: 'inline-flex'}}>{[0, 1, 2].map(i => <Star key={i} on={i < n} size={size} off={off}/>)}</span>;
/** A number, a quote's byline or a source line, as a link to the page it was read from, in a new tab. The click goes
 *  no further: a card under it would take it as "next", a sheet or the numbers page as "close".
 *  The tab is asked for by script, not left to target="_blank" (the user, 2026-10-12: "open a new tab, and keep our
 *  tab"): the Claude app's browser pane loads a plain new-tab link over the page that held it, and the game was gone.
 *  window.open with a features string gets a real new tab there, and an ordinary new tab in a browser (noopener and
 *  noreferrer are not window features, so no browser makes a pop-up window of it). The href stays for a right-click. */
export const Proof: React.FC<{to: string; children: React.ReactNode; style?: React.CSSProperties}> = ({to, children, style}) =>
  <a href={to} target="_blank" rel="noopener noreferrer" onClick={e => {e.stopPropagation(); e.preventDefault(); window.open(to, '_blank', 'noopener,noreferrer');}}
    style={{color: 'inherit', textDecoration: 'underline', textDecorationColor: 'rgba(143,211,255,.75)', textUnderlineOffset: 4, ...style}}>{children}</a>;
/** "Opus 5.5, Sonnet 5.5, Fable 5.1 and Haiku 5.5", each name a link to its system card: where the ship's numbers are. */
export const SystemCards: React.FC = () => <>{SYSTEM_CARDS.map(([name, to], i, a) => <React.Fragment key={name}>{i ? i === a.length - 1 ? ' and ' : ', ' : ''}<Proof to={to}>{name}</Proof></React.Fragment>)}</>;
/** One quiet line of keys at the foot, where there is a keyboard. */
export const Keys: React.FC<{text: string}> = ({text}) => TOUCH ? null :
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', pointerEvents: 'none', ...txt(22, 500, 'rgba(255,255,255,.5)')}}>{text}</div>;
/** A sheet over the menu, for what stays off the face: a table, the breakdown. Tap anywhere to close. */
export const Sheet: React.FC<{title: string; close: () => void; children: React.ReactNode}> = ({title, close, children}) => {
  useEffect(() => {   // ahead of the screen's own keys: Esc or Enter closes the sheet, nothing else
    const kd = (e: KeyboardEvent) => {if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {e.preventDefault(); e.stopImmediatePropagation(); close();}};
    addEventListener('keydown', kd, true); return () => removeEventListener('keydown', kd, true);
  }, []);
  return <div onClick={close} style={{position: 'absolute', inset: 0, zIndex: 4, background: 'rgba(8,6,20,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <div onClick={e => e.stopPropagation()} style={{...glass(), background: 'rgba(26,20,50,.97)', padding: '40px 56px 48px', minWidth: 900, maxWidth: 1600, position: 'relative'}}>
      <Button icon="close" act={close} style={{position: 'absolute', right: 24, top: 24}}/>
      <div style={{...txt(44, 700), marginBottom: 24, paddingRight: 90}}>{title}</div>{children}</div></div>;
};
