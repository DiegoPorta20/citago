import { buildSlugCandidates, slugify } from './slug.js';

describe('slugify', () => {
  it('strips diacritics so accents do not change the handle', () => {
    expect(slugify('Barbería Los Ángeles')).toBe('barberia-los-angeles');
  });

  it('collapses symbols and spaces into single hyphens', () => {
    expect(slugify('Barber&Co.  #1')).toBe('barber-co-1');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  ¡Barbería!  ')).toBe('barberia');
  });

  it('falls back to a usable handle when nothing survives', () => {
    // A name made only of symbols or a non-latin script would collapse to ''.
    expect(slugify('***')).toBe('negocio');
    expect(slugify('理髪店')).toBe('negocio');
  });

  it('never exceeds the column length', () => {
    const slug = slugify('Barbería '.repeat(20));

    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('buildSlugCandidates', () => {
  it('offers the plain handle first, then numbered variants', () => {
    const [first, second, third] = buildSlugCandidates('Barbería Demo');

    expect(first).toBe('barberia-demo');
    expect(second).toBe('barberia-demo-2');
    expect(third).toBe('barberia-demo-3');
  });

  it('keeps every candidate within the column length', () => {
    for (const candidate of buildSlugCandidates('a'.repeat(80))) {
      expect(candidate.length).toBeLessThanOrEqual(60);
    }
  });

  it('produces distinct candidates', () => {
    const candidates = buildSlugCandidates('Barbería Demo');

    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
