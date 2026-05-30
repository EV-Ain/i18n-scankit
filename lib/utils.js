import fs from "fs";
import path from "path";

// ── Color ────────────────────────────────────────────────────────────────────
// Disabled automatically when stdout is not a TTY (pipes / CI / file redirect)
// or when NO_COLOR is set (https://no-color.org).
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = code => s => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  dim: paint("90"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  cyan: paint("36"),
  bold: paint("1")
};

// ── Clickable file references ─────────────────────────────────────────────────
// OSC 8 hyperlinks let us show short text (filename:line) while linking to the
// absolute path + line. Only enabled inside the VS Code integrated terminal,
// where `vscode://file/...:line` jumps to the exact line. Elsewhere we fall back
// to a full `relativePath:line`, which most terminals/editors linkify natively.
const osc8 = useColor && process.env.TERM_PROGRAM === "vscode";

/**
 * Build a "location cell".
 * @returns {{ visible: string, render: (text: string) => string }}
 *   `visible` is the on-screen text (used for column alignment);
 *   `render` wraps the *unpadded* text in a hyperlink when supported.
 */
export function fileCell(rootDir, relPath, line) {
  const visible = osc8 ? `${path.basename(relPath)}:${line}` : `${relPath}:${line}`;
  const render = text => {
    if (!osc8) return text;
    const abs = path.resolve(rootDir, relPath);
    // Keep padding OUTSIDE this call so the underline doesn't trail across spaces.
    return `\x1b]8;;vscode://file/${abs}:${line}\x1b\\${text}\x1b]8;;\x1b\\`;
  };
  return { visible, render };
}

// ── Filesystem helpers ────────────────────────────────────────────────────────
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "out",
  "coverage"
]);

/** Recursively collect files under `dir` whose extension is in `exts`. */
export function getAllFiles(dir, exts, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) getAllFiles(full, exts, result);
    } else if (exts.includes(path.extname(entry.name))) {
      result.push(full);
    }
  }
  return result;
}

/** Read a JSON file; exit with a readable error on malformed JSON. */
export function readJson(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error(c.red(`✗ Failed to parse ${path.basename(file)} (invalid JSON): ${err.message}`));
    process.exit(1);
  }
}

/** Return a new object with keys sorted alphabetically (stable diffs). */
export function sortByKey(data) {
  return Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
}

/** Write `data` as sorted, 2-space JSON with a trailing newline. */
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(sortByKey(data), null, 2) + "\n");
}

/** Escape a string for safe use inside a RegExp. */
export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
