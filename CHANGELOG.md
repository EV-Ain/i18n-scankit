# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0]

### Added

- `scan` — extract `t()` / `k()` keys and sync them into every locale file.
- `check` — per-language coverage report with percentages; exits `1` when keys
  are untranslated (CI gate).
- `prune` — remove keys from locale files that no longer exist in the source.
- `translate` — machine-translate empty values via DeepL (when `DEEPL_KEY` is
  set) or the free MyMemory engine, with:
  - incremental saving (progress survives interruptions),
  - `{{variable}}` protection during translation,
  - quota / error detection so warning text is never written as a translation.
- Dynamic-key detection: flags `t(variable)` usages that cannot be translated,
  with a collapsed-by-file view and an `I18N_DYNAMIC=full` expanded view.
- `k()` marker (with TypeScript types) plus a manual registry convention to make
  dynamic keys translatable.
- Color output with automatic downgrade for non-TTY / `NO_COLOR`, and clickable
  `path:line` references (OSC 8 hyperlinks inside the VS Code terminal).
- Configurable via `i18n.config.{js,mjs,json}` or a package.json `"i18n"` field.
