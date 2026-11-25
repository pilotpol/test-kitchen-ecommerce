/** Shared primitives for namespaced APIs. */

export interface Pagination {
  limit?: number;
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number;
}
