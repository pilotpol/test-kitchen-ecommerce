/** OCR types aligned with internal/ocr/handler.go. */

export interface OcrRequest {
  file: File | Blob;
  agent_id?: string;
  language?: string; // e.g. "tha+eng"
  dpi?: number;
  stream?: boolean;
}

export interface OcrResult {
  text: string;
  usage: {
    pages_processed: number;
    total_chars: number;
    duration_ms: number;
    engine: "vlm";
    effective_dpi?: number;
  };
  trace_id?: string;
}

/** SSE event emitted during OCR streaming */
export interface OcrEvent {
  step: 0 | 1 | 2; // 0=receive, 1=processing, 2=done
  text?: string;
  page?: number;
  engine?: "vlm";
  error?: string;
}
