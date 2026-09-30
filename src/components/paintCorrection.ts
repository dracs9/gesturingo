import type { Visual } from "../recognition/errors/translatorHints";

type Point = { x: number; y: number };

/**
 * Per-frame update of `CorrectionArrow`. Points are in display percent of the video (already mirrored):
 * `hand` = where the palm is, `target` = the calibrated place.
 */
export function paintCorrection(
  root: HTMLElement | null,
  visual: Visual,
  hand: Point | null,
  target: Point | null,
): void {
  if (!root) return;
  const line = root.querySelector<SVGLineElement>("[data-move]");
  const rotate = root.querySelector<SVGSVGElement>("[data-rotate]");
  const move = visual === "move" && hand !== null && target !== null;
  const turn = visual === "rotate" && hand !== null;

  if (line) {
    line.style.display = move ? "" : "none";
    if (move) {
      line.setAttribute("x1", `${hand.x}%`);
      line.setAttribute("y1", `${hand.y}%`);
      line.setAttribute("x2", `${target.x}%`);
      line.setAttribute("y2", `${target.y}%`);
    }
  }
  if (rotate) {
    rotate.style.display = turn ? "" : "none";
    if (turn) {
      rotate.style.left = `${hand.x}%`;
      rotate.style.top = `${hand.y}%`;
    }
  }
}
