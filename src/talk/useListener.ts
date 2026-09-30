import { useCallback, useEffect, useRef, useState } from "react";
import type { Subtitle } from "../components/SubtitleOverlay";
import { TALK_SUBTITLE_MS } from "../recognition/thresholds";
import {
  createAutoListener,
  isSpeechRecognitionSupported,
  type AutoListener,
  type ListenStatus,
  type SttErrorKind,
} from "../stt/stt";
import { useConversation } from "./conversationStore";

export interface ListenerState {
  supported: boolean;
  status: ListenStatus;
  error: SttErrorKind | null;
  subtitle: Subtitle | null;
  /** After an error: try the microphone again (a tap — some browsers need one). */
  retry(): void;
  /** The typed answer (fallback without speech recognition). */
  send(text: string): void;
}

/**
 * The hearing person's channel on the talk screen (docs/TRANSLATOR_SPEC.md §6): the microphone listens by
 * itself while the screen is open → subtitles over the video (interim, then final for 5 s) and a message
 * in the feed.
 */
export function useListener(): ListenerState {
  const addMessage = useConversation((st) => st.addMessage);
  const [supported] = useState(isSpeechRecognitionSupported);
  const [status, setStatus] = useState<ListenStatus>("off");
  const [error, setError] = useState<SttErrorKind | null>(null);
  const [subtitle, setSubtitle] = useState<Subtitle | null>(null);
  const listenerRef = useRef<AutoListener | null>(null);

  const post = useCallback(
    (text: string, source: "voice" | "typed") => {
      addMessage({ side: "listener", text, source, timestamp: Date.now(), speech: null });
      setSubtitle({ text, final: true });
    },
    [addMessage],
  );

  useEffect(() => {
    const listener = createAutoListener({
      onInterim: (text) => setSubtitle((current) => (text ? { text, final: false } : current?.final ? current : null)),
      onFinal: (text) => post(text, "voice"),
      onStatus: (next, kind) => {
        setStatus(next);
        setError(kind);
      },
    });
    listenerRef.current = listener;
    listener.start();
    return () => {
      listener.dispose();
      listenerRef.current = null;
    };
  }, [post]);

  // Final words stay on the video for a few seconds.
  useEffect(() => {
    if (!subtitle?.final) return;
    const id = window.setTimeout(() => setSubtitle(null), TALK_SUBTITLE_MS);
    return () => window.clearTimeout(id);
  }, [subtitle]);

  const retry = useCallback(() => {
    setError(null);
    listenerRef.current?.start();
  }, []);

  const send = useCallback((text: string) => post(text, "typed"), [post]);

  return { supported, status, error, subtitle, retry, send };
}
