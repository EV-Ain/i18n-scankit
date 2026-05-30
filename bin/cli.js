#!/usr/bin/env node
import { loadConfig } from "../lib/config.js";
import { scan, check, prune } from "../lib/scan.js";
import { translate } from "../lib/translate.js";
import { c } from "../lib/utils.js";

const HELP = `
${c.bold("i18n-scankit")} — scan, sync, translate & lint your locale files

${c.bold("Usage")}
  i18n-scankit <command> [options]

${c.bold("Commands")}
  scan                 Extract t()/k() keys and sync them into every locale file.
                       Also reports dynamic keys it cannot translate.
  check                Print translation coverage per language. Exits 1 if any
                       key is untranslated (handy as a CI gate).
  prune                Remove keys from locale files that no longer exist in code.
  translate [langs..]  Machine-translate empty values from the source language.
                       Translates all target languages, or only those listed.

${c.bold("Environment")}
  DEEPL_KEY=<key>      Use DeepL instead of the free MyMemory engine.
  I18N_DYNAMIC=full    Expand every dynamic-key occurrence in "scan" output.
  NO_COLOR=1           Disable colored output.

${c.bold("Config")}
  Looks for i18n.config.{js,mjs,json} (or an "i18n" field in package.json)
  in the current directory. See the README for all options.

${c.bold("Examples")}
  i18n-scankit scan
  i18n-scankit translate
  i18n-scankit translate fr de
  DEEPL_KEY=xxxx i18n-scankit translate
  i18n-scankit check
`;

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "-h" || command === "--help" || command === "help") {
    console.log(HELP);
    return;
  }

  const cfg = await loadConfig();

  switch (command) {
    case "scan":
      scan(cfg);
      break;
    case "check":
      check(cfg);
      break;
    case "prune":
      prune(cfg);
      break;
    case "translate":
      await translate(cfg, args);
      break;
    default:
      console.error(c.red(`Unknown command: ${command}`));
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(c.red(`✗ ${err.stack || err.message}`));
  process.exit(1);
});
