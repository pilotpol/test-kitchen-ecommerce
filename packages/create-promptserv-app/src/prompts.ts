import path from "node:path";

import prompts from "prompts";

import { TEMPLATES, CHANNEL_TYPES, type TemplateKey } from "./templates";

export interface ScaffoldAnswers {
  appName: string;
  targetDir: string;
  template: TemplateKey;
  channelType: string;
  channelId: string;
  keycloakClientId: string;
  port: number;
  includeWebhook: boolean;
  initGit: boolean;
}

export async function runPrompts(cliArg?: string): Promise<ScaffoldAnswers> {
  const defaultName = cliArg && cliArg.length > 0 ? cliArg : "my-promptserv-app";

  const answers = await prompts(
    [
      {
        type: "text",
        name: "appName",
        message: "App name (also package name)",
        initial: defaultName,
        validate: (v: string) =>
          /^[a-z0-9][a-z0-9-]*$/.test(v)
            ? true
            : "Use kebab-case: lowercase letters, digits, and dashes",
      },
      {
        type: "select",
        name: "template",
        message: "Pick a template",
        choices: TEMPLATES.map((t) => ({
          title: t.label,
          description: t.description,
          value: t.key,
        })),
        initial: 0,
      },
      {
        type: "select",
        name: "channelType",
        message: "Channel type",
        choices: CHANNEL_TYPES.map((c) => ({
          title: c.label,
          value: c.value,
        })),
        initial: 0,
      },
      {
        type: "text",
        name: "channelId",
        message: "Channel ID (leave empty to set later via env)",
        initial: "",
      },
      {
        type: "text",
        name: "keycloakClientId",
        message: "Keycloak client ID",
        initial: (_prev: unknown, values: { appName: string }) =>
          `${values.appName}-client`,
      },
      {
        type: "number",
        name: "port",
        message: "Dev port",
        initial: (_prev: unknown, values: { template: TemplateKey }) =>
          TEMPLATES.find((t) => t.key === values.template)?.defaultPort ?? 3000,
        min: 1024,
        max: 65535,
      },
      {
        type: (_prev: unknown, values: { channelType: string }) =>
          values.channelType === "WEB_APP" ? null : "toggle",
        name: "includeWebhook",
        message: "Add webhook route?",
        initial: true,
        active: "yes",
        inactive: "no",
      },
      {
        type: "toggle",
        name: "initGit",
        message: "Initialize a git repo?",
        initial: true,
        active: "yes",
        inactive: "no",
      },
    ],
    {
      onCancel: () => {
        console.log("Cancelled.");
        process.exit(1);
      },
    },
  );

  return {
    appName: answers.appName,
    targetDir: path.resolve(process.cwd(), answers.appName),
    template: answers.template,
    channelType: answers.channelType,
    channelId: answers.channelId || "",
    keycloakClientId: answers.keycloakClientId,
    port: answers.port,
    includeWebhook: answers.includeWebhook ?? false,
    initGit: answers.initGit ?? true,
  };
}
