"use client";

import { useCallback, useState } from "react";

import type { PromptServClient } from "../client";
import type { OcrEvent, OcrRequest } from "../typesExt/ocr";

export interface UseOcrStreamOptions {
  client: PromptServClient;
}

export interface OcrStreamState {
  events: OcrEvent[];
  accumulated: string; // joined text
  isRunning: boolean;
  error: Error | null;
}

export function useOcrStream({ client }: UseOcrStreamOptions) {
  const [state, setState] = useState<OcrStreamState>({
    events: [],
    accumulated: "",
    isRunning: false,
    error: null,
  });

  const run = useCallback(
    async (req: OcrRequest, signal?: AbortSignal) => {
      setState({ events: [], accumulated: "", isRunning: true, error: null });
      try {
        for await (const evt of client.ocr.stream(req, signal)) {
          setState((prev) => ({
            ...prev,
            events: [...prev.events, evt],
            accumulated: prev.accumulated + (evt.text ?? ""),
          }));
        }
        setState((prev) => ({ ...prev, isRunning: false }));
      } catch (e) {
        setState((prev) => ({ ...prev, isRunning: false, error: e as Error }));
      }
    },
    [client],
  );

  return { ...state, run };
}
