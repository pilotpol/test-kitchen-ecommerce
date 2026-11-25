/** Knowledge base search types aligned with internal/opensearch/search.go. */

export interface KbSearchQuery {
  query: string;
  folder?: string; // kb_folder
  top_k?: number;
  filter?: Record<string, string | number>;
}

export interface KbSearchHit {
  id: string;
  title: string;
  content: string;
  score: number;
  kb_folder?: string;
  source_file_id?: string;
  page_number?: number;
  doc_type?: string;
}

export interface KbSearchResponse {
  hits: KbSearchHit[];
  total: number;
  took_ms: number;
}
