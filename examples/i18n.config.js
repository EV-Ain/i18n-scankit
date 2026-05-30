/**
 * Example configuration for i18n-scankit.
 * Copy this to your project root as `i18n.config.js` and adjust.
 *
 * Every field is optional; the values below are close to the defaults.
 */
export default {
  // Languages. Mark exactly one as the source (its values are the keys
  // themselves). `deepl` / `mymemory` override the code sent to each engine.
  langs: [
    { code: "en", source: true },
    { code: "zh-CN", deepl: "ZH", mymemory: "zh-CN" },
    { code: "ja", deepl: "JA" },
    { code: "fr", deepl: "FR" }
  ],

  // Directory holding `<code>.json` locale files (relative to this file).
  localesDir: "src/i18n/locales",

  // Directory to scan for translation calls.
  srcDir: "src",

  // File extensions to scan.
  extensions: [".tsx", ".ts", ".jsx", ".js"],

  // Functions whose first string argument is a key. The FIRST entry is also the
  // function checked for dynamic (non-literal) usage. `t` is i18next's hook;
  // `k` is the no-op marker exported by this package.
  markers: ["t", "k"],

  // Files whose basename contains this string are treated as a manual key
  // registry: every string literal inside them is collected as a key.
  registryPattern: "dynamic-keys",

  // Delay between translation requests, in ms (rate-limit friendly).
  requestDelay: 300
};
