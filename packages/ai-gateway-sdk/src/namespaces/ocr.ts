import { Transport } from "../transport";
import { OcrEvent, OcrRequest, OcrResult } from "../typesExt/ocr";

export class OcrNamespace {
  constructor(private transport: Transport) {}

  /** Non-streaming JSON OCR. */
  async process(req: OcrRequest): Promise<OcrResult> {
    const form = new FormData();
    form.append("file", req.file);
    if (req.agent_id) form.append("agent_id", req.agent_id);
    if (req.language) form.append("language", req.language);
    if (req.dpi !== undefined) form.append("dpi", String(req.dpi));
    return this.transport.request({
      method: "POST",
      path: `/v1/ocr/process`,
      body: form,
      query: { stream: "false" },
    });
  }

  /**
   * Streaming SSE OCR. Returns an async iterator of OcrEvent objects.
   * Use `for await (const evt of client.ocr.stream(req))`.
   */
  async *stream(req: OcrRequest, signal?: AbortSignal): AsyncGenerator<OcrEvent> {
    const form = new FormData();
    form.append("file", req.file);
    if (req.agent_id) form.append("agent_id", req.agent_id);
    if (req.language) form.append("language", req.language);
    if (req.dpi !== undefined) form.append("dpi", String(req.dpi));

    const response = await this.transport.request<Response>({
      method: "POST",
      path: `/v1/ocr/process`,
      body: form,
      raw: true,
      signal,
      headers: { Accept: "text/event-stream" },
    });

    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const dataLine = part
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const raw = dataLine.slice(6);
        try {
          yield JSON.parse(raw) as OcrEvent;
        } catch {
          // skip unparseable
        }
      }
    }
  }
}
