export type TemplateKey = "api-only" | "frontend-only" | "fullstack";

export interface TemplateInfo {
  key: TemplateKey;
  label: string;
  description: string;
  defaultPort: number;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    key: "fullstack",
    label: "Fullstack (API + Frontend)",
    description:
      "Next.js app with Keycloak login, chat/ale/files proxies, and React UI components.",
    defaultPort: 3200,
  },
  {
    key: "api-only",
    label: "API only",
    description:
      "Headless channel — auth BFF + webhook handlers + gateway proxies. No UI.",
    defaultPort: 3300,
  },
  {
    key: "frontend-only",
    label: "Frontend only (SPA + tiny BFF)",
    description:
      "React SPA with a minimal Next.js BFF just for /api/auth + /api/config.",
    defaultPort: 3400,
  },
];

export const CHANNEL_TYPES = [
  { label: "Web app (form / dashboard)", value: "WEB_APP" },
  { label: "LINE bot", value: "LINE" },
  { label: "Telegram bot", value: "TELEGRAM" },
  { label: "Generic webhook", value: "WEB" },
  { label: "IoT device", value: "IOT" },
  { label: "Document pipeline", value: "DOCUMENT" },
] as const;
