import { FLAGS } from '../../config/flags';
import { content } from '../../content/cards';
import { nextInt, type RngState } from '../rng';
import type { MapNode, NodeType } from './types';

/**
 * SPEC §11: a Slay the Spire style lattice, 7 wide × 15 rows, 6 non-crossing walks. The boss sits alone
 * on the last row with a Hearth before it. Elites from row `eliteFromRow`. Every fight node is assigned
 * one of the 8 fights at generation, so Scout can reveal them.
 */
export function generateMap(rng0: RngState): { nodes: MapNode[]; rng: RngState } {
  const W = FLAGS.mapWidth;
  const H = FLAGS.mapHeight;
  let rng = rng0;
  const out = new Map<string, Set<number>>(); // "x,y" -> next xs
  const touched = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const addEdge = (x: number, y: number, nx: number) => {
    if (!out.has(key(x, y))) out.set(key(x, y), new Set());
    out.get(key(x, y))!.add(nx);
    touched.add(key(x, y));
    touched.add(key(nx, y + 1));
  };
  const crosses = (x: number, y: number, nx: number) => nx !== x && (out.get(key(nx, y))?.has(x) ?? false);
  let firstStart = -1;
  // Rows 0..H-3 are the lattice; row H-2 is the Hearth before the boss, row H-1 the boss.
  const lastLatticeRow = H - 3;
  for (let p = 0; p < FLAGS.mapPaths; p++) {
    let x: number;
    [x, rng] = nextInt(rng, W);
    if (p === 1) while (x === firstStart) [x, rng] = nextInt(rng, W);
    if (p === 0) firstStart = x;
    touched.add(key(x, 0));
    for (let y = 0; y < lastLatticeRow; y++) {
      const cands = [x - 1, x, x + 1].filter((nx) => nx >= 0 && nx < W && !crosses(x, y, nx));
      let i: number;
      [i, rng] = nextInt(rng, cands.length || 1);
      const nx = cands.length ? cands[i]! : x;
      addEdge(x, y, nx);
      x = nx;
    }
  }
  // Assign node types.
  const nodes: MapNode[] = [];
  const idOf = new Map<string, number>();
  const typeRng = { rng };
  const pickType = (y: number, x: number): NodeType => {
    if (y === 0) return 'fight';
    if (y === lastLatticeRow) return 'fight';
    const weights: [NodeType, number][] = [
      ['fight', 45],
      ['shrine', 18],
      ['hearth', 11],
      ['market', 12],
      ['scout', 5],
      ['elite', y >= FLAGS.eliteFromRow ? 9 : 0],
    ];
    const total = weights.reduce((a, w) => a + w[1], 0);
    let r: number;
    [r, typeRng.rng] = nextInt(typeRng.rng, total);
    for (const [t, w] of weights) {
      if (r < w) return t;
      r -= w;
    }
    void x;
    return 'fight';
  };
  const counters = { fight: 0, elite: 0, shrine: 0 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isHearthRow = y === H - 2;
      const isBossRow = y === H - 1;
      if (isBossRow && x !== Math.floor(W / 2)) continue;
      if (isHearthRow && x !== Math.floor(W / 2)) continue;
      if (!isHearthRow && !isBossRow && !touched.has(key(x, y))) continue;
      const type: NodeType = isBossRow ? 'boss' : isHearthRow ? 'hearth' : pickType(y, x);
      const id = nodes.length;
      idOf.set(key(x, y), id);
      nodes.push({ id, x, y, type, next: [], encounter: 0 });
    }
  }
  rng = typeRng.rng;
  // Avoid two of the same non-fight type in a row along a path: nudge repeats to fights (cheap pass).
  // Encounters: fights cycle through the 8 in a seeded order so a run sees variety; elites and shrines likewise.
  const fightOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng);
  rng = fightOrder.rng;
  const eliteOrder = shuffle([0, 1, 2], rng);
  rng = eliteOrder.rng;
  const shrineOrder = shuffle(content.events.map((_, i) => i), rng);
  rng = shrineOrder.rng;
  for (const n of nodes) {
    if (n.type === 'fight') n.encounter = fightOrder.list[counters.fight++ % 8]!;
    else if (n.type === 'elite') n.encounter = eliteOrder.list[counters.elite++ % 3]!;
    else if (n.type === 'shrine') n.encounter = shrineOrder.list[counters.shrine++ % shrineOrder.list.length]!;
  }
  // Edges.
  for (const n of nodes) {
    if (n.y < lastLatticeRow) {
      for (const nx of out.get(key(n.x, n.y)) ?? []) {
        const to = idOf.get(key(nx, n.y + 1));
        if (to !== undefined) n.next.push(to);
      }
    } else if (n.y === lastLatticeRow) {
      n.next.push(idOf.get(key(Math.floor(W / 2), H - 2))!);
    } else if (n.y === H - 2) {
      n.next.push(idOf.get(key(Math.floor(W / 2), H - 1))!);
    }
    n.next.sort((a, b) => a - b);
  }
  return { nodes, rng };
}

function shuffle<T>(list: T[], rng0: RngState): { list: T[]; rng: RngState } {
  const out = [...list];
  let rng = rng0;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, rng] = nextInt(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return { list: out, rng };
}

/** Nodes the player may move to next. Before the first node: every node on row 0. */
export function reachable(nodes: MapNode[], at: number): number[] {
  if (at < 0) return nodes.filter((n) => n.y === 0).map((n) => n.id);
  return nodes[at]?.next ?? [];
}
