/**
 * Universe four's stages, in plain three.js (see memory three-inside-remotion): a grid-lined training room and a
 * city rooftop at dusk. build() makes both ONCE; render(state) picks one and places the camera. Everything that
 * fights is SVG drawn over this canvas through the same camera (uni4.tsx), so nothing here moves but the sky.
 * One unit = one metre; the floor of both stages is y = 0 and the fighters stand on z = 0.
 */
import * as THREE from 'three';

export type V3 = [number, number, number];
export type Set = 'train' | 'roof';
export type State = {f: number; set: Set; cam: {pos: V3; look: V3; fov: number}};

/* ---------- seeded helpers ---------- */
let seed = 11;
const rnd = () => {seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646;};
const col = (c: string) => new THREE.Color(c);
const canvasTex = (w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/* ---------- the training room: a grid, one line a metre ---------- */
const gridTex = (base: string, line: string, major: string) => canvasTex(512, 512, c => {
  c.fillStyle = base; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {c.fillStyle = `rgba(0,0,0,${rnd() * .035})`; c.fillRect(rnd() * 512, rnd() * 512, 3, 3);}
  for (let k = 0; k < 4; k++) {  // 4 m per tile; the first line of each tile is the heavy one
    c.fillStyle = k === 0 ? major : line;
    const w = k === 0 ? 6 : 3;
    c.fillRect(k * 128 - w / 2, 0, w, 512); c.fillRect(0, k * 128 - w / 2, 512, w);
  }
  c.fillStyle = major; c.fillRect(509, 0, 3, 512); c.fillRect(0, 509, 512, 3);
});

/* ---------- the rooftop ---------- */
const concreteTex = () => canvasTex(512, 512, c => {
  c.fillStyle = '#6a6070'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {  // stains
    const x = rnd() * 512, y = rnd() * 512, r = 20 + rnd() * 70, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(30,20,40,${.05 + rnd() * .12})`); g.addColorStop(1, 'rgba(30,20,40,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 9000; i++) {c.fillStyle = rnd() < .5 ? `rgba(255,255,255,${rnd() * .05})` : `rgba(0,0,0,${rnd() * .07})`; c.fillRect(rnd() * 512, rnd() * 512, 2, 2);}
  c.fillStyle = '#453d4c';  // slab seams every 2 m
  for (const p of [0, 256]) {c.fillRect(p, 0, 4, 512); c.fillRect(0, p, 512, 4);}
  c.strokeStyle = 'rgba(40,30,50,.5)'; c.lineWidth = 1.5;  // two hairline cracks
  for (let k = 0; k < 2; k++) {let x = rnd() * 512, y = rnd() * 512; c.beginPath(); c.moveTo(x, y); for (let i = 0; i < 12; i++) {x += (rnd() - .3) * 26; y += (rnd() - .5) * 26; c.lineTo(x, y);} c.stroke();}
});
const windowTex = () => canvasTex(128, 256, c => {  // a facade 8 m wide, 16 m tall: 4 columns, 8 floors
  c.fillStyle = '#231a38'; c.fillRect(0, 0, 128, 256);
  for (let fl = 0; fl < 8; fl++) for (let k = 0; k < 4; k++) {
    const on = rnd() < .38, warm = rnd() < .75;
    c.fillStyle = on ? (warm ? ['#ffcf8a', '#ffb866', '#ffe2a8'][Math.floor(rnd() * 3)] : '#9fd8ff') : '#171126';
    c.fillRect(k * 32 + 7, fl * 32 + 9, 18, 16);
  }
});
const glowOnly = (src: THREE.CanvasTexture) => {  // the same windows, with only the lit ones left: the emissive map
  const s = src.image as HTMLCanvasElement, cv = document.createElement('canvas'); cv.width = s.width; cv.height = s.height;
  const c = cv.getContext('2d')!; c.drawImage(s, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height);
  for (let i = 0; i < d.data.length; i += 4) {const lum = d.data[i] + d.data[i + 1] + d.data[i + 2]; if (lum < 300) d.data[i] = d.data[i + 1] = d.data[i + 2] = 0;}
  c.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const neonTex = () => canvasTex(512, 256, c => {  // a billboard: a lightning bolt and a ring in neon tubes
  c.fillStyle = '#12091f'; c.fillRect(0, 0, 512, 256);
  const tube = (col: string, draw: () => void) => {c.strokeStyle = col; c.lineJoin = c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 24; c.lineWidth = 12; draw(); c.shadowBlur = 0; c.strokeStyle = '#ffffff'; c.lineWidth = 4; draw();};
  tube('#ff4f9a', () => {c.beginPath(); c.moveTo(150, 30); c.lineTo(95, 135); c.lineTo(150, 135); c.lineTo(110, 230); c.lineTo(215, 105); c.lineTo(160, 105); c.lineTo(205, 30); c.closePath(); c.stroke();});
  tube('#4fe3ff', () => {c.beginPath(); c.arc(360, 128, 78, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(360, 128, 40, 0, Math.PI * 2); c.stroke();});
});

export type Rig = ReturnType<typeof build>;
export function build(canvas: HTMLCanvasElement, W: number, H: number) {
  seed = 11;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, W / H, .1, 1500);
  const train = new THREE.Group(), roof = new THREE.Group();
  scene.add(train, roof);
  const lam = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial(o);

  /* ----- training room ----- */
  {
    const floorT = gridTex('#c4ccd9', '#99a4b6', '#6d7a90'); floorT.repeat.set(16, 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 32).rotateX(-Math.PI / 2), lam({map: floorT}));
    floor.position.set(0, 0, 6); train.add(floor);
    const wallT = gridTex('#d5dbe5', '#b0b9c8', '#8c97aa'); wallT.repeat.set(16, 4);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(64, 16), lam({map: wallT}));
    wall.position.set(0, 8, -8); train.add(wall);
    const base = new THREE.Mesh(new THREE.BoxGeometry(64, .35, .2), lam({color: '#8a95a8'}));
    base.position.set(0, .175, -7.9); train.add(base);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(64, .12, .05), lam({color: '#ffd23f', emissive: '#6a5000', emissiveIntensity: .4}));
    stripe.position.set(0, 2.4, -7.9); train.add(stripe);
    train.add(new THREE.HemisphereLight('#ffffff', '#8d96a8', 1.5));
    const key = new THREE.DirectionalLight('#ffffff', 1.1); key.position.set(-4, 9, 10); train.add(key, key.target);
  }

  /* ----- rooftop at dusk ----- */
  const SUN = new THREE.Vector3(.1, .045, -1).normalize();
  const skyU = {sun: {value: SUN}};
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), new THREE.ShaderMaterial({uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 sun; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(vec3(1.0, .62, .36), vec3(.95, .42, .45), smoothstep(.0, .09, h));
        c = mix(c, vec3(.56, .25, .52), smoothstep(.07, .26, h));
        c = mix(c, vec3(.16, .11, .34), smoothstep(.22, .62, h));
        if (h < 0.0) c = mix(vec3(1.0, .62, .36), vec3(.42, .2, .38), smoothstep(0.0, -.15, h));
        float s = max(dot(d, sun), 0.0);
        c += vec3(1.0, .75, .45) * pow(s, 10.0) * .55 + vec3(1.0, .85, .6) * pow(s, 90.0) * .8;
        c = mix(c, vec3(1.0, .96, .82), smoothstep(.9985, .9992, s));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`}));
  roof.add(dome);
  // cloud streaks low over the city, lit from underneath by the sun
  const streakT = canvasTex(512, 64, c => {
    for (let i = 0; i < 26; i++) {const x = rnd() * 400, y = 10 + rnd() * 44, w = 80 + rnd() * 260, h = 3 + rnd() * 7, g = c.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, 'rgba(255,190,170,0)'); g.addColorStop(.5, `rgba(255,${170 + rnd() * 50},${150 + rnd() * 40},${.35 + rnd() * .4})`); g.addColorStop(1, 'rgba(255,190,170,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x + w / 2, y, w / 2, h, 0, 0, Math.PI * 2); c.fill();}
  });
  streakT.wrapS = streakT.wrapT = THREE.ClampToEdgeWrapping;
  const clouds: THREE.Mesh[] = [];
  [[-200, 150, -800, 900, 110], [260, 95, -780, 700, 80], [0, 60, -760, 1100, 70], [-420, 210, -700, 600, 90]].forEach(([x, y, z, w, h]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: streakT, transparent: true, depthWrite: false, fog: false}));
    m.position.set(x, y, z); roof.add(m); clouds.push(m);
  });
  // the city: three rows of towers, the ground far below (y = -60), windows lit
  const wT = windowTex(), wG = glowOnly(wT);
  const tower = (x: number, z: number, w: number, d: number, top: number, tint: string) => {
    const h = top + 60, map = wT.clone(), em = wG.clone();
    map.repeat.set(Math.max(1, Math.round(w / 8)), h / 16); em.repeat.copy(map.repeat); map.needsUpdate = em.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam({map, emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 1.1, color: tint}));
    m.position.set(x, top - h / 2, z); roof.add(m);
  };
  for (let i = 0; i < 80; i++) tower(-420 + rnd() * 840, -330 + rnd() * 80, 10 + rnd() * 18, 12, -12 + rnd() * rnd() * 70, '#b8a6d8');
  for (let i = 0; i < 46; i++) tower(-200 + rnd() * 400, -190 + rnd() * 60, 9 + rnd() * 14, 10, -10 + rnd() * rnd() * 34, '#d6c8f0');
  for (let i = 0; i < 16; i++) {const x = -95 + i * 12.5 + rnd() * 5; if (Math.abs(x) < 16) continue; tower(x, -60 - rnd() * 34, 8 + rnd() * 8, 9, -9 + rnd() * 8, '#ffffff');}
  // a neon billboard on the nearest tower to the right
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({map: neonTex(), fog: false}));
  neon.position.set(26, 5.5, -52); neon.rotation.y = -.25; roof.add(neon);
  const neonFrame = new THREE.Mesh(new THREE.BoxGeometry(14.6, 7.6, .4), lam({color: '#1a1224'})); neonFrame.position.set(26.1, 5.5, -52.25); neonFrame.rotation.y = -.25; roof.add(neonFrame);
  for (const dx of [-5, 5]) {const leg = new THREE.Mesh(new THREE.BoxGeometry(.4, 9, .4), lam({color: '#1a1224'})); leg.position.set(26 + dx * Math.cos(.25), -2.5, -52 - dx * Math.sin(-.25)); roof.add(leg);}
  // our roof: slabs, a painted line, the parapet and a rail against the sky
  const cT = concreteTex(); cT.repeat.set(9, 3.5);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 14), new THREE.MeshStandardMaterial({map: cT, roughness: .62, metalness: 0}));
  slab.position.set(0, -.5, 1); roof.add(slab);
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(36, .14).rotateX(-Math.PI / 2), lam({color: '#e2b33c'}));
  paint.position.set(0, .004, -4.9); roof.add(paint);
  const dark = lam({color: '#3a3144'}), railM = lam({color: '#241c2e'});
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(36, .55, .4), dark); parapet.position.set(0, .275, -5.8); roof.add(parapet);
  for (let x = -18; x <= 18; x += 1.5) {const p = new THREE.Mesh(new THREE.BoxGeometry(.07, 1.05, .07), railM); p.position.set(x, 1.07, -5.8); roof.add(p);}
  for (const y of [1.1, 1.58]) {const r = new THREE.Mesh(new THREE.BoxGeometry(36, .06, .06), railM); r.position.set(0, y, -5.8); roof.add(r);}
  // a water tower on the left, air-con units on the right, a mast with a warning lamp
  const wood = lam({color: '#6b4a3a'}), band = lam({color: '#2e2230'});
  for (const [dx, dz] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) {const l = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3.3, 6), band); l.position.set(-8.6 + dx, 1.65, -3.6 + dz); roof.add(l);}
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 24), wood); tank.position.set(-8.6, 4.5, -3.6); roof.add(tank);
  for (const y of [3.6, 4.5, 5.4]) {const b = new THREE.Mesh(new THREE.CylinderGeometry(1.33, 1.33, .08, 24), band); b.position.set(-8.6, y, -3.6); roof.add(b);}
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, .9, 24), band); cone.position.set(-8.6, 6.15, -3.6); roof.add(cone);
  const acM = lam({color: '#8c8494'}), grille = lam({color: '#2a2430'});
  for (const [x, z] of [[7.4, -4.1], [9.3, -3.3]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.2), acM); b.position.set(x, .55, z); roof.add(b);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .04, 20), grille); fan.position.set(x, 1.12, z); roof.add(fan);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, 7.5, 6), band); mast.position.set(11.8, 3.75, -5); roof.add(mast);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8), new THREE.MeshBasicMaterial({color: '#ff3040', fog: false})); lamp.position.set(11.8, 7.55, -5); roof.add(lamp);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 8), new THREE.MeshBasicMaterial({color: '#ff3040', transparent: true, opacity: .25, depthWrite: false, fog: false})); lampGlow.position.copy(lamp.position); roof.add(lampGlow);
  roof.add(new THREE.HemisphereLight('#ffb495', '#3b2750', 1.25));
  const sunL = new THREE.DirectionalLight('#ffb070', 1.6); sunL.position.copy(SUN).multiplyScalar(100); roof.add(sunL, sunL.target);
  const fill = new THREE.DirectionalLight('#9a8cff', .55); fill.position.set(3, 6, 12); roof.add(fill, fill.target);

  const FOG = {roof: new THREE.Fog('#c2667a', 70, 520), train: new THREE.Fog('#dfe5ee', 18, 60)};
  const cloudX = clouds.map(c => c.position.x);
  function render(s: State) {
    const r = s.set === 'roof';
    train.visible = !r; roof.visible = r;
    scene.fog = FOG[s.set];
    renderer.setClearColor(r ? '#c2667a' : '#dfe5ee');
    camera.position.set(...s.cam.pos); camera.lookAt(...s.cam.look);
    if (camera.fov !== s.cam.fov) {camera.fov = s.cam.fov; camera.updateProjectionMatrix();}
    dome.position.copy(camera.position);
    clouds.forEach((c, i) => {c.position.x = cloudX[i] + s.f * .12 * (i % 2 ? 1 : .6);});
    const on = Math.floor(s.f / 20) % 2 === 0;  // the mast's lamp blinks
    lamp.visible = on; lampGlow.visible = on;
    renderer.render(scene, camera);
  }
  return {render, camera};
}
