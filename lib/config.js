import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { c } from "./utils.js";

/**
 * Default configuration. Every project may override any field via an
 * `i18n.config.{js,mjs,json}` file or an `"i18n"` field in package.json.
 */
const DEFAULTS = {
  // Languages. The one with `source: true` (or the first entry) is the source
  // language; its values are the keys themselves. Others are translation targets.
  langs: [{ code: "en", source: true }],
  // Where the `<code>.json` locale files live (relative to cwd).
  localesDir: "locales",
  // Root directory to scan for translation calls (relative to cwd).
  srcDir: "src",
  // File extensions to scan.
  extensions: [".tsx", ".ts", ".jsx", ".js"],
  // Function names treated as "extract this literal key", e.g. t("...") / k("...").
  // The FIRST entry is the runtime translate function used for dynamic-key detection.
  markers: ["t", "k"],
  // Files whose basename matches this substring are treated as a manual key
  // registry: every string literal inside them is collected.
  registryPattern: "dynamic-keys",
  // Delay (ms) between translation requests, to respect rate limits.
  requestDelay: 300
};

const CONFIG_FILES = ["i18n.config.js", "i18n.config.mjs", "i18n.config.json"];

function fail(msg) {
  console.error(c.red(`✗ ${msg}`));
  process.exit(1);
}

async function readUserConfig(cwd) {
  for (const name of CONFIG_FILES) {
    const file = path.join(cwd, name);
    if (!fs.existsSync(file)) continue;
    if (file.endsWith(".json")) {
      return { config: JSON.parse(fs.readFileSync(file, "utf-8")), file };
    }
    const mod = await import(pathToFileURL(file).href);
    return { config: mod.default ?? mod, file };
  }
  // Fallback: an "i18n" field in package.json.
  const pkgFile = path.join(cwd, "package.json");
  if (fs.existsSync(pkgFile)) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8"));
    if (pkg.i18n) return { config: pkg.i18n, file: pkgFile };
  }
  return { config: {}, file: null };
}

/**
 * Load and normalise the effective configuration for the current project.
 */
export async function loadConfig(cwd = process.cwd()) {
  const { config: userConfig, file: configFile } = await readUserConfig(cwd);
  const cfg = { ...DEFAULTS, ...userConfig };

  const langs = (cfg.langs || DEFAULTS.langs).map(l => (typeof l === "string" ? { code: l } : l));
  if (langs.length === 0) fail("i18n config: `langs` must contain at least one language.");

  const source = langs.find(l => l.source) ?? langs[0];

  return {
    langs,
    sourceLang: source.code,
    targetLangs: langs.filter(l => l.code !== source.code).map(l => l.code),
    codes: langs.map(l => l.code),
    localesDir: path.resolve(cwd, cfg.localesDir),
    srcDir: path.resolve(cwd, cfg.srcDir),
    extensions: cfg.extensions,
    markers: cfg.markers,
    translateFn: cfg.markers[0] ?? "t",
    registryPattern: cfg.registryPattern,
    requestDelay: cfg.requestDelay,
    deeplKey: process.env.DEEPL_KEY || cfg.deeplKey || "",
    mymemoryLang: Object.fromEntries(langs.map(l => [l.code, l.mymemory ?? l.code])),
    deeplLang: Object.fromEntries(langs.map(l => [l.code, l.deepl ?? l.code.toUpperCase()])),
    cwd,
    configFile
  };
}
