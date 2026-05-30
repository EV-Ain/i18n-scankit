import fs from "fs";
import path from "path";
import {
  c,
  fileCell,
  getAllFiles,
  readJson,
  writeJson,
  escapeRegExp
} from "./utils.js";

function localeFile(cfg, lang) {
  return path.join(cfg.localesDir, `${lang}.json`);
}

function readLang(cfg, lang) {
  return readJson(localeFile(cfg, lang));
}

/**
 * Collect every static key from the source tree:
 *   - marker calls, e.g. t("...") / k("...")
 *   - all string literals inside registry files (basename matches registryPattern)
 */
function scanKeys(cfg, { quiet = false } = {}) {
  const files = getAllFiles(cfg.srcDir, cfg.extensions);
  if (!quiet) {
    console.log(c.dim(`Scanning ${path.relative(cfg.cwd, cfg.srcDir) || "."}/  (${files.length} files)`));
  }

  const markerGroup = cfg.markers.map(escapeRegExp).join("|");
  const markerRegex = new RegExp(`\\b(?:${markerGroup})\\(\\s*['"\`]([^'"\`\\n]+)['"\`]`, "g");
  const literalRegex = /['"`]([^'"`\n]+)['"`]/g;
  const registryTest = new RegExp(`${escapeRegExp(cfg.registryPattern)}\\.[jt]sx?$`);

  const keys = new Set();
  for (const file of files) {
    const code = fs.readFileSync(file, "utf-8");
    const regex = registryTest.test(file) ? literalRegex : markerRegex;
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const key = match[1].trim();
      if (key.length > 0 && !key.startsWith("/") && !key.startsWith("http")) {
        keys.add(key);
      }
    }
  }
  return keys;
}

/**
 * Detect dynamic keys: calls to the translate function whose first argument is
 * not a string literal (e.g. t(tab.label), t(faq.q)). These cannot be extracted
 * or translated statically — they need a k() marker or a manual registry entry.
 */
function reportDynamic(cfg) {
  const files = getAllFiles(cfg.srcDir, cfg.extensions);
  const fn = escapeRegExp(cfg.translateFn);
  const dynRegex = new RegExp(`\\b${fn}\\(\\s*(?!['"\`])([^\\n,)]+)`, "g");
  const hits = [];

  for (const file of files) {
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    lines.forEach((line, i) => {
      dynRegex.lastIndex = 0;
      let match;
      while ((match = dynRegex.exec(line)) !== null) {
        const expr = match[1].trim();
        if (expr.length === 0 || expr.includes("=>")) continue; // arrow-fn noise
        if (/['"`]/.test(expr)) continue; // contains a literal → already captured
        hits.push({ file: path.relative(cfg.cwd, file), line: i + 1, expr });
      }
    });
  }

  if (hits.length === 0) return;

  const byFile = hits.reduce((acc, h) => {
    (acc[h.file] ??= []).push(h);
    return acc;
  }, {});
  const fileNames = Object.keys(byFile).sort();

  console.log(
    `\n${c.red("⚠  Found")} ${c.yellow(hits.length)} dynamic key(s) across ${c.yellow(fileNames.length)} file(s) ${c.dim("— cannot be translated; mark with k() or add to the registry")}\n`
  );

  const verbose = process.env.I18N_DYNAMIC === "full";

  if (!verbose) {
    // Collapsed: one line per file, linked to its first occurrence.
    const rows = fileNames.map(file => ({
      cell: fileCell(cfg.cwd, file, byFile[file][0].line),
      count: byFile[file].length
    }));
    const width = Math.max(...rows.map(r => r.cell.visible.length));
    for (const r of rows) {
      const pad = " ".repeat(width - r.cell.visible.length);
      console.log(`  ${r.cell.render(r.cell.visible)}${pad}   ${c.yellow(`× ${r.count}`)}`);
    }
    console.log(c.dim(`\n  Tip: I18N_DYNAMIC=full i18n-scankit scan  expands every occurrence`));
    return;
  }

  // Expanded: one clickable line per occurrence.
  const cells = hits.map(h => ({ cell: fileCell(cfg.cwd, h.file, h.line), expr: h.expr }));
  const width = Math.max(...cells.map(x => x.cell.visible.length));
  for (const x of cells) {
    const pad = " ".repeat(width - x.cell.visible.length);
    console.log(`  ${x.cell.render(x.cell.visible)}${pad}   ${c.cyan(`${cfg.translateFn}(${x.expr})`)}`);
  }
}

/** `scan` — extract keys and sync them into every locale file. */
export function scan(cfg) {
  console.log(c.bold("\n🔍 Scanning for keys...\n"));
  const keys = scanKeys(cfg);
  console.log(`Found ${c.bold(keys.size)} key(s)\n`);

  for (const lang of cfg.codes) {
    const data = readLang(cfg, lang);
    let added = 0;
    for (const key of keys) {
      if (data[key] === undefined) {
        data[key] = lang === cfg.sourceLang ? key : "";
        added++;
      }
    }
    writeJson(localeFile(cfg, lang), data);
    const mark = added > 0 ? c.green("✓") : c.dim("·");
    console.log(`  ${mark} ${lang.padEnd(8)} ${added > 0 ? c.green(`+${added}`) : c.dim("unchanged")}`);
  }

  reportDynamic(cfg);
  console.log(c.green("\n✨ Done\n"));
}

/** `check` — report translation progress per target language. */
export function check(cfg) {
  console.log(c.bold("\n🔎 Checking translation coverage...\n"));
  const srcData = readLang(cfg, cfg.sourceLang);
  const allKeys = Object.keys(srcData);
  const total = allKeys.length;
  let missingTotal = 0;

  for (const lang of cfg.targetLangs) {
    const data = readLang(cfg, lang);
    const missing = allKeys.filter(key => data[key] === undefined || data[key] === "");
    const done = total - missing.length;
    const pct = total === 0 ? 100 : (done / total) * 100;
    const tone = pct >= 100 ? c.green : pct >= 90 ? c.yellow : c.red;

    console.log(`  ${c.bold(lang.padEnd(8))} ${done}/${total}  ${tone(`${pct.toFixed(1)}%`)}`);
    for (const key of missing) {
      console.log(`     ${c.dim("· missing")} ${c.yellow(`"${key}"`)}`);
    }
    missingTotal += missing.length;
  }

  if (missingTotal === 0) {
    console.log(c.green("\n✅ All translations complete\n"));
  } else {
    console.log(c.yellow(`\n${missingTotal} key(s) untranslated\n`));
    process.exitCode = 1; // let CI gate on missing translations
  }
}

/** `prune` — remove keys from locale files that no longer exist in the source. */
export function prune(cfg) {
  console.log(c.bold("\n🗑  Pruning unused keys...\n"));
  const codeKeys = scanKeys(cfg);
  console.log(`Valid keys in code: ${c.bold(codeKeys.size)}\n`);

  let totalRemoved = 0;
  for (const lang of cfg.codes) {
    const data = readLang(cfg, lang);
    let removed = 0;
    for (const key of Object.keys(data)) {
      if (!codeKeys.has(key)) {
        console.log(`  ${c.red("−")} ${c.dim(`[${lang}]`)} "${key}"`);
        delete data[key];
        removed++;
        if (lang === cfg.sourceLang) totalRemoved++;
      }
    }
    writeJson(localeFile(cfg, lang), data);
    const mark = removed > 0 ? c.green("✓") : c.dim("·");
    console.log(`  ${mark} ${lang.padEnd(8)} ${removed > 0 ? c.red(`−${removed}`) : c.dim("nothing to remove")}\n`);
  }

  console.log(totalRemoved === 0 ? c.green("✅ No unused keys") : c.yellow(`Removed ${totalRemoved} unused key(s)`));
  console.log(c.green("\n✨ Done\n"));
}
