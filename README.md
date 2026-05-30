# i18n-scankit

**English** · [简体中文](./README.zh-CN.md)

> Zero-build CLI that scans your source for `t()` / `k()` calls, syncs locale
> JSON files, machine-translates the missing keys, and flags the dynamic keys it
> _can't_ translate — with clickable, color terminal output.

[![CI](https://github.com/your-name/i18n-scankit/actions/workflows/ci.yml/badge.svg)](https://github.com/your-name/i18n-scankit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/i18n-scankit.svg)](https://www.npmjs.com/package/i18n-scankit)
[![license](https://img.shields.io/npm/l/i18n-scankit.svg)](./LICENSE)

`i18n-scankit` is a tiny, dependency-free companion for libraries like
[i18next](https://www.i18next.com/) that use the **source text as the key**
(`t("Hello world")`). It keeps your locale JSON in sync with the code, fills in
machine translations, and — crucially — tells you about the keys static analysis
can never see.

---

## Why

Most "source-text-as-key" workflows quietly break on **dynamic keys**:

```jsx
const TABS = [{ id: "open", label: "Open orders" }];
//  ...
<span>{t(tab.label)}</span>   // ← the scanner can't see "Open orders"
```

A regex scanner only sees `t(tab.label)`, never the string, so the key is never
added to your locale files and never translated. Your non-source UI silently
falls back to showing source text. `i18n-scankit` **detects these**, and gives
you two clean ways to fix them (`k()` markers or a registry file).

## Features

- **`scan`** — extract keys from `t()` / `k()` calls and sync them into every
  locale file (sorted, stable diffs).
- **Dynamic-key detection** — report every `t(variable)` the scanner can't
  translate, grouped by file, with clickable `path:line`.
- **`translate`** — machine-translate empty values via **DeepL** (best quality)
  or the free **MyMemory** engine. Incremental saving, `{{variable}}`
  protection, and quota/error detection built in.
- **`check`** — per-language coverage with percentages; **exits `1`** when keys
  are missing, so CI can gate on it.
- **`prune`** — delete keys that no longer exist in the source.
- **Zero build, zero deps** — plain ESM, runs on Node 18+. Ships TypeScript types
  for the `k()` marker.
- **Nice output** — color that auto-downgrades for pipes / CI / `NO_COLOR`, and
  OSC 8 hyperlinks that jump to the exact line in the VS Code terminal.

---

## Install

```bash
npm install --save-dev i18n-scankit
# or
yarn add -D i18n-scankit
# or
pnpm add -D i18n-scankit
```

> Prefer not to publish/consume from npm? Install straight from Git:
> `yarn add -D github:your-name/i18n-scankit`

Add scripts to your `package.json`:

```jsonc
{
  "scripts": {
    "i18n:scan": "i18n-scankit scan",
    "i18n:translate": "i18n-scankit translate",
    "i18n:check": "i18n-scankit check",
    "i18n:prune": "i18n-scankit prune"
  }
}
```

---

## Configure

Create `i18n.config.js` in your project root (see
[`examples/i18n.config.js`](./examples/i18n.config.js)):

```js
export default {
  langs: [
    { code: "en", source: true },        // source language (values == keys)
    { code: "zh-CN", deepl: "ZH" },      // target language
    { code: "ja", deepl: "JA" }
  ],
  localesDir: "src/i18n/locales",        // where <code>.json files live
  srcDir: "src",                         // what to scan
  extensions: [".tsx", ".ts", ".jsx", ".js"],
  markers: ["t", "k"],                   // functions whose 1st string arg is a key
  registryPattern: "dynamic-keys",       // basename marking a manual key registry
  requestDelay: 300                      // ms between translation requests
};
```

`i18n.config.mjs`, `i18n.config.json`, and an `"i18n"` field in `package.json`
are also supported. All fields are optional.

| Field             | Default                              | Description |
| ----------------- | ------------------------------------ | ----------- |
| `langs`           | `[{ code: "en", source: true }]`     | Languages. Exactly one is the source; the rest are targets. `deepl` / `mymemory` override the per-engine code. |
| `localesDir`      | `"locales"`                          | Directory holding `<code>.json` files. |
| `srcDir`          | `"src"`                              | Directory scanned for keys. |
| `extensions`      | `[".tsx",".ts",".jsx",".js"]`        | Extensions to scan. |
| `markers`         | `["t","k"]`                          | Key-bearing functions. The **first** is the runtime translate fn used for dynamic-key detection. |
| `registryPattern` | `"dynamic-keys"`                     | Files whose basename contains this string have **all** their string literals collected. |
| `requestDelay`    | `300`                                | Delay (ms) between translation requests. |

---

## Usage

```bash
i18n-scankit scan          # extract keys → sync locales → report dynamic keys
i18n-scankit translate     # fill empty values (all target languages)
i18n-scankit translate fr  # only French
i18n-scankit check         # coverage report (exit 1 if incomplete)
i18n-scankit prune         # remove keys no longer in the source
```

A typical loop after adding new UI text:

```bash
yarn i18n:scan        # pick up new t("...") keys
yarn i18n:translate   # machine-translate the blanks
yarn i18n:check       # confirm nothing is missing
```

### DeepL (recommended)

The free MyMemory engine is the default and needs no key, but it's rate-limited
and lower quality. Set `DEEPL_KEY` to use DeepL instead:

```bash
DEEPL_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx yarn i18n:translate
```

---

## Handling dynamic keys

When `scan` reports dynamic keys, you have two ways to make them translatable.

### Option A — `k()` marker (recommended)

Import the no-op marker and wrap the literal **where it's declared**. Rendering
stays exactly the same.

```tsx
import { k } from "i18n-scankit";

const TABS = [
  { id: "open", label: k("Open orders") },   // ← now the scanner sees it
  { id: "history", label: k("Order history") }
];

// render site unchanged:
<span>{t(tab.label)}</span>
```

`k()` returns its argument unchanged at runtime and ships with TypeScript types.

### Option B — manual registry

For keys you can't wrap at the declaration (e.g. they come from an API), list
them as plain strings in a file whose name matches `registryPattern`
(default `dynamic-keys`):

```ts
// src/i18n/dynamic-keys.ts — scanned, never imported at runtime
export const DYNAMIC_KEYS = ["Pending", "Filled", "Cancelled"];
```

> ⚠️ Don't put quoted text inside comments in `markers`/registry files — quoted
> strings are collected literally, even from comments.

### Expand the report

```bash
I18N_DYNAMIC=full i18n-scankit scan   # one clickable line per occurrence
```

---

## CI gate

`check` exits with code `1` when any target key is empty:

```yaml
# .github/workflows/i18n.yml
- run: npx i18n-scankit check
```

---

## Terminal output

- **Color** is enabled only on a TTY and disabled by `NO_COLOR=1` — pipes and CI
  logs stay clean.
- **Clickable references**: inside the **VS Code** integrated terminal, dynamic
  keys render as short `filename:line` OSC 8 links that jump to the exact line.
  Other terminals show the full `path:line`, which they linkify natively.

---

## Notes & limitations

- The scanner matches text with regular expressions; it does **not** execute or
  type-check your code, so scanning `.ts`/`.tsx` is safe and fast.
- It cannot resolve a runtime value — that's exactly why dynamic-key detection
  and the `k()` / registry escape hatches exist.
- Machine translation is a starting point, not a substitute for human review,
  especially for short UI/domain terms.

---

## Contributing

Issues and PRs welcome. Run the test suite with:

```bash
node --test
```

## License

[MIT](./LICENSE)
