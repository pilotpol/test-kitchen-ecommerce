import { Transport } from "../transport";

/**
 * System One decisions - typed, calibrated answers from a decision model,
 * behind the same key the app uses for chat.
 *
 * A System One model (the term is TypeSafe AI's, for their Jev model) does
 * not generate text. It takes a `state` and a set of typed questions and
 * returns a probability for every option in one forward pass - tens of
 * milliseconds, and it cannot answer outside the schema you gave it. Use it
 * for the decisions inside a workflow (route this document where? does this
 * match? is this urgent?) and keep the LLM ("System Two") for reading
 * unstructured input and writing text.
 *
 * Three models are registered on the gateway (each a model row of type
 * `systemone`, so `targets()` lists them by name): iApp's OpenThai-SystemOne
 * and Convai's laya on the PromptServe boxes, TypeSafe's Jev through
 * OpenRouter. Name one with `model` to pin it; name none and the gateway
 * takes the first box server that answers - never the cloud model, which is
 * billed per token. A named model is never substituted: an unknown name is a
 * 404 listing what exists, and a model named together with a box it is not on
 * is a 404 too.
 *
 * Wire contract mirrors TypeSafe's `POST /v1/systemone`, so code written for
 * either backend can point at the other. Gateway extensions: `box` (pin a
 * machine by name) on the request; `kind`, `provider`, `provider_model`,
 * `latency_ms` and, on a box, `box`, `box_id`, `device_type` on the response.
 *
 *   const s1 = client.systemOne;
 *   const r = await s1.decide(
 *     { email_subject, email_body },
 *     {
 *       flow: s1.choice("อีเมลนี้เป็นงานของ flow ใด", { tbas: "ใบแจ้งหนี้ TBAS", nitto: "Delivery note จาก Nitto" }),
 *       urgent: s1.noul("ต้องทำภายในวันนี้หรือไม่"),
 *       tone: s1.score("ระดับความเร่งด่วนของถ้อยคำ", ["ปกติ", "เร่ง", "เร่งมาก"]),
 *     },
 *   );
 *   r.answers.flow.choice        // "nitto"
 *   r.answers.flow.confidence    // 0.91
 *   if (s1.needsReview(r.answers.flow, 0.7)) { ...send to the human queue }
 */

export type SystemOneQuestionType = "choice" | "score" | "noul";

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  /** option name -> description, or null when the name is self-explanatory. Max 255 options. */
  criteria: Record<string, string | null>;
}

export interface ScoreQuestion {
  type: "score";
  instructions: string;
  /** ordered levels, low to high; 2..10 entries */
  criteria: string[];
}

export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria?: { true?: string | null; false?: string | null };
}

export type SystemOneQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  /** 1 - normalised entropy over the options; 1 = certain */
  confidence: number;
  /** OpenThai extension: probability that none of the options fits */
  abstain?: number;
}

export interface ScoreAnswer {
  type: "score";
  /** probability-weighted position on the rubric, 0 .. levels-1 */
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface NoulAnswer {
  type: "noul";
  /** p(yes) */
  noul: number;
}

export type SystemOneAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type SystemOneState = string | Record<string, unknown> | unknown[];

export interface SystemOneRequest {
  state: SystemOneState;
  questions: Record<string, SystemOneQuestion>;
  /** Which System One model answers: a gateway model name (see `targets()`),
   *  its provider slug, or its row id. Omit for the default box server. */
  model?: string;
  /** Pin the answer to one box (name or id). Omit to let the gateway pick. */
  box?: string;
}

export interface SystemOneResponse<Q extends string = string> {
  /** The gateway's name for the model that answered. */
  model: string;
  answers: Record<Q, SystemOneAnswer>;
  usage: { input_tokens: number; output_tokens: number; cost?: number };
  /** "box" for a model on PromptServe hardware, "cloud" for a provider. */
  kind?: "box" | "cloud";
  provider?: string;
  provider_model?: string;
  /** What the provider called the model, when it differs from `model`. */
  actual_model?: string;
  /** Present on a box answer only. */
  box?: string;
  box_id?: string;
  device_type?: string;
  latency_ms: number;
}

export interface SystemOneTarget {
  /** The name to pass as `model` to reach this target. */
  model: string;
  kind: "box" | "cloud";
  provider?: string;
  provider_model?: string;
  /** Empty for a cloud target. */
  box_id: string;
  name: string;
  box: string;
  device_type?: string;
  /** A cloud target is `online` when the gateway holds a key for it; it is
   *  not probed, because every request there is billed. */
  status: "online" | "offline" | "not_configured";
  host?: string;
  latency_ms?: number;
  error?: string;
}

export class SystemOneNamespace {
  constructor(private transport: Transport) {}

  /** One decision call: every question is answered in the same forward pass. */
  async decide<Q extends string>(
    state: SystemOneState,
    questions: Record<Q, SystemOneQuestion>,
    opts: { box?: string; model?: string; signal?: AbortSignal; timeout?: number } = {},
  ): Promise<SystemOneResponse<Q>> {
    const body: SystemOneRequest = { state, questions };
    if (opts.box) body.box = opts.box;
    if (opts.model) body.model = opts.model;
    return this.transport.request<SystemOneResponse<Q>>({
      method: "POST",
      path: `/v1/systemone`,
      body,
      signal: opts.signal,
      timeout: opts.timeout,
    });
  }

  /** Every System One model the gateway can ask - on the boxes and in the
   *  cloud - and whether each answers now. */
  async targets(): Promise<SystemOneTarget[]> {
    const r = await this.transport.request<{ targets: SystemOneTarget[] }>({
      method: "GET",
      path: `/v1/systemone/targets`,
    });
    return r.targets ?? [];
  }

  // ---- question builders -------------------------------------------------

  choice(instructions: string, criteria: Record<string, string | null> | string[]): ChoiceQuestion {
    const map: Record<string, string | null> = Array.isArray(criteria)
      ? Object.fromEntries(criteria.map((k) => [k, null]))
      : criteria;
    return { type: "choice", instructions, criteria: map };
  }

  score(instructions: string, levels: string[]): ScoreQuestion {
    return { type: "score", instructions, criteria: levels };
  }

  noul(instructions: string, criteria?: NoulQuestion["criteria"]): NoulQuestion {
    return criteria ? { type: "noul", instructions, criteria } : { type: "noul", instructions };
  }

  // ---- decision helpers --------------------------------------------------

  /**
   * True when the answer is not confident enough to act on without a person.
   * For choice/score this is the model's confidence; for noul it is how far
   * p(yes) sits from 0.5. The threshold is the workflow's policy, not the
   * model's - a routing choice can accept 0.6, a posting decision wants 0.9.
   */
  needsReview(answer: SystemOneAnswer, threshold = 0.75): boolean {
    if (answer.type === "noul") return Math.abs(answer.noul - 0.5) * 2 < threshold;
    return answer.confidence < threshold;
  }

  /** p(yes) >= threshold, for reading a noul as a boolean. */
  yes(answer: NoulAnswer, threshold = 0.5): boolean {
    return answer.noul >= threshold;
  }

  /** Options sorted by probability, highest first. */
  ranked(answer: ChoiceAnswer): Array<{ option: string; p: number }> {
    return Object.entries(answer.probabilities)
      .map(([option, p]) => ({ option, p }))
      .sort((a, b) => b.p - a.p);
  }
}
