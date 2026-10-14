/** The video's shared files (meb-hatch/rig, opus55/split) import AbsoluteFill from Remotion; build.cjs points
 *  'remotion' here, so the game ships none of it. */
import React from 'react';
export const AbsoluteFill: React.FC<{style?: React.CSSProperties; children?: React.ReactNode}> = ({style, children}) =>
  <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;
