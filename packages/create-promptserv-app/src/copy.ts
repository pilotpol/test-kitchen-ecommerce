import fs from "node:fs/promises";
import path from "node:path";

import type { ScaffoldAnswers } from "./prompts";

/** Map of `_file` → `.file` so templates can store dotfiles safely. */
const UNDERSCORE_TO_DOT: Record<string, string> = {
  _gitignore: ".gitignore",
  _env: ".env",
  "_env.example": ".env.example",
  _eslintrc: ".eslintrc",
  // The app contract read by the harness, the deploy pipeline and the
  // reviewer. A directory rather than a file, but the reason for the prefix
  // is the same: npm packaging treats a leading dot as its business.
  _promptserv: ".promptserv",
};

const TOKEN_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".env",
  ".example",
  ".yml",
  ".yaml",
  ".html",
  ".css",
]);

function renameIfDotfile(name: string): string {
  return UNDERSCORE_TO_DOT[name] ?? name;
}

function isTextFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  if (basename === "_gitignore" || basename === "_env" || basename === "_env.example") {
    return true;
  }
  return TOKEN_FILE_EXTENSIONS.has(path.extname(filePath));
}

function applyTokens(input: string, answers: ScaffoldAnswers): string {
  return input
    .replaceAll("test-app-", answers.appName)
    .replaceAll("{{CHANNEL_ID}}", answers.channelId)
    .replaceAll("{{CHANNEL_TYPE}}", answers.channelType)
    .replaceAll("{{KEYCLOAK_CLIENT_ID}}", answers.keycloakClientId)
    .replaceAll("{{PORT}}", String(answers.port));
}

async function copyRecursive(
  src: string,
  dest: string,
  answers: ScaffoldAnswers,
): Promise<void> {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      const srcEntry = path.join(src, entry);
      const destEntry = path.join(dest, renameIfDotfile(entry));
      await copyRecursive(srcEntry, destEntry, answers);
    }
    return;
  }

  if (isTextFile(src)) {
    const raw = await fs.readFile(src, "utf8");
    await fs.writeFile(dest, applyTokens(raw, answers));
  } else {
    await fs.copyFile(src, dest);
  }
}

export async function scaffoldProject(
  templatesDir: string,
  answers: ScaffoldAnswers,
): Promise<void> {
  const sharedDir = path.join(templatesDir, "_shared");
  const templateDir = path.join(templatesDir, answers.template);

  const exists = await fs
    .stat(answers.targetDir)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    throw new Error(`Target directory already exists: ${answers.targetDir}`);
  }

  await fs.mkdir(answers.targetDir, { recursive: true });

  // Copy shared files first (may be overridden by template).
  const hasShared = await fs
    .stat(sharedDir)
    .then(() => true)
    .catch(() => false);
  if (hasShared) {
    await copyRecursive(sharedDir, answers.targetDir, answers);
  }

  await copyRecursive(templateDir, answers.targetDir, answers);
}
