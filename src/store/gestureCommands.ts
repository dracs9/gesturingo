import { useEffect, useRef } from "react";
import type { Command } from "../recognition/control/controller";

type Handlers = Partial<Record<Command, () => void>>;

// Stack of handler refs: the most recently mounted screen wins.
const stack: Array<{ current: Handlers }> = [];

/** Runs the pose command for the active screen. Returns false if nobody handles it. */
export function runCommand(command: Command): boolean {
  const handler = stack.at(-1)?.current[command];
  if (!handler) return false;
  handler();
  return true;
}

/** Registers what «ОК» (thumbs up) and «Назад» (open palm) do on the current screen. */
export function useGestureCommands(handlers: Handlers): void {
  const ref = useRef<Handlers>(handlers);

  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const entry = ref;
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
}
