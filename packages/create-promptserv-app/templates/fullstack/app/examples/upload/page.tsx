"use client";

import { FileUploader } from "@repo/ai-gateway-sdk/components";
import { usePromptServClient } from "@repo/ai-gateway-sdk/react-ext";

export default function UploadExamplePage() {
  const client = usePromptServClient();

  const uploadFn = async (
    file: File,
    onProgress: (pct: number) => void,
  ): Promise<{ objectKey: string }> => {
    const presign = await client.files.presignUpload({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    });
    onProgress(10);
    const objectKey = await client.files.uploadToPresigned(presign, file);
    onProgress(100);
    return { objectKey };
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">File Upload (MinIO presign)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Uploads go direct to MinIO via presigned URL — the channel key never
        reaches the browser.
      </p>
      <div className="mt-4 rounded-lg border bg-white p-4">
        <FileUploader uploadFn={uploadFn} />
      </div>
    </main>
  );
}
