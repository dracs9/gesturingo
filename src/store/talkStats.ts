import type { ReaderUpdate } from "../recognition/open/openReader";

// Latest talk-mode reading, for the `?debug=1` panel (top-3 with distances, margin).
let last: ReaderUpdate | null = null;

export function setTalkStats(update: ReaderUpdate): void {
  last = update;
}

export function clearTalkStats(): void {
  last = null;
}

export function getTalkStats(): ReaderUpdate | null {
  return last;
}
