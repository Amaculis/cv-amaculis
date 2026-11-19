import * as THREE from 'three';

/**
 * One level of Loop subdivision for a skinned triangle mesh.
 *
 * Positions use the standard Loop stencils (with the boundary rules for open edges, such
 * as the wrist). Skin weights go through the very same stencils as dense per-joint vectors
 * and are then cut back to the four strongest influences, so the smoothed mesh deforms
 * like the original. UVs and normals are dropped (normals are recomputed).
 */
export function loopSubdivideSkinned(src: THREE.BufferGeometry, jointCount: number): THREE.BufferGeometry {
  const P = src.attributes.position as THREE.BufferAttribute;
  const SI = src.attributes.skinIndex as THREE.BufferAttribute;
  const SW = src.attributes.skinWeight as THREE.BufferAttribute;
  const J = jointCount;

  // weld by position only (UV seams split vertices; we want one smooth surface)
  const key = (i: number) => `${P.getX(i).toFixed(5)},${P.getY(i).toFixed(5)},${P.getZ(i).toFixed(5)}`;
  const welded = new Map<string, number>();
  const remap = new Int32Array(P.count);
  const pos: number[] = [];
  const w: number[] = [];
  for (let i = 0; i < P.count; i++) {
    const k = key(i);
    let id = welded.get(k);
    if (id === undefined) {
      id = pos.length / 3;
      welded.set(k, id);
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      const dense = new Array(J).fill(0);
      for (let c = 0; c < 4; c++) dense[SI.getComponent(i, c)] += SW.getComponent(i, c);
      w.push(...dense);
    }
    remap[i] = id;
  }
  const nV = pos.length / 3;

  const srcIndex = src.index ? Array.from(src.index.array) : Array.from({ length: P.count }, (_, i) => i);
  const faces: number[] = [];
  for (let f = 0; f < srcIndex.length; f += 3) {
    const a = remap[srcIndex[f]], b = remap[srcIndex[f + 1]], c = remap[srcIndex[f + 2]];
    if (a !== b && b !== c && c !== a) faces.push(a, b, c);
  }

  // edges, with the vertices opposite to them
  const edgeKey = (a: number, b: number) => (a < b ? a * nV + b : b * nV + a);
  const edges = new Map<number, { a: number; b: number; opp: number[]; id: number }>();
  const neighbours: Set<number>[] = Array.from({ length: nV }, () => new Set());
  for (let f = 0; f < faces.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const a = faces[f + e], b = faces[f + ((e + 1) % 3)], c = faces[f + ((e + 2) % 3)];
      const k = edgeKey(a, b);
      let edge = edges.get(k);
      if (!edge) edges.set(k, (edge = { a, b, opp: [], id: 0 }));
      edge.opp.push(c);
      neighbours[a].add(b);
      neighbours[b].add(a);
    }
  }
  const boundaryNbrs: number[][] = Array.from({ length: nV }, () => []);
  for (const e of edges.values()) {
    if (e.opp.length === 1) {
      boundaryNbrs[e.a].push(e.b);
      boundaryNbrs[e.b].push(e.a);
    }
  }

  const nE = edges.size;
  const outN = nV + nE;
  const outPos = new Float64Array(outN * 3);
  const outW = new Float64Array(outN * J);
  const acc = (dst: number, srcV: number, k: number) => {
    for (let c = 0; c < 3; c++) outPos[dst * 3 + c] += pos[srcV * 3 + c] * k;
    for (let j = 0; j < J; j++) outW[dst * J + j] += w[srcV * J + j] * k;
  };

  // updated original vertices
  for (let i = 0; i < nV; i++) {
    const bn = boundaryNbrs[i];
    if (bn.length) {
      if (bn.length === 2) {
        acc(i, i, 0.75);
        acc(i, bn[0], 0.125);
        acc(i, bn[1], 0.125);
      } else acc(i, i, 1); // corner / non-manifold: keep it
      continue;
    }
    const nb = [...neighbours[i]];
    const k = nb.length;
    const beta = k === 3 ? 3 / 16 : 3 / (8 * k);
    acc(i, i, 1 - k * beta);
    for (const n of nb) acc(i, n, beta);
  }
  // new edge vertices
  let next = nV;
  for (const e of edges.values()) {
    e.id = next++;
    if (e.opp.length === 2) {
      acc(e.id, e.a, 3 / 8);
      acc(e.id, e.b, 3 / 8);
      acc(e.id, e.opp[0], 1 / 8);
      acc(e.id, e.opp[1], 1 / 8);
    } else {
      acc(e.id, e.a, 0.5);
      acc(e.id, e.b, 0.5);
    }
  }

  const index: number[] = [];
  const mid = (a: number, b: number) => edges.get(edgeKey(a, b))!.id;
  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f], b = faces[f + 1], c = faces[f + 2];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    index.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }

  // back to four influences per vertex
  const skinIndex = new Uint16Array(outN * 4);
  const skinWeight = new Float32Array(outN * 4);
  const order = Array.from({ length: J }, (_, j) => j);
  for (let v = 0; v < outN; v++) {
    const o = v * J;
    order.sort((x, y) => outW[o + y] - outW[o + x]);
    let sum = 0;
    for (let c = 0; c < 4; c++) sum += Math.max(0, outW[o + order[c]]);
    for (let c = 0; c < 4; c++) {
      skinIndex[v * 4 + c] = order[c];
      skinWeight[v * 4 + c] = sum > 0 ? Math.max(0, outW[o + order[c]]) / sum : c === 0 ? 1 : 0;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(outPos), 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
