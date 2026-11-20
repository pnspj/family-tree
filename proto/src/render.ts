// Shared SVG helpers for the ELK and custom layouts.
import * as d3 from 'd3';
import type { Person } from './model';

export const CARD_W = 116;
export const CARD_H = 52;

export interface ViewOptions {
  kana: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const fill = (g: Person['gender']) =>
  g === 'M' ? '#dbeafe' : g === 'F' ? '#fde2e4' : '#eeeeee';
const stroke = (g: Person['gender']) =>
  g === 'M' ? '#3b82f6' : g === 'F' ? '#e11d48' : '#888888';

/** Draws a person card whose top-left corner is (x, y). */
export function drawCard(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  p: Person,
  x: number,
  y: number,
  opt: ViewOptions,
) {
  const g = parent
    .append('g')
    .attr('class', 'card')
    .attr('transform', `translate(${x},${y})`)
    .style('cursor', 'pointer')
    .on('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      opt.onSelect(p.id);
    });
  const selected = opt.selectedId === p.id;
  g.append('rect')
    .attr('width', CARD_W)
    .attr('height', CARD_H)
    .attr('rx', 8)
    .attr('fill', fill(p.gender))
    .attr('stroke', selected ? '#f59e0b' : stroke(p.gender))
    .attr('stroke-width', selected ? 4 : 1.5);
  const name = opt.kana
    ? `${p.familyNameKana ?? ''} ${p.givenNameKana ?? ''}`.trim()
    : `${p.familyName ?? ''} ${p.givenName ?? ''}`.trim();
  g.append('text')
    .attr('x', CARD_W / 2)
    .attr('y', 22)
    .attr('text-anchor', 'middle')
    .attr('font-size', 15)
    .attr('font-weight', 600)
    .text(name || '？');
  g.append('text')
    .attr('x', CARD_W / 2)
    .attr('y', 41)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11)
    .attr('fill', '#555')
    .text(p.birth ? `${p.birth.y}年生` : '');
  return g;
}

/** Creates an SVG with pan/zoom inside `host`; returns the content group and a fit() function. */
export function createZoomableSvg(host: HTMLElement) {
  host.innerHTML = '';
  const svg = d3
    .select(host)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('display', 'block')
    .style('touch-action', 'none');
  const content = svg.append('g');
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 3])
    .on('zoom', (ev) => content.attr('transform', ev.transform.toString()));
  svg.call(zoom);
  const fit = () => {
    const box = (content.node() as SVGGElement).getBBox();
    const { width, height } = host.getBoundingClientRect();
    if (!box.width || !width) return;
    const k = Math.min(width / (box.width + 40), height / (box.height + 40), 1.5);
    const tx = width / 2 - k * (box.x + box.width / 2);
    const ty = height / 2 - k * (box.y + box.height / 2);
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  };
  return { svg, content, fit };
}
