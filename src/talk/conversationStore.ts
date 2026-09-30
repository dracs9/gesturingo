import { create } from "zustand";
import type { HintLogEntry } from "../recognition/letters/practice";
import type { SpeakResult } from "../tts/speech";

export type MessageSide = "signer" | "listener";
export type MessageSpeech = SpeakResult | "speaking" | null;

export interface Message {
  id: number;
  side: MessageSide;
  text: string;
  source: "dactyl" | "voice" | "typed";
  timestamp: number;
  /** Speech state of a signer's message (null for the listener's). */
  speech: MessageSpeech;
}

interface ConversationState {
  messages: Message[];
  /** Hints shown during the conversation (for the summary, T7). */
  hintLog: HintLogEntry[];
  addMessage(message: Omit<Message, "id">): number;
  setSpeech(id: number, speech: MessageSpeech): void;
  logHints(entries: readonly HintLogEntry[]): void;
  clear(): void;
}

let nextId = 1;

/** The dialogue feed of the talk screen (docs/TRANSLATOR_SPEC.md §3.2). Not persisted: it stays on the device only while open. */
export const useConversation = create<ConversationState>()((set) => ({
  messages: [],
  hintLog: [],
  addMessage: (message) => {
    const id = nextId++;
    set((s) => ({ messages: [...s.messages, { ...message, id }] }));
    return id;
  },
  setSpeech: (id, speech) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, speech } : m)) })),
  logHints: (entries) => set((s) => ({ hintLog: [...s.hintLog, ...entries] })),
  clear: () => set({ messages: [], hintLog: [] }),
}));
