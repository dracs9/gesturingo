// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { russianVoice, useVoice } from './speech';

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
      result.current.speak('Здравствуйте', russianVoice);
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
      expect(result.current.speak('Спасибо', russianVoice)).toBe(false);
    });
    expect(result.current.error).toContain('Сообщение остаётся на экране');
  });
});
