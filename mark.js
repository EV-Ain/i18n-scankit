/**
 * Dynamic-key marker.
 *
 * A no-op at runtime — it returns its argument unchanged. Its only purpose is
 * to give the scanner a static anchor so it can collect a literal source string
 * that is later consumed dynamically via `t(variable)`.
 *
 * Wrap the literal where it is DECLARED; keep using `t()` where it is rendered:
 *
 *   import { k } from "i18n-scankit";
 *
 *   const TABS = [{ id: "open", label: k("Open orders") }];
 *   // render site is unchanged:
 *   <span>{t(tab.label)}</span>
 */
export const k = s => s;

export default k;
