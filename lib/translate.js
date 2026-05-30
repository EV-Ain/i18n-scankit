import path from "path";
import { c, readJson, writeJson } from "./utils.js";

// Private-use-area sentinel used to fence placeholder indices. Translation
// engines pass it through untouched (it is not a letter), so {{vars}} survive.
const SENTINEL = "\uE000";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function translateMyMemory(cfg, text, targetLang) {
  const src = cfg.mymemoryLang[cfg.sourceLang] ?? cfg.sourceLang;
  const tgt = cfg.mymemoryLang[targetLang] ?? targetLang;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.responseStatus !== 200) {
    throw new Error(json.responseDetails || `HTTP ${json.responseStatus}`);
  }
  const out = json.responseData?.translatedText ?? "";
  // On quota exhaustion MyMemory still returns 200 but the body is a warning —
  // reject it so we never write the warning text as a "translation".
  if (/MYMEMORY WARNING|QUOTA|PLEASE SELECT TWO DISTINCT/i.test(out)) {
    throw new Error(out);
  }
  return out;
}

async function translateDeepL(cfg, text, targetLang) {
  const res = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${cfg.deeplKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: [text],
      source_lang: cfg.deeplLang[cfg.sourceLang] ?? cfg.sourceLang.toUpperCase(),
      target_lang: cfg.deeplLang[targetLang] ?? targetLang.toUpperCase()
    })
  });
  const json = await res.json();
  // On a bad key / exhausted quota DeepL returns an error object with no
  // `translations` field — throw instead of crashing on undefined.
  if (!json.translations || json.translations.length === 0) {
    throw new Error(json.message || `DeepL error (HTTP ${res.status})`);
  }
  return json.translations[0].text;
}

async function translateOne(cfg, text, targetLang) {
  const placeholders = [];
  let idx = 0;
  // Protect {{vars}} by replacing them with a fenced index before translating.
  const sanitized = text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const i = idx++;
    placeholders.push({ i, original: `{{${name}}}` });
    return `${SENTINEL}${i}${SENTINEL}`;
  });

  let out = cfg.deeplKey
    ? await translateDeepL(cfg, sanitized, targetLang)
    : await translateMyMemory(cfg, sanitized, targetLang);

  // Restore placeholders (tolerate stray whitespace the engine may add).
  for (const { i, original } of placeholders) {
    out = out.replace(new RegExp(`${SENTINEL}\\s*${i}\\s*${SENTINEL}`, "g"), original);
  }
  out = out.replace(new RegExp(SENTINEL, "g"), ""); // drop any unrestored sentinels

  // Ensure a space on each side of every {{var}}.
  out = out.replace(/([^\s])(\{\{)/g, "$1 $2").replace(/(\}\})([^\s])/g, "$1 $2");
  return out;
}

/** `translate` — fill empty target-language values from the source language. */
export async function translate(cfg, requestedLangs) {
  const engine = cfg.deeplKey ? "DeepL" : "MyMemory";
  console.log(c.bold(`\n🌐 Translating with ${engine}\n`));

  const srcFile = path.join(cfg.localesDir, `${cfg.sourceLang}.json`);
  const srcData = readJson(srcFile);
  if (Object.keys(srcData).length === 0) {
    console.error(c.red(`✗ ${cfg.sourceLang}.json is missing or empty — run "i18n-scankit scan" first.`));
    process.exit(1);
  }
  const allKeys = Object.keys(srcData);

  // Validate requested languages; ignore unknowns with a warning.
  const valid = requestedLangs.filter(l => cfg.targetLangs.includes(l));
  const invalid = requestedLangs.filter(l => !cfg.targetLangs.includes(l));
  if (invalid.length > 0) {
    console.warn(c.yellow(`⚠  Ignoring unknown language(s): ${invalid.join(", ")} (available: ${cfg.targetLangs.join(", ")})\n`));
  }
  const targets = valid.length > 0 ? valid : cfg.targetLangs;

  for (const lang of targets) {
    const file = path.join(cfg.localesDir, `${lang}.json`);
    const data = readJson(file);
    const empty = allKeys.filter(key => data[key] === undefined || data[key] === "");

    if (empty.length === 0) {
      console.log(c.dim(`· ${lang}  nothing to translate`));
      continue;
    }

    console.log(`📝 ${c.bold(lang)}  translating ${empty.length} key(s)...`);
    let success = 0;
    let failed = 0;

    for (const key of empty) {
      try {
        const result = await translateOne(cfg, srcData[key] || key, lang);
        data[key] = result;
        writeJson(file, data); // incremental save — progress survives interruptions
        console.log(`  ${c.green("✓")} ${c.dim(`"${key}"`)} → ${result}`);
        success++;
        await sleep(cfg.requestDelay);
      } catch (err) {
        console.error(`  ${c.red("✗")} "${key}" — ${err.message}`);
        failed++;
      }
    }
    console.log(c.dim(`  → ${lang}.json saved (ok ${success}, failed ${failed})\n`));
  }

  console.log(c.green("✨ Translation complete\n"));
}
