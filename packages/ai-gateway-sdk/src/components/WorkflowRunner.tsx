"use client";

import React, { useState } from "react";

import { useWorkflow } from "../reactExt/useWorkflow";

export interface WorkflowRunnerProps {
  workflowId: string;
  className?: string;
  /** Default JSON input for the text editor. */
  defaultInput?: Record<string, unknown>;
  /** Hide the JSON editor — just show run button + results. */
  hideEditor?: boolean;
  onCompleted?: (output: Record<string, unknown> | undefined) => void;
}

/**
 * Full UI for invoking a workflow: JSON input editor, run button, live
 * status timeline, result viewer. Composes `useWorkflow`.
 */
export const WorkflowRunner: React.FC<WorkflowRunnerProps> = ({
  workflowId,
  className = "",
  defaultInput,
  hideEditor = false,
  onCompleted,
}) => {
  const { definition, lastRun, isRunning, error, run, cancel } = useWorkflow({
    workflowId,
  });
  const [inputText, setInputText] = useState(
    defaultInput ? JSON.stringify(defaultInput, null, 2) : "{}",
  );
  const [inputError, setInputError] = useState<string | null>(null);

  React.useEffect(() => {
    if (lastRun?.status === "completed") {
      onCompleted?.(lastRun.output_data);
    }
  }, [lastRun, onCompleted]);

  const onRun = async () => {
    setInputError(null);
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputText || "{}");
    } catch (e) {
      setInputError(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    await run({ input: parsedInput });
  };

  const statusColor =
    lastRun?.status === "completed"
      ? "bg-green-100 text-green-800"
      : lastRun?.status === "failed"
        ? "bg-red-100 text-red-800"
        : lastRun?.status === "running"
          ? "bg-blue-100 text-blue-800"
          : lastRun?.status === "awaiting_approval"
            ? "bg-amber-100 text-amber-800"
            : "bg-gray-100 text-gray-700";

  return (
    <section className={`space-y-3 ${className}`}>
      <header>
        <h3 className="text-sm font-semibold text-gray-900">
          {definition?.name ?? workflowId}
        </h3>
        {definition?.description && (
          <p className="text-xs text-gray-600">{definition.description}</p>
        )}
      </header>

      {!hideEditor && (
        <div>
          <label className="block text-xs font-medium text-gray-700">
            Input (JSON)
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={6}
            spellCheck={false}
            className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-xs"
          />
          {inputError && (
            <p className="mt-1 text-xs text-red-600">{inputError}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? "Running..." : "Run"}
        </button>
        {isRunning && (
          <button
            type="button"
            onClick={cancel}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        {lastRun && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {lastRun.status}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {error.message}
        </div>
      )}

      {lastRun?.error_message && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {lastRun.error_message}
        </div>
      )}

      {lastRun?.output_data && (
        <details className="rounded border border-gray-200 bg-gray-50 p-2">
          <summary className="cursor-pointer text-xs text-gray-700">
            Output
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto text-xs text-gray-800">
            {JSON.stringify(lastRun.output_data, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
};
