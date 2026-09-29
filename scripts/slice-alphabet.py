"""Cuts the fingerspelling chart (scripts/assets/dactyl-table.png) into one drawing per letter.

Grid lines are found as pixel rows/columns that are almost entirely dark; each cell is cropped
a few pixels inside its border and saved as src/data/letterPhotos/<letter>.png (grayscale).

    python scripts/slice-alphabet.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts" / "assets" / "dactyl-table.png"
OUT = ROOT / "src" / "data" / "letterPhotos"

# Cells in the chart's own order, row by row — not the alphabet: Ь comes before Ы and Ъ, no Ё.
ORDER = ["АБВГДЕ", "ЖЗИЙКЛ", "МНОПРС", "ТУФХЦЧ", "ШЩЬЫЪЭ", "ЮЯ"]

DARK = 110  # gray level below which a pixel counts as ink
LINE_SHARE = 0.6  # a grid line is dark along at least this share of its length
INSET = 4  # px cut inside each cell border


def line_positions(size: int, is_line) -> list[int]:
    """Start positions of grid lines (consecutive dark lines merged into one)."""
    lines: list[int] = []
    for i in range(size):
        if is_line(i) and (not lines or i - lines[-1] > 2):
            lines.append(i)
        elif is_line(i):
            lines[-1] = i  # keep the last pixel of a thick line so the cell starts after it
    return lines


def main() -> None:
    image = Image.open(SOURCE).convert("L")
    width, height = image.size
    px = image.load()

    # Columns are measured over the full rows only (the last row has two cells).
    full_rows_bottom = int(height * 0.83)

    def dark_share_col(x: int) -> float:
        return sum(px[x, y] < DARK for y in range(full_rows_bottom)) / full_rows_bottom

    def dark_share_row(y: int) -> float:
        return sum(px[x, y] < DARK for x in range(width)) / width

    cols = line_positions(width, lambda x: dark_share_col(x) > LINE_SHARE)
    rows = line_positions(height, lambda y: dark_share_row(y) > LINE_SHARE)
    assert len(cols) == 7 and len(rows) == 7, f"unexpected grid: cols={cols} rows={rows}"

    OUT.mkdir(parents=True, exist_ok=True)
    for r, letters in enumerate(ORDER):
        for c, letter in enumerate(letters):
            box = (cols[c] + INSET, rows[r] + INSET, cols[c + 1] - INSET + 1, rows[r + 1] - INSET + 1)
            image.crop(box).save(OUT / f"{letter}.png", optimize=True)
            print(letter, box)


if __name__ == "__main__":
    main()
