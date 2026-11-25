"use client";

import React, { useEffect, useState } from "react";

/**
 * Generic JSON Schema (Draft 7 subset) supported by the auto-generated form.
 * Documented subset for v0.2:
 *   - type: "object" with properties
 *   - per-property type: string | number | boolean
 *   - per-property: title, description, enum (string[]), format ("date" only)
 *   - top-level required: string[]
 *
 * Out of scope for v0.2: anyOf, oneOf, $ref, nested objects, arrays of
 * objects. Apps with richer schemas can render their own form ฝั่งขวา and
 * still use the split layout — pass children instead of (schema, values).
 */
export interface DocumentReviewSchemaProperty {
  type: "string" | "number" | "boolean";
  title?: string;
  description?: string;
  enum?: string[];
  format?: "date";
}

export interface DocumentReviewSchema {
  type: "object";
  properties: Record<string, DocumentReviewSchemaProperty>;
  required?: string[];
}

export interface DocumentReviewSplitProps {
  /**
   * Image source. Supports:
   *   - http(s) URL string  → rendered in <img>
   *   - data: URL string    → rendered in <img>
   *   - File object         → rendered via createObjectURL (auto-revoked)
   *   - PDF URL: passed to <iframe> for native browser viewer
   */
  source: string | File;
  /**
   * Schema for the right-hand form. Required when ``children`` is unset.
   * When ``children`` is provided, schema is ignored — caller renders.
   */
  schema?: DocumentReviewSchema;
  /** Initial form values keyed by schema property name. */
  initialValues?: Record<string, string | number | boolean>;
  /**
   * Submit handler. Receives the validated form values. Should throw or
   * return a rejected promise to keep the form in submitting state with
   * an error message.
   */
  onSubmit: (values: Record<string, string | number | boolean>) => Promise<void> | void;
  onCancel?: () => void;
  /** Override the right-hand form (advanced). */
  children?: React.ReactNode;
  /** Tailwind classes appended to the root element. */
  className?: string;
  /** Labels for the two buttons. */
  submitLabel?: string;
  cancelLabel?: string;
}

/**
 * Universal split-screen review UI for human-in-the-loop OCR review.
 *
 * Used by FPO UC3 (handwritten Thai forms), SPW (POS receipts), BAAC UC1
 * (medical claims). Apps pass:
 *   1. ``source`` — image/PDF on the left
 *   2. ``schema`` — JSON Schema generates the right-hand form
 *   3. ``onSubmit`` — receives the cleaned values
 *
 * For PDFs the left pane renders an ``<iframe>`` so the browser's native
 * PDF viewer handles paging. Image files use ``<img>`` with a contained
 * fit. Both panes scroll independently.
 */
export function DocumentReviewSplit({
  source,
  schema,
  initialValues = {},
  onSubmit,
  onCancel,
  children,
  className = "",
  submitLabel = "Confirm",
  cancelLabel = "Cancel",
}: DocumentReviewSplitProps) {
  const [values, setValues] =
    useState<Record<string, string | number | boolean>>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For File → object URL (auto-revoke on unmount / source change)
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (source instanceof File) {
      const url = URL.createObjectURL(source);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setObjectUrl(null);
    return undefined;
  }, [source]);

  const sourceUrl =
    typeof source === "string" ? source : objectUrl ?? "";
  const isPdf =
    typeof source === "string"
      ? /\.pdf($|\?)/i.test(source) || source.startsWith("data:application/pdf")
      : source.type === "application/pdf";

  const updateField = (name: string, raw: string | boolean) => {
    if (!schema) return;
    const prop = schema.properties[name];
    if (!prop) return;
    let parsed: string | number | boolean = raw;
    if (prop.type === "number" && typeof raw === "string") {
      parsed = raw === "" ? "" : Number(raw);
    }
    setValues((prev) => ({ ...prev, [name]: parsed }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (schema?.required) {
      for (const r of schema.required) {
        const v = values[r];
        if (v === undefined || v === "" || v === null) {
          setError(`Field "${schema.properties[r]?.title ?? r}" is required`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (e) {
      setError((e as Error).message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`grid h-full grid-cols-1 gap-4 lg:grid-cols-2 ${className}`}
    >
      {/* Left: source */}
      <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
          Source document
        </div>
        <div className="flex-1 overflow-auto p-2">
          {!sourceUrl && (
            <p className="p-4 text-sm text-gray-400">No source provided</p>
          )}
          {sourceUrl &&
            (isPdf ? (
              <iframe
                title="Document preview"
                src={sourceUrl}
                className="h-full min-h-[400px] w-full"
              />
            ) : (
              <img
                src={sourceUrl}
                alt="Document preview"
                className="h-auto w-full object-contain"
              />
            ))}
        </div>
      </div>

      {/* Right: form */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col rounded-lg border border-gray-200 bg-white"
      >
        <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
          Extracted fields
        </div>
        <div className="flex-1 space-y-3 overflow-auto p-3">
          {children}
          {!children && schema &&
            Object.entries(schema.properties).map(([name, prop]) => {
              const value = values[name] ?? "";
              const isRequired = schema.required?.includes(name) ?? false;
              const label = prop.title ?? name;
              return (
                <div key={name}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {label}
                    {isRequired && <span className="text-red-500"> *</span>}
                  </label>
                  {prop.description && (
                    <p className="mb-1 text-xs text-gray-500">
                      {prop.description}
                    </p>
                  )}
                  {prop.enum ? (
                    <select
                      value={String(value)}
                      onChange={(e) => updateField(name, e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— select —</option>
                      {prop.enum.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : prop.type === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => updateField(name, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  ) : prop.format === "date" ? (
                    <input
                      type="date"
                      value={String(value)}
                      onChange={(e) => updateField(name, e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  ) : (
                    <input
                      type={prop.type === "number" ? "number" : "text"}
                      value={String(value)}
                      onChange={(e) => updateField(name, e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              );
            })}
        </div>

        {error && (
          <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 px-3 py-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {submitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
