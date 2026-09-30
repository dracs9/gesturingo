import type { PhraseSpec } from "../recognition/phrases/spec";

/**
 * The team's decisions on generated phrases (they survive `npm run build:phrases`): mark a phrase
 * verified after checking it against an RSL dictionary, fix its text, or leave it out.
 */
export type PhraseOverride = Partial<Pick<PhraseSpec, "text" | "verified">> & { excluded?: boolean };

export const PHRASE_OVERRIDES: Readonly<Record<string, PhraseOverride>> = {};
