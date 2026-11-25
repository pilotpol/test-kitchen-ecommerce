import path from "node:path";

import pc from "picocolors";

import { scaffoldProject } from "./copy";
import { runPostInstall, printNextSteps } from "./postInstall";
import { runPrompts } from "./prompts";
import { maybeRegisterChannel } from "./registerChannel";

async function main(): Promise<void> {
  const cliArg = process.argv[2];

  console.log();
  console.log(pc.bold(pc.blue("◆ create-promptserv-app")));
  console.log(pc.dim("  Scaffold a new PromptServ channel app"));
  console.log();

  const answers = await runPrompts(cliArg);

  // __dirname is the compiled dist/. Templates ship as a sibling dir.
  const templatesDir = path.resolve(__dirname, "..", "templates");

  console.log();
  console.log(pc.dim(`  · scaffolding into ${answers.targetDir}`));
  await scaffoldProject(templatesDir, answers);

  await maybeRegisterChannel(answers);
  runPostInstall(answers);
  printNextSteps(answers);
}

main().catch((err: Error) => {
  console.error();
  console.error(pc.red("✖ "), err.message);
  process.exit(1);
});
