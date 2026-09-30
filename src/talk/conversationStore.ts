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
  /** Hints shown during the conversation (for the summary). */
  hintLog: HintLogEntry[];
  /** Corrections by the signer: cancelled phrases, erased letters / words. */
  cancels: number;
  deletes: number;
  /** The summary already added this conversation to the all-time statistics. */
  recorded: boolean;
  addMessage(message: Omit<Message, "id">): number;
  setSpeech(id: number, speech: MessageSpeech): void;
  logHints(entries: readonly HintLogEntry[]): void;
  countCancel(): void;
  countDelete(): void;
  markRecorded(): void;
  clear(): void;
}

let nextId = 1;

/**
 * The dialogue of the talk screen (docs/TRANSLATOR_SPEC.md §3.2, §8). Not persisted: the conversation
 * itself stays on the device only while the app is open; only aggregates go to localStorage.
 */
export const useConversation = create<ConversationState>()((set) => ({
  messages: [],
  hintLog: [],
  cancels: 0,
  deletes: 0,
  recorded: false,
  addMessage: (message) => {
    const id = nextId++;
    set((s) => ({ messages: [...s.messages, { ...message, id }], recorded: false }));
    return id;
  },
  setSpeech: (id, speech) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, speech } : m)) })),
  logHints: (entries) => set((s) => ({ hintLog: [...s.hintLog, ...entries] })),
  countCancel: () => set((s) => ({ cancels: s.cancels + 1 })),
  countDelete: () => set((s) => ({ deletes: s.deletes + 1 })),
  markRecorded: () => set({ recorded: true }),
  clear: () => set({ messages: [], hintLog: [], cancels: 0, deletes: 0, recorded: false }),
}));
