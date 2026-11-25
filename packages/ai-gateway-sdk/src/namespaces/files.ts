import { Transport } from "../transport";
import {
  PresignedDownloadRequest,
  PresignedDownloadResponse,
  PresignedUploadRequest,
  PresignedUploadResponse,
} from "../typesExt/file";

/**
 * File operations against the gateway's MinIO-backed file store.
 *
 * NOTE: The gateway does not currently expose presign endpoints publicly.
 * Until those are added in `internal/admin/file_handlers.go`, apps should
 * upload via their own BFF (e.g., Next.js route handler) that holds MinIO
 * creds directly. This namespace is a thin wrapper for the *future* gateway
 * presign endpoints — the path prefix `/admin/files/*` is reserved.
 */
export class FilesNamespace {
  constructor(private transport: Transport) {}

  async presignUpload(req: PresignedUploadRequest): Promise<PresignedUploadResponse> {
    return this.transport.request({
      method: "POST",
      path: `/admin/files/presign-upload`,
      body: req,
    });
  }

  async presignDownload(req: PresignedDownloadRequest): Promise<PresignedDownloadResponse> {
    return this.transport.request({
      method: "POST",
      path: `/admin/files/presign-download`,
      body: req,
    });
  }

  /**
   * Upload a file directly to a presigned URL. Does not touch the gateway.
   * Returns the object_key from the presigned URL.
   */
  async uploadToPresigned(
    presigned: PresignedUploadResponse,
    file: Blob,
  ): Promise<string> {
    const res = await fetch(presigned.upload_url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!res.ok) {
      throw new Error(`MinIO upload failed: ${res.status} ${await res.text()}`);
    }
    return presigned.object_key;
  }
}
