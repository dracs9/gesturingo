// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignBridgeApp } from './SignBridgeApp';
import { demoDictionary, makeDemoFrame, type RecognitionFrame } from './model';
import type { RecognitionAdapter } from './adapter';

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mockCamera() {
  const stop = vi.fn();
  const getUserMedia = vi.fn(
    async () => ({ getTracks: () => [{ stop }] }) as unknown as MediaStream,
  );
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  return { getUserMedia, stop };
}
function mockVoice() {
  class Utterance {
    constructor(public text: string) {}
  }
  const speak = vi.fn();
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', {
    speak,
    cancel: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return speak;
}

describe('Focused communication flow', () => {
  it('opens with one welcome action and then requests video without audio', async () => {
    const user = userEvent.setup();
    const media = mockCamera();
    render(<SignBridgeApp />);
    expect(screen.getByRole('heading', { name: /Покажите жест/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Камера и подсказки' })).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Начать общение/ }));
    await waitFor(() =>
      expect(media.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      }),
    );
    expect(screen.getByRole('region', { name: 'Камера и подсказки' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(screen.getByText('Распознавание жестов ещё не подключено.')).toBeTruthy();
  });
  it('speaks text fallback and completes a conversation with a short result', async () => {
    const user = userEvent.setup();
    const media = mockCamera();
    const speak = mockVoice();
    render(<SignBridgeApp />);
    await user.click(screen.getByRole('button', { name: /Начать общение/ }));
    await screen.findByText('ВКЛЮЧЕНА');
    await user.type(screen.getByLabelText('Можно написать, если так удобнее'), 'Мне нужна помощь');
    await user.click(screen.getByRole('button', { name: 'Отправить фразу' }));
    expect(screen.getByText('ТЕКСТОВОЕ СООБЩЕНИЕ')).toBeTruthy();
    expect(
      within(screen.getByRole('log', { name: 'История разговора' })).getByText('Мне нужна помощь'),
    ).toBeTruthy();
    expect(speak).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Произнести ещё раз' }));
    expect(speak).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Завершить' }));
    expect(media.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Разговор завершён.' })).toBeTruthy();
    expect(screen.getByText('За этот разговор отправлено 1 сообщение.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Начать новый разговор/ }));
    expect(screen.getByText('ФРАЗА ПОЯВИТСЯ ЗДЕСЬ')).toBeTruthy();
    expect(screen.getByText('Сообщения появятся здесь во время разговора.')).toBeTruthy();
  });
  it('keeps text available when camera access is denied', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    });
    render(<SignBridgeApp />);
    await user.click(screen.getByRole('button', { name: /Начать общение/ }));
    expect(await screen.findByText(/Доступ к камере закрыт/)).toBeTruthy();
    await user.type(screen.getByLabelText('Можно написать, если так удобнее'), 'Здравствуйте');
    await user.click(screen.getByRole('button', { name: 'Отправить фразу' }));
    expect(within(screen.getByRole('log')).getByText('Здравствуйте')).toBeTruthy();
  });
  it('shows a specific correction, then speaks one accepted gesture only once', async () => {
    const user = userEvent.setup();
    const media = mockCamera();
    const speak = mockVoice();
    let deliver!: (frame: RecognitionFrame) => void;
    const dispose = vi.fn();
    const adapter: RecognitionAdapter = {
      start: vi.fn((input) => {
        deliver = input.onFrame;
        return dispose;
      }),
    };
    render(
      <SignBridgeApp
        adapter={adapter}
        dictionary={demoDictionary.map((item) => ({ ...item, verified: true }))}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Начать общение/ }));
    await waitFor(() => expect(adapter.start).toHaveBeenCalledTimes(1));
    act(() => deliver(makeDemoFrame('hello', 'almost', 'height')));
    expect(screen.getByText(/Подними ладонь к отметке/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Скелет кисти: нужна коррекция' })).toBeTruthy();
    expect(document.querySelector('.sb-correction-arrow')).toBeTruthy();
    expect(within(screen.getByRole('log')).queryByText('Здравствуйте')).toBeNull();
    const accepted = makeDemoFrame('hello', 'recognized');
    act(() => {
      deliver(accepted);
      deliver(accepted);
    });
    expect(screen.getByRole('img', { name: 'Скелет кисти: жест принят' })).toBeTruthy();
    expect(within(screen.getByRole('log')).getAllByText('Здравствуйте')).toHaveLength(1);
    expect(speak).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Завершить' }));
    expect(screen.getByText(/из них 1 — жестами/)).toBeTruthy();
    expect(media.stop).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    act(() => deliver(makeDemoFrame('help', 'recognized')));
    expect(screen.queryByText('Мне нужна помощь')).toBeNull();
  });
  it('does not utter or display an ambiguous gesture as a phrase', async () => {
    const user = userEvent.setup();
    mockCamera();
    let deliver!: (frame: RecognitionFrame) => void;
    const adapter: RecognitionAdapter = {
      start: vi.fn((input) => {
        deliver = input.onFrame;
        return () => {};
      }),
    };
    render(
      <SignBridgeApp
        adapter={adapter}
        dictionary={demoDictionary.map((item) => ({ ...item, verified: true }))}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Начать общение/ }));
    await waitFor(() => expect(adapter.start).toHaveBeenCalledTimes(1));
    act(() => deliver(makeDemoFrame('hello', 'uncertain')));
    expect(screen.getByText('Покажите жест ещё раз.')).toBeTruthy();
    expect(document.querySelector('.sb-correction-arrow')).toBeNull();
    expect(within(screen.getByRole('log')).queryByText('Здравствуйте')).toBeNull();
  });
  it('lets the person silence automatic speech while retaining visible text', async () => {
    const user = userEvent.setup();
    mockCamera();
    const speak = mockVoice();
    render(<SignBridgeApp />);
    await user.click(screen.getByRole('button', { name: /Начать общение/ }));
    await user.click(screen.getByRole('button', { name: 'Выключить звук' }));
    await user.type(screen.getByLabelText('Можно написать, если так удобнее'), 'Да');
    await user.click(screen.getByRole('button', { name: 'Отправить фразу' }));
    expect(screen.getAllByText('Да').length).toBeGreaterThan(0);
    expect(speak).not.toHaveBeenCalled();
  });
});
