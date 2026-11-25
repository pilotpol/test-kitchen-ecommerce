"use client";

import React, { useCallback, useRef, useState } from "react";

import { useFileUpload, type UploadSlot } from "../reactExt/useFileUpload";

export interface FileUploaderProps {
  /** Upload function — most apps wire this to a Next.js BFF route. */
  uploadFn: (
    file: File,
    onProgress: (pct: number) => void,
  ) => Promise<{ objectKey: string }>;
  maxFiles?: number;
  maxBytesPerFile?: number;
  acceptMimeTypes?: string[];
  className?: string;
  onCompleted?: (slots: UploadSlot[]) => void;
  autoUploadOnAdd?: boolean;
}

/**
 * Drag-and-drop file uploader. Thin UI over `useFileUpload` — shows per-file
 * progress, allows removal, submits all via `uploadFn`. Works in three
 * modes: direct presigned upload, BFF-proxied upload, or file proxy route.
 */
export const FileUploader: React.FC<FileUploaderProps> = ({
  uploadFn,
  maxFiles = 5,
  maxBytesPerFile,
  acceptMimeTypes,
  className = "",
  onCompleted,
  autoUploadOnAdd = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { slots, addFiles, removeFile, uploadAll, reset } = useFileUpload({
    uploadFn,
    maxFiles,
    maxBytesPerFile,
    acceptMimeTypes,
  });

  const pickFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const err = addFiles(Array.from(files));
    if (err) setError(err);
    else setError(null);
  }, [addFiles]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const result = await uploadAll();
    onCompleted?.(result);
  }, [uploadAll, onCompleted]);

  React.useEffect(() => {
    if (autoUploadOnAdd && slots.some((s) => s.status === "pending")) {
      void handleSubmit();
    }
  }, [autoUploadOnAdd, slots, handleSubmit]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-gray-700">
          Drag files here or{" "}
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={() => inputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Up to {maxFiles} files
          {acceptMimeTypes?.length
            ? ` · ${acceptMimeTypes.join(", ")}`
            : ""}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptMimeTypes?.join(",")}
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {slots.length > 0 && (
        <ul className="space-y-2">
          {slots.map((slot, idx) => (
            <li
              key={`${slot.file.name}-${idx}`}
              className="rounded-md border border-gray-200 bg-white p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-800">
                    {slot.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(slot.file.size / 1024 / 1024).toFixed(2)} MB · {slot.status}
                  </p>
                </div>
                {slot.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
              {slot.status === "uploading" && (
                <div className="mt-1 h-1 w-full rounded bg-gray-200">
                  <div
                    className="h-1 rounded bg-blue-500 transition-all"
                    style={{ width: `${slot.progress}%` }}
                  />
                </div>
              )}
              {slot.status === "error" && slot.error && (
                <p className="mt-1 text-xs text-red-600">{slot.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {slots.length > 0 && !autoUploadOnAdd && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={slots.every((s) => s.status !== "pending")}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      )}
    </div>
  );
};
