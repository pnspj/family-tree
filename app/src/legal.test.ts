import { describe, expect, it } from 'vitest';
import privacy from '../public/privacy.html?raw';
import terms from '../public/terms.html?raw';
import { TERMS_VERSION } from './legal';

describe('legal pages', () => {
  // The app asks for re-consent by version; the published pages must show the same version.
  it.each([
    ['terms.html', terms],
    ['privacy.html', privacy],
  ])('%s carries the app’s terms version', (_name, html) => {
    expect(html).toContain(`版：${TERMS_VERSION}`);
  });
});
