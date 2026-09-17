const MAX_SLUG_LENGTH = 60;
const MAX_CANDIDATES = 20;

/**
 * Turns a business name into a URL-safe handle.
 *
 * `Barbería Los Ángeles #1` → `barberia-los-angeles-1`
 */
export function slugify(businessName: string): string {
  const slug = businessName
    .normalize('NFD')
    // Strip diacritics, so "Barbería" and "Barberia" produce the same handle.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  // Names made only of symbols or non-latin scripts would collapse to nothing.
  return slug.length > 0 ? slug : 'negocio';
}

/**
 * Candidate handles in the order they should be tried:
 * `barberia-demo`, `barberia-demo-2`, `barberia-demo-3`, …
 */
export function buildSlugCandidates(businessName: string): string[] {
  const base = slugify(businessName);
  const candidates = [base];

  for (let suffix = 2; suffix <= MAX_CANDIDATES; suffix += 1) {
    const tail = `-${suffix}`;
    const head = base
      .slice(0, MAX_SLUG_LENGTH - tail.length)
      .replace(/-+$/g, '');

    candidates.push(`${head}${tail}`);
  }

  return candidates;
}
