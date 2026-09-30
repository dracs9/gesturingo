import { useCallback, useEffect, useRef, useState } from "react";
import type { Subtitle } from "../components/SubtitleOverlay";
import { TALK_SUBTITLE_MS } from "../recognition/thresholds";
import {
  createSpeechListener,
  isSpeechRecognitionSupported,
  type SpeechListener,
  type SttErrorKind,
} from "../stt/stt";
import { isSpeaking, onSpeakingChange } from "../tts/speech";
import { useConversation } from "./conversationStore";

export interface ListenerState {
  supported: boolean;
  listening: boolean;
  /** Our TTS is speaking: the microphone waits (no echo). */
  ttsSpeaking: boolean;
  error: SttErrorKind | null;
  subtitle: Subtitle | null;
  toggleMic(): void;
  /** The typed answer (fallback without speech recognition). */
  send(text: string): void;
}

/**
 * The hearing person's channel on the talk screen (docs/TRANSLATOR_SPEC.md §6): push-to-talk speech
 * recognition → subtitles over the video (interim, then final for 5 s) and a message in the feed.
 */
export function useListener(): ListenerState {
  const addMessage = useConversation((st) => st.addMessage);
  const [supported] = useState(isSpeechRecognitionSupported);
  const [listening, setListening] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(isSpeaking);
  const [error, setError] = useState<SttErrorKind | null>(null);
  const [subtitle, setSubtitle] = useState<Subtitle | null>(null);
  const listenerRef = useRef<SpeechListener | null>(null);

  const post = useCallback(
    (text: string, source: "voice" | "typed") => {
      addMessage({ side: "listener", text, source, timestamp: Date.now(), speech: null });
      setSubtitle({ text, final: true });
    },
    [addMessage],
  );

  useEffect(() => onSpeakingChange(setTtsSpeaking), []);

  useEffect(() => {
    const listener = createSpeechListener({
      onText: ({ interim, final }) =>
        setSubtitle({ text: [final, interim].filter(Boolean).join(" "), final: interim === "" }),
      onEnd: (text) => {
        setListening(false);
        if (text) post(text, "voice");
        else setSubtitle((current) => (current?.final ? current : null));
      },
      onError: setError,
    });
    listenerRef.current = listener;
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

  const toggleMic = useCallback(() => {
    const listener = listenerRef.current;
    if (!listener) return;
    if (listener.listening) {
      listener.stop();
      return;
    }
    setError(null);
    if (listener.start()) setListening(true);
  }, []);

  const send = useCallback((text: string) => post(text, "typed"), [post]);

  return { supported, listening, ttsSpeaking, error, subtitle, toggleMic, send };
}
