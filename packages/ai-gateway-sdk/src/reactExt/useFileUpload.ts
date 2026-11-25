"use client";

import { useCallback, useState } from "react";

export type FileStatus = "pending" | "uploading" | "done" | "error";

export interface UploadSlot {
  file: File;
  status: FileStatus;
  progress: number; // 0..100
  objectKey?: string;
  error?: string;
}

export interface UseFileUploadOptions {
  maxFiles?: number; // default 5
  maxBytesPerFile?: number; // default 20 * 1024 * 1024
  acceptMimeTypes?: string[]; // default ["application/pdf"]
  /** Caller-provided uploader — e.g. Next.js route /api/cases/upload. */
  uploadFn: (file: File, onProgress: (pct: number) => void) => Promise<{ objectKey: string }>;
}

/**
 * Client-side file upload manager with per-file progress + hard caps.
 *
 * Validation is best-effort UX; the server must still enforce.
 */
export function useFileUpload(opts: UseFileUploadOptions) {
  const maxFiles = opts.maxFiles ?? 5;
  const maxBytes = opts.maxBytesPerFile ?? 20 * 1024 * 1024;
  const accept = opts.acceptMimeTypes ?? ["application/pdf"];

  const [slots, setSlots] = useState<UploadSlot[]>([]);

  const addFiles = useCallback(
    (incoming: File[]): string | null => {
      if (slots.length + incoming.length > maxFiles) {
        return `เกิน ${maxFiles} ไฟล์ — ตัดไฟล์ที่เกินออกก่อน`;
      }
      for (const f of incoming) {
        if (accept.length && !accept.includes(f.type)) {
          return `ประเภทไฟล์ไม่รองรับ: ${f.name} (${f.type || "unknown"})`;
        }
        if (f.size > maxBytes) {
          return `ไฟล์ใหญ่เกิน ${(maxBytes / 1024 / 1024).toFixed(0)}MB: ${f.name}`;
        }
      }
      setSlots((prev) => [
        ...prev,
        ...incoming.map<UploadSlot>((file) => ({
          file,
          status: "pending",
          progress: 0,
        })),
      ]);
      return null;
    },
    [slots.length, maxFiles, maxBytes, accept],
  );

  const removeFile = useCallback((index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadAll = useCallback(async (): Promise<UploadSlot[]> => {
    const next: UploadSlot[] = slots.map((s) => ({ ...s, status: "uploading" }));
    setSlots(next);

    await Promise.all(
      next.map(async (slot, idx) => {
        try {
          const { objectKey } = await opts.uploadFn(slot.file, (pct) => {
            setSlots((prev) => {
              const copy = [...prev];
              if (copy[idx]) copy[idx] = { ...copy[idx], progress: pct };
              return copy;
            });
          });
          setSlots((prev) => {
            const copy = [...prev];
            if (copy[idx]) {
              copy[idx] = {
                ...copy[idx],
                status: "done",
                progress: 100,
                objectKey,
              };
            }
            return copy;
          });
        } catch (e) {
          setSlots((prev) => {
            const copy = [...prev];
            if (copy[idx]) {
              copy[idx] = {
                ...copy[idx],
                status: "error",
                error: (e as Error).message,
              };
            }
            return copy;
          });
        }
      }),
    );

    return next;
  }, [slots, opts]);

  const reset = useCallback(() => setSlots([]), []);

  return { slots, addFiles, removeFile, uploadAll, reset };
}
