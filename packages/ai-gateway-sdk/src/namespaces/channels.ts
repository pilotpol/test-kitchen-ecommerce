import { Transport } from "../transport";
import { Channel, ChannelKey, CreateChannelInput } from "../typesExt/channel";

export class ChannelsNamespace {
  constructor(private transport: Transport) {}

  async create(input: CreateChannelInput): Promise<Channel> {
    return this.transport.request({
      method: "POST",
      path: `/admin/channels`,
      body: input,
    });
  }

  async list(): Promise<Channel[]> {
    return this.transport.request({ path: `/admin/channels` });
  }

  async get(channelId: string): Promise<Channel> {
    return this.transport.request({
      path: `/admin/channels/${encodeURIComponent(channelId)}`,
    });
  }

  async update(
    channelId: string,
    patch: Partial<CreateChannelInput>,
  ): Promise<Channel> {
    return this.transport.request({
      method: "PUT",
      path: `/admin/channels/${encodeURIComponent(channelId)}`,
      body: patch,
    });
  }

  async remove(channelId: string): Promise<void> {
    await this.transport.request({
      method: "DELETE",
      path: `/admin/channels/${encodeURIComponent(channelId)}`,
    });
  }

  async regenerateKey(channelId: string): Promise<ChannelKey> {
    return this.transport.request({
      method: "POST",
      path: `/admin/channels/${encodeURIComponent(channelId)}/regenerate-key`,
    });
  }
}
