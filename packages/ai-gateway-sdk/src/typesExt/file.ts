/** File / MinIO presigned URL types. */

export interface PresignedUploadRequest {
  bucket: string;
  object_key?: string; // optional — gateway generates UUID if absent
  content_type: string;
  size_bytes: number;
  /** metadata to attach to the MinIO object (e.g. case_id) */
  metadata?: Record<string, string>;
}

export interface PresignedUploadResponse {
  upload_url: string;
  object_key: string;
  bucket: string;
  expires_at: string;
}

export interface PresignedDownloadRequest {
  bucket: string;
  object_key: string;
  expires_seconds?: number;
}

export interface PresignedDownloadResponse {
  download_url: string;
  expires_at: string;
}

export interface FileRef {
  bucket: string;
  object_key: string;
  content_type?: string;
  size_bytes?: number;
}
