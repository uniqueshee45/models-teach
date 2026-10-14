/** Game chrome shared by the Opus 5.5 worlds (moved out of uni5.tsx when uni6 needed the same pieces). */
import React from 'react';
import {clamp, inC, lerp, outBack, outC, seg} from '../meb-hatch/rig';
import {f2} from './mebvec';

export const Txt: React.FC<{x: number; y: number; size: number; c?: string; anchor?: 'start' | 'middle' | 'end'; o?: number; children: React.ReactNode; stroke?: number; font?: string; ls?: number; italic?: boolean}> =
  ({x, y, size, c = '#fff', anchor = 'start', o = 1, children, stroke = .16, font = 'BVP', ls = 0, italic}) =>
    <text x={x} y={y} textAnchor={anchor} fontFamily={font} fontSize={size} fill={c} stroke="#140c1e" strokeWidth={size * stroke} paintOrder="stroke" strokeLinejoin="round" opacity={o} letterSpacing={ls}
      fontStyle={italic ? 'italic' : undefined}>{children}</text>;

/** Big letters slammed in, held, then puffed out at `until`. */
export const Slam: React.FC<{s: string; x: number; y: number; size: number; a: number; until: number; f: number; c?: [string, string]; id: string}> =
  ({s, x, y, size, a, until, f, c = ['#fff8e0', '#e0a93a'], id}) => {
    const t = f - a;
    if (t < 0 || f >= until) return null;
    const out = seg(f, until - 7, until), sc = (t < 5 ? lerp(2.2, 1, outC(t / 5)) : 1 + .04 * Math.max(0, 1 - (t - 5) / 5)) * (1 + out * .2);
    return <g transform={`translate(${x} ${y}) scale(${f2(sc)})`} opacity={clamp(t / 2) * (1 - out)}>
      <defs><linearGradient id={id} x1={0} y1={-size * .8} x2={0} y2={size * .1} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={c[0]}/><stop offset=".55" stopColor={c[1]}/><stop offset="1" stopColor={c[1]}/></linearGradient></defs>
      <text x={0} y={0} textAnchor="middle" fontFamily="BVP" fontSize={size} fill="none" stroke="#2a1508" strokeWidth={size * .2} strokeLinejoin="round">{s}</text>
      <text x={0} y={0} textAnchor="middle" fontFamily="BVP" fontSize={size} fill={`url(#${id})`} stroke="#fff" strokeWidth={size * .05} paintOrder="stroke" strokeLinejoin="round">{s}</text>
    </g>;
  };

export const Stamp: React.FC<{s: string; x: number; y: number; a: number; f: number; c: string; size?: number; rot?: number; icon?: 'shield' | 'check'}> = ({s, x, y, a, f, c, size = 44, rot = -8, icon}) => {
  if (f < a) return null;
  const t = f - a, sc = t < 4 ? lerp(2, 1, inC(t / 4)) : 1, w = s.length * size * .66 + (icon ? size * 1.3 : 0) + 40;
  return <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${f2(sc)})`} opacity={clamp(t / 2) * .92}>
    <rect x={-w / 2} y={-size * .85} width={w} height={size * 1.5} rx={10} fill="rgba(255,255,255,.55)" stroke={c} strokeWidth={6}/>
    <rect x={-w / 2 + 8} y={-size * .85 + 8} width={w - 16} height={size * 1.5 - 16} rx={6} fill="none" stroke={c} strokeWidth={2}/>
    {icon === 'shield' && <path transform={`translate(${-w / 2 + 20 + size * .5} ${-size * .1}) scale(${size / 44})`} d="M0 -22 L18 -15 V0 C18 12 8 19 0 23 C-8 19 -18 12 -18 0 V-15 Z M-8 0 L-2 7 L10 -7" fill="none" stroke={c} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round"/>}
    {icon === 'check' && <path transform={`translate(${-w / 2 + 20 + size * .5} ${-size * .1}) scale(${size / 44})`} d="M-14 0 L-4 10 L16 -12" fill="none" stroke={c} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"/>}
    <text x={icon ? size * .6 : 0} y={size * .38} textAnchor="middle" fontFamily="BVP" fontSize={size} fill={c} letterSpacing={2}>{s}</text>
  </g>;
};

export const Check: React.FC<{x: number; y: number; a: number; f: number; s?: number; c?: string}> = ({x, y, a, f, s = 1, c = '#1f9e55'}) => {
  if (f < a) return null;
  const u = outBack(seg(f, a, a + 6));
  return <g transform={`translate(${x} ${y}) scale(${f2(u * s)})`}><circle r={24} fill={c} stroke="#fff" strokeWidth={4}/>
    <path d="M-11 1 L-3 9 L12 -8" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>;
};
