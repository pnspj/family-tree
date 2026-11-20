// ELK (Eclipse Layout Kernel) layered layout with union nodes:
// partner -> union -> child. Generic graph layout, not family-tree aware.
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import * as d3 from 'd3';
import type { FamilyData } from '../model';
import { CARD_H, CARD_W, createZoomableSvg, drawCard, type ViewOptions } from '../render';

const elk = new ELK();
const U_SIZE = 10;

export async function renderElk(host: HTMLElement, data: FamilyData, opt: ViewOptions) {
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '30',
      'elk.spacing.nodeNode': '24',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: [
      ...data.persons.map((p) => ({ id: p.id, width: CARD_W, height: CARD_H })),
      ...data.unions.map((u) => ({ id: u.id, width: U_SIZE, height: U_SIZE })),
    ],
    edges: [
      ...data.unions.flatMap((u) =>
        u.partners.filter((p): p is string => !!p).map((p) => ({ id: `${p}->${u.id}`, sources: [p], targets: [u.id] })),
      ),
      ...data.persons
        .filter((p) => p.childOf)
        .map((p) => ({ id: `${p.childOf}->${p.id}`, sources: [p.childOf!], targets: [p.id] })),
    ],
  };
  const res = await elk.layout(graph);
  const { content, fit } = createZoomableSvg(host);
  const lines = content.append('g').attr('fill', 'none').attr('stroke', '#555').attr('stroke-width', 1.5);
  for (const e of (res.edges ?? []) as ElkExtendedEdge[]) {
    for (const s of e.sections ?? []) {
      const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
      lines.append('path').attr('d', d3.line<{ x: number; y: number }>().x((d) => d.x).y((d) => d.y)(pts));
    }
  }
  const pos = new Map((res.children ?? []).map((n) => [n.id, n]));
  const nodes = content.append('g');
  for (const u of data.unions) {
    const n = pos.get(u.id)!;
    nodes
      .append('circle')
      .attr('cx', n.x! + U_SIZE / 2)
      .attr('cy', n.y! + U_SIZE / 2)
      .attr('r', U_SIZE / 2)
      .attr('fill', u.status === 'former' ? '#fff' : '#555')
      .attr('stroke', '#555');
  }
  for (const p of data.persons) {
    const n = pos.get(p.id)!;
    drawCard(nodes, p, n.x!, n.y!, opt);
  }
  return fit;
}
