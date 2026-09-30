import type { ZoneUpdate } from "../recognition/control/commandZones";

/** Per-frame update without React: highlight the zone the wrist is in and fill its ring. */
export function paintZones(container: HTMLElement | null, update: ZoneUpdate | null): void {
  if (!container) return;
  for (const el of container.querySelectorAll<HTMLElement>("[data-zone]")) {
    const active = update?.active === el.dataset.zone;
    el.toggleAttribute("data-active", active);
    const ring = el.firstElementChild as HTMLElement | null;
    ring?.style.setProperty("--progress", active ? (update?.progress ?? 0).toFixed(3) : "0");
  }
}
