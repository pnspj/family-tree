import { describe, expect, it } from 'vitest';
import { xmlStyle } from './Print';

describe('xmlStyle', () => {
  it('keeps minified media queries from breaking the SVG document', () => {
    expect(xmlStyle('@media (width<=520px){a{b:c}}')).toBe('<style><![CDATA[@media (width<=520px){a{b:c}}]]></style>');
  });
  it('splits a CDATA end marker inside the CSS', () => {
    expect(xmlStyle('a{content:"]]>"}')).toBe('<style><![CDATA[a{content:"]]]]><![CDATA[>"}]]></style>');
  });
});
