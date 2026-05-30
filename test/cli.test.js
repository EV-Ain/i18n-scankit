import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/cli.js");

/** Create a throwaway project, run a CLI command in it, return the temp dir. */
function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scankit-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

function run(dir, args, env = {}) {
  return execFileSync("node", [CLI, ...args], {
    cwd: dir,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", ...env }
  });
}

const CONFIG = `export default {
  langs: [{ code: "en", source: true }, { code: "zh-CN" }],
  localesDir: "locales",
  srcDir: "src"
};`;

test("scan extracts t() and k() keys into all locales", () => {
  const dir = makeProject({
    "i18n.config.js": CONFIG,
    "src/App.jsx": `
      const TABS = [{ id: "open", label: k("Open orders") }];
      export default () => <span>{t("Hello world")}{t(tab.label)}</span>;
    `
  });

  run(dir, ["scan"]);

  const en = JSON.parse(fs.readFileSync(path.join(dir, "locales/en.json"), "utf-8"));
  const zh = JSON.parse(fs.readFileSync(path.join(dir, "locales/zh-CN.json"), "utf-8"));

  // Both the t() literal and the k()-marked label are captured.
  assert.equal(en["Hello world"], "Hello world"); // source value == key
  assert.equal(en["Open orders"], "Open orders");
  assert.equal(zh["Hello world"], ""); // target starts empty
  assert.ok("Open orders" in zh);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("scan reports dynamic t(variable) usage", () => {
  const dir = makeProject({
    "i18n.config.js": CONFIG,
    "src/App.jsx": `export default () => <span>{t(tab.label)}</span>;`
  });

  const out = run(dir, ["scan"]);
  assert.match(out, /dynamic key/i);
  assert.match(out, /App\.jsx/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("check exits non-zero when translations are missing", () => {
  const dir = makeProject({
    "i18n.config.js": CONFIG,
    "src/App.jsx": `export default () => <span>{t("Hello")}</span>;`
  });
  run(dir, ["scan"]); // zh-CN."Hello" is empty

  assert.throws(() => run(dir, ["check"]), /Command failed/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("prune removes keys no longer present in source", () => {
  const dir = makeProject({
    "i18n.config.js": CONFIG,
    "src/App.jsx": `export default () => <span>{t("Kept")}</span>;`,
    "locales/en.json": `{\n  "Kept": "Kept",\n  "Gone": "Gone"\n}\n`
  });

  run(dir, ["prune"]);
  const en = JSON.parse(fs.readFileSync(path.join(dir, "locales/en.json"), "utf-8"));
  assert.ok("Kept" in en);
  assert.ok(!("Gone" in en));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("registry file contributes plain string literals as keys", () => {
  const dir = makeProject({
    "i18n.config.js": CONFIG,
    "src/App.jsx": `export default () => <span>{t(status)}</span>;`,
    "src/dynamic-keys.js": `export const DYNAMIC_KEYS = ["Pending", "Filled"];`
  });

  run(dir, ["scan"]);
  const en = JSON.parse(fs.readFileSync(path.join(dir, "locales/en.json"), "utf-8"));
  assert.ok("Pending" in en);
  assert.ok("Filled" in en);

  fs.rmSync(dir, { recursive: true, force: true });
});
