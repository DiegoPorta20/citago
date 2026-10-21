const MAX_SLUG_LENGTH = 60;
const MAX_CANDIDATES = 20;

export function slugify(businessName: string): string {
  const slug = businessName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  return slug.length > 0 ? slug : 'negocio';
}

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
