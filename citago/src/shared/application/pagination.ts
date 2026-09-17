export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Normalized pagination input, already validated at the HTTP boundary. */
export interface PageRequest {
  readonly page: number;
  readonly limit: number;
}

export interface PageMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

/** A page of results returned by a repository or query port. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly meta: PageMeta;
}

export function offsetOf(request: PageRequest): number {
  return (request.page - 1) * request.limit;
}

export function buildPage<T>(
  items: readonly T[],
  total: number,
  request: PageRequest,
): Page<T> {
  return {
    items,
    meta: {
      page: request.page,
      limit: request.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / request.limit),
    },
  };
}
