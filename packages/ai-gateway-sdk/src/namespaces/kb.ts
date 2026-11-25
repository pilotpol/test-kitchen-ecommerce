import { Transport } from "../transport";
import { KbSearchQuery, KbSearchResponse } from "../typesExt/kb";

export class KbNamespace {
  constructor(private transport: Transport) {}

  async search(query: KbSearchQuery): Promise<KbSearchResponse> {
    return this.transport.request({
      method: "POST",
      path: `/admin/kb/search`,
      body: query,
    });
  }
}
