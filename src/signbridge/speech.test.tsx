// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCaptions, useVoice } from './speech';
import { preferencesDefault } from './model';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
class MockUtterance {
  text: string;
  lang = '';
  rate = 1;
  voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
class MockRecognizer {
  static instances: MockRecognizer[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: { isFinal: boolean; 0: { transcript: string } }[];
      }) => void)
    | null = null;
  start = vi.fn();
  abort = vi.fn();
  constructor() {
    MockRecognizer.instances.push(this);
  }
}

describe('Browser speech lifecycle', () => {
  it('selects a local Russian voice and cancels stale speech callbacks', () => {
    const local = { voiceURI: 'ru-local', lang: 'ru-RU', localService: true };
    const remote = { voiceURI: 'ru-remote', lang: 'ru-RU', localService: false };
    const synthesis = {
      getVoices: () => [remote, local],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    vi.stubGlobal('speechSynthesis', synthesis);
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    const { result, unmount } = renderHook(useVoice);
    act(() => {
      result.current.speak('Здравствуйте', preferencesDefault);
    });
    const utterance = synthesis.speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.voice).toBe(local);
    expect(utterance.lang).toBe('ru-RU');
    act(() => utterance.onstart?.());
    expect(result.current.speaking).toBe(true);
    act(() => result.current.cancel());
    act(() => utterance.onstart?.());
    expect(result.current.speaking).toBe(false);
    unmount();
    expect(synthesis.removeEventListener).toHaveBeenCalled();
  });
  it('offers a text fallback if speech synthesis is unavailable', () => {
    const { result } = renderHook(useVoice);
    act(() => {
      expect(result.current.speak('Спасибо', preferencesDefault)).toBe(false);
    });
    expect(result.current.error).toContain('Сообщение остаётся на экране');
  });
  it('delivers each final caption once and removes microphone callbacks on stop', () => {
    MockRecognizer.instances = [];
    vi.stubGlobal('SpeechRecognition', MockRecognizer);
    const deliver = vi.fn();
    const { result } = renderHook(() => useCaptions(deliver));
    expect(MockRecognizer.instances).toHaveLength(0);
    act(() => result.current.start('ru-RU'));
    const recognizer = MockRecognizer.instances[0];
    expect(recognizer.lang).toBe('ru-RU');
    act(() => recognizer.onstart?.());
    expect(result.current.status).toBe('listening');
    const final = {
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Могу помочь' } }],
    };
    act(() => {
      recognizer.onresult?.(final);
      recognizer.onresult?.(final);
    });
    expect(deliver).toHaveBeenCalledExactlyOnceWith('Могу помочь');
    act(() => result.current.stop());
    expect(recognizer.abort).toHaveBeenCalledTimes(1);
    expect(recognizer.onresult).toBeNull();
    expect(result.current.status).toBe('off');
  });
  it('stops the microphone when permission is denied and permits retry', () => {
    MockRecognizer.instances = [];
    vi.stubGlobal('SpeechRecognition', MockRecognizer);
    const { result, unmount } = renderHook(() => useCaptions(vi.fn()));
    act(() => result.current.start('ru-RU'));
    const recognizer = MockRecognizer.instances[0];
    act(() => recognizer.onerror?.({ error: 'not-allowed' }));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Доступ к микрофону закрыт');
    expect(recognizer.abort).toHaveBeenCalledTimes(1);
    act(() => result.current.start('ru-RU'));
    const retry = MockRecognizer.instances[1];
    unmount();
    expect(retry.abort).toHaveBeenCalledTimes(1);
  });
});
