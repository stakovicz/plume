import { type Pt, type Subpath, dist, eqPt, node, pt } from './geometry';

/** SVG path data ↔ subpaths, and basic shapes → path data. */

const tokenRE = /[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
export const tokens = (s: string) => s.match(tokenRE) ?? [];

/** Lenient number: "10px" → 10; nil/garbage → null. */
export function number(s: string | undefined | null): number | null {
  if (s == null) return null;
  const v = parseFloat(s.trim());
  return Number.isNaN(v) ? null : v;
}

export function shapeData(name: string, a: Record<string, string>): string | null {
  const n = (k: string) => number(a[k]) ?? 0;
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  switch (name) {
    case 'path': return a.d ?? null;
    case 'rect': { // SVG: a missing radius takes the other's value, each clamped to half the side
      const w = n('width'), h = n('height'), rx0 = number(a.rx), ry0 = number(a.ry);
      const rx = Math.min(Math.max(rx0 ?? ry0 ?? 0, 0), w / 2), ry = Math.min(Math.max(ry0 ?? rx0 ?? 0, 0), h / 2);
      return roundedRect(n('x'), n('y'), w, h, Array(4).fill([rx, ry]));
    }
    case 'circle': return ellipse(n('cx'), n('cy'), n('r'), n('r'));
    case 'ellipse': return ellipse(n('cx'), n('cy'), n('rx'), n('ry'));
    case 'line': return `M${n('x1')} ${n('y1')} L${n('x2')} ${n('y2')}`;
    case 'polyline': return 'M' + (a.points ?? '');
    case 'polygon': return 'M' + (a.points ?? '') + ' Z';
    default: return null;
  }
}

/** A rectangle with each corner (top-left, top-right, bottom-right, bottom-left) rounded by its [rx, ry],
 *  already small enough to fit. A corner with a zero radius is square; sides the corners use up entirely are left out. */
export function roundedRect(x: number, y: number, w: number, h: number, radii: [number, number][]): string {
  const [tl, tr, br, bl] = radii.map(([rx, ry]): [number, number] => (rx > 0 && ry > 0 ? [rx, ry] : [0, 0]));
  const arc = ([rx, ry]: [number, number], ex: number, ey: number) => (rx ? `A${rx} ${ry} 0 0 1 ${ex} ${ey} ` : '');
  const side = (cmd: 'H' | 'V', from: number, to: number) => (from !== to ? `${cmd}${to} ` : '');
  return `M${x + tl[0]} ${y} ${side('H', x + tl[0], x + w - tr[0])}${arc(tr, x + w, y + tr[1])}` +
    `${side('V', y + tr[1], y + h - br[1])}${arc(br, x + w - br[0], y + h)}` +
    `${side('H', x + w - br[0], x + bl[0])}${arc(bl, x, y + h - bl[1])}` +
    `${side('V', y + h - bl[1], y + tl[1])}${arc(tl, x + tl[0], y)}Z`;
}

export function parsePath(d: string): Subpath[] {
  const toks = tokens(d);
  let i = 0, cmd = 'M', lastCmd = ' ';
  const subs: Subpath[] = [];
  let cur: Subpath = { nodes: [], closed: false };
  let p = pt(0, 0), start = p, lastCtrl = p;

  const num = () => {
    const v = i < toks.length ? Number(toks[i]) : NaN;
    if (Number.isNaN(v)) return 0; // malformed: next letter resyncs
    i++;
    return v;
  };
  const point = (rel: boolean) => {
    const x = num(), y = num();
    return rel ? pt(p.x + x, p.y + y) : pt(x, y);
  };
  const reflect = (c: Pt) => pt(2 * p.x - c.x, 2 * p.y - c.y);
  const flush = () => {
    if (cur.nodes.length) subs.push(cur);
    cur = { nodes: [], closed: false };
  };
  const curve = (c1: Pt, c2: Pt, q: Pt) => {
    if (!cur.nodes.length) cur.nodes = [node(p)]; // drawing after Z without M
    const last = cur.nodes[cur.nodes.length - 1];
    cur.nodes[cur.nodes.length - 1] = { ...last, cout: c1 };
    cur.nodes.push({ p: q, cin: c2, cout: q });
    p = q;
  };
  const line = (q: Pt) => curve(p, q, q);
  const quad = (c: Pt, q: Pt) =>
    curve(pt(p.x + (2 / 3) * (c.x - p.x), p.y + (2 / 3) * (c.y - p.y)), pt(q.x + (2 / 3) * (c.x - q.x), q.y + (2 / 3) * (c.y - q.y)), q);

  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) {
      cmd = toks[i];
      i++;
    } else if (cmd === 'Z' || cmd === 'z') {
      i++; // stray number after Z
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    switch (up) {
      case 'M':
        flush();
        p = point(rel);
        start = p;
        cur.nodes = [node(p)];
        cmd = rel ? 'l' : 'L'; // extra pairs are implicit lineto
        break;
      case 'L': line(point(rel)); break;
      case 'H': { const x = num(); line(pt(rel ? p.x + x : x, p.y)); break; }
      case 'V': { const y = num(); line(pt(p.x, rel ? p.y + y : y)); break; }
      case 'C': {
        const c1 = point(rel), c2 = point(rel), q = point(rel);
        curve(c1, c2, q);
        lastCtrl = c2;
        break;
      }
      case 'S': {
        const c1 = 'CS'.includes(lastCmd) ? reflect(lastCtrl) : p;
        const c2 = point(rel), q = point(rel);
        curve(c1, c2, q);
        lastCtrl = c2;
        break;
      }
      case 'Q': {
        const c = point(rel), q = point(rel);
        quad(c, q);
        lastCtrl = c;
        break;
      }
      case 'T': {
        const c = 'QT'.includes(lastCmd) ? reflect(lastCtrl) : p;
        quad(c, point(rel));
        lastCtrl = c;
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), phi = num(), large = num() !== 0, sweep = num() !== 0;
        for (const [c1, c2, q] of arc(p, rx, ry, phi, large, sweep, point(rel))) curve(c1, c2, q);
        break;
      }
      case 'Z': {
        const n = cur.nodes;
        if (n.length > 1 && dist(n[0].p, n[n.length - 1].p) < 1e-6) {
          n[0] = { ...n[0], cin: n[n.length - 1].cin }; // explicit closing segment duplicates the first node
          n.pop();
        }
        cur.closed = true;
        flush();
        p = start;
        break;
      }
      default:
        i = toks.length; // unknown command: stop
    }
    lastCmd = up;
  }
  flush();
  return subs;
}

