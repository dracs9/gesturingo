import type { ReferenceFile } from "../recognition/samples";

// Ghost-hand references exported from /record («Сохранить эталон») and dropped into data/references/.
const files = import.meta.glob<ReferenceFile>("./references/*.json", { eager: true, import: "default" });

const byLetter = new Map(Object.values(files).map((f) => [f.letter, f]));

export function getReference(letter: string): ReferenceFile | undefined {
  return byLetter.get(letter);
}
