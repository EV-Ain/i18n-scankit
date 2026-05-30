/**
 * Dynamic-key marker. Returns its argument unchanged at runtime; exists only so
 * the scanner can statically collect a string that is consumed via `t(variable)`.
 */
export declare const k: (s: string) => string;

export default k;
