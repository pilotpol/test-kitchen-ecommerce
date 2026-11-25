import { execSync } from "node:child_process";

import pc from "picocolors";

import type { ScaffoldAnswers } from "./prompts";

export function runPostInstall(answers: ScaffoldAnswers): void {
  if (answers.initGit) {
    try {
      execSync("git init -b main", {
        cwd: answers.targetDir,
        stdio: "ignore",
      });
      execSync("git add -A", { cwd: answers.targetDir, stdio: "ignore" });
      console.log(pc.dim("  · git repo initialized"));
    } catch {
      console.log(pc.yellow("  ! git init failed (skipping)"));
    }
  }
}

export function printNextSteps(answers: ScaffoldAnswers): void {
  console.log();
  console.log(pc.bold(pc.green("✔ Created ") + answers.appName));
  console.log();
  console.log(pc.bold("Next steps:"));
  console.log(`  1. ${pc.cyan(`cd ${answers.appName}`)}`);
  console.log(`  2. Copy ${pc.cyan(".env.example")} to ${pc.cyan(".env")} and fill in secrets`);
  console.log(
    `  3. Register this channel in AI Gateway admin (use ${pc.cyan("CHANNEL_API_KEY")} in .env)`,
  );
  console.log();
  console.log(pc.bold("Run it (Docker — per workspace CLAUDE.md rule):"));
  console.log(
    `  ${pc.cyan("./deploy.sh rebuild")} ${pc.dim("(from workspace root)")}`,
  );
  console.log();
  console.log(pc.bold("Or dev (if you manage node_modules via a dev container):"));
  console.log(`  ${pc.cyan("pnpm dev")}`);
  console.log();
}
