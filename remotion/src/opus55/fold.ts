/**
 * The game's lite mode (channel/game, for phones): fold a group's still meshes that share a material into one mesh,
 * in the group's own space. Same triangles and materials, far fewer objects: three.js spends its time per object,
 * every frame, seen or not. A material used once is left alone, so anything a render moves or recolours on its own
 * keeps working. The video never calls it.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function fold(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), byMat = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse(o => {const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material)) byMat.set(m.material, [...(byMat.get(m.material) ?? []), m]);});
  for (const [mat, ms] of byMat) {
    if (ms.length < 2) continue;
    const geo = mergeGeometries(ms.map(m => (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(inv.clone().multiply(m.matrixWorld))));
    if (!geo) continue;   // attributes that don't line up: leave these meshes as they are
    for (const m of ms) m.removeFromParent();
    root.add(new THREE.Mesh(geo, mat));
  }
}