/** SVG arc → cubic segments (SVG spec F.6.5 endpoint-to-center conversion). */
export function arc(p0: Pt, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, p: Pt): Pt[][] {
  if (eqPt(p0, p)) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [[p0, p, p]];
  const phi = (phiDeg * Math.PI) / 180, cs = Math.cos(phi), sn = Math.sin(phi);
  const dx = (p0.x - p.x) / 2, dy = (p0.y - p.y) / 2;
  const x1 = cs * dx + sn * dy, y1 = -sn * dx + cs * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1) / ry, cyp = (-coef * ry * x1) / rx;
  const cx = cs * cxp - sn * cyp + (p0.x + p.x) / 2, cy = sn * cxp + cs * cyp + (p0.y + p.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const ux = (x1 - cxp) / rx, uy = (y1 - cyp) / ry, vx = (-x1 - cxp) / rx, vy = (-y1 - cyp) / ry;
  const theta = angle(1, 0, ux, uy);
  let delta = angle(ux, uy, vx, vy);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const n = Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9);
  const step = delta / n, k = (4 / 3) * Math.tan(step / 4);
  const e = (a: number) => pt(cx + rx * Math.cos(a) * cs - ry * Math.sin(a) * sn, cy + rx * Math.cos(a) * sn + ry * Math.sin(a) * cs);
  const de = (a: number) => pt(-rx * Math.sin(a) * cs - ry * Math.cos(a) * sn, -rx * Math.sin(a) * sn + ry * Math.cos(a) * cs);
  return Array.from({ length: n }, (_, j) => {
    const a1 = theta + j * step, a2 = a1 + step;
    const s = e(a1), d1 = de(a1), d2 = de(a2);
    const end = j === n - 1 ? p : e(a2);
    return [pt(s.x + k * d1.x, s.y + k * d1.y), pt(end.x - k * d2.x, end.y - k * d2.y), end];
  });
}

/** Subpaths → SVG path data (straight segments as L). */
export function pathData(subpaths: Subpath[], digits = 2): string {
  const f = (q: Pt) => `${q.x.toFixed(digits)},${q.y.toFixed(digits)}`;
  return subpaths
    .filter((s) => s.nodes.length)
    .map((s) => {
      const n = s.nodes;
      let d = 'M' + f(n[0].p);
      for (let k = 0; k < (s.closed ? n.length : n.length - 1); k++) {
        const a = n[k], b = n[(k + 1) % n.length];
        d += eqPt(a.cout, a.p) && eqPt(b.cin, b.p) ? ' L' + f(b.p) : ` C${f(a.cout)} ${f(b.cin)} ${f(b.p)}`;
      }
      return s.closed ? d + ' Z' : d;
    })
    .join(' ');
}
