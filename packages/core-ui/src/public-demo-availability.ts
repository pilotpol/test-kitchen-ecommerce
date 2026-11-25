// Public production demos that are intentionally not running. Remove one id
// only after its public demo is live again; Hub and Portfolio both read this
// list, so no card or URL needs a second availability edit.
export const DEMO_ON_REQUEST_APP_IDS = [
  "aeon",
  "baac",
  "cfo",
  "dga",
  "fda",
  "mti",
  "nissan",
  "nki",
  "peopleplus",
  "pr9",
  "rmutx",
  "siph",
  "spw",
  "tcc",
  "tgh",
  "watson",
  "whitestory",
  "localbox-demo",
] as const;

export type PublicDemoAvailability = "live" | "on-request";

const DEMO_ON_REQUEST_APP_ID_SET = new Set<string>(DEMO_ON_REQUEST_APP_IDS);

export function getPublicDemoAvailability(appId: string): PublicDemoAvailability {
  return DEMO_ON_REQUEST_APP_ID_SET.has(appId.trim().toLowerCase())
    ? "on-request"
    : "live";
}

export function isPublicDemoLive(appId: string): boolean {
  return getPublicDemoAvailability(appId) === "live";
}
