// Drawings of each letter from the classic fingerspelling chart, cut by scripts/slice-alphabet.py.
// Shown on the letter card: a drawing of a hand explains the shape better than a skeleton of dots.
const files = import.meta.glob<string>("./letterPhotos/*.png", { eager: true, query: "?url", import: "default" });

const byLetter = new Map(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".png".length), url]),
);

export function getLetterPhoto(letter: string): string | undefined {
  return byLetter.get(letter);
}
