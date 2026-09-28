// @vitest-environment jsdom
import { act, cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignBridgeApp } from './SignBridgeApp';
import { demoDictionary, makeDemoFrame, STORAGE_KEY, type RecognitionFrame } from './model';
import type { RecognitionAdapter } from './adapter';

beforeEach(() => {
  localStorage.clear();
  location.hash = '';
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const openPage = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getAllByRole('button', { name })[0]);

describe('SignBridge conversation', () => {
  it('completes error → arrow → accepted phrase → conversation → session results', async () => {
    const user = userEvent.setup();
    render(<SignBridgeApp />);
    await user.click(screen.getByRole('button', { name: /Попробовать демо/ }));
    await user.click(screen.getByRole('button', { name: 'Показать ошибку' }));
    expect(screen.getByRole('img', { name: /Демо-скелет кисти: нужна коррекция/ })).toBeTruthy();
    expect(screen.getByText(/Подними ладонь к отметке/)).toBeTruthy();
    expect(document.querySelector('.sb-correction-arrow')).toBeTruthy();
    expect(within(screen.getByRole('log')).queryByText('Здравствуйте')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Исправить жест' }));
    expect(screen.getByRole('img', { name: /жест принят/ })).toBeTruthy();
    expect(within(screen.getByRole('log')).getByText('Здравствуйте')).toBeTruthy();
    expect(document.querySelector('.sb-correction-arrow')).toBeNull();
    await user.type(screen.getByLabelText('Ответ собеседника'), 'Я вас понимаю');
    await user.click(screen.getByRole('button', { name: 'Отправить ответ собеседника' }));
    expect(within(screen.getByRole('log')).getByText('Я вас понимаю')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Завершить' }));
    const result = screen.getByRole('dialog', { name: 'Итоги сессии' });
    expect(within(result).getByText(/Из них 1 сообщений/)).toBeTruthy();
    expect(within(result).getAllByText('1')).toHaveLength(2);
    expect(localStorage.getItem('signbridge.dialog.v1')).toBeNull();
  });
  it('removes the arrow when the closest gesture is ambiguous', async () => {
    const user = userEvent.setup();
    render(<SignBridgeApp />);
    await user.click(screen.getByRole('button', { name: /Попробовать демо/ }));
    await user.click(screen.getByRole('button', { name: 'Показать ошибку' }));
    await user.click(screen.getByRole('button', { name: 'Показать неоднозначный жест' }));
    expect(document.querySelector('.sb-correction-arrow')).toBeNull();
    expect(screen.getByText(/Уверенного ближайшего образца нет/)).toBeTruthy();
    expect(within(screen.getByRole('log')).queryByText('Здравствуйте')).toBeNull();
  });
  it('shows a useful camera denial and still permits text conversation', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    });
    render(<SignBridgeApp />);
    await user.click(screen.getByRole('button', { name: 'Включить камеру' }));
    expect(await screen.findByText(/Доступ к камере закрыт/)).toBeTruthy();
    expect(document.querySelector('.sb-skeleton')).toBeNull();
    await user.type(screen.getByLabelText('Ваше сообщение'), 'Помогите, пожалуйста');
    await user.click(screen.getByRole('button', { name: 'Отправить ваше сообщение' }));
    expect(within(screen.getByRole('log')).getByText('Помогите, пожалуйста')).toBeTruthy();
  });
  it('persists messages only after opting in, and requires confirmation to clear them', async () => {
    const user = userEvent.setup();
    const app = render(<SignBridgeApp />);
    await user.type(screen.getByLabelText('Ваше сообщение'), 'Моё сообщение');
    await user.click(screen.getByRole('button', { name: 'Отправить ваше сообщение' }));
    expect(localStorage.getItem('signbridge.dialog.v1')).toBeNull();
    await openPage(user, 'Настройки');
    await user.click(screen.getByRole('switch', { name: /Сохранять диалог на устройстве/ }));
    expect(JSON.parse(localStorage.getItem('signbridge.dialog.v1') || '[]')[0].text).toBe(
      'Моё сообщение',
    );
    app.unmount();
    location.hash = '';
    render(<SignBridgeApp />);
    expect(within(screen.getByRole('log')).getByText('Моё сообщение')).toBeTruthy();
    await openPage(user, 'Моя сессия');
    expect(screen.getByText('ваших сообщений').previousElementSibling?.textContent).toBe('0');
    await openPage(user, 'Общение');
    await user.click(screen.getByRole('button', { name: 'Очистить диалог' }));
    await user.click(screen.getByRole('button', { name: 'Оставить диалог' }));
    expect(within(screen.getByRole('log')).getByText('Моё сообщение')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Очистить диалог' }));
    await user.click(screen.getByRole('button', { name: 'Удалить сообщения' }));
    expect(JSON.parse(localStorage.getItem('signbridge.dialog.v1') || '[]')).toEqual([]);
  });
  it('consumes one camera event once and releases inference when navigating away', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    const dispose = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    let deliver!: (frame: RecognitionFrame) => void;
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
    await user.click(screen.getByRole('button', { name: 'Включить камеру' }));
    await waitFor(() => expect(adapter.start).toHaveBeenCalledTimes(1));
    const frame = makeDemoFrame('hello', 'recognized');
    act(() => {
      deliver(frame);
      deliver(frame);
    });
    expect(within(screen.getByRole('log')).getAllByText('Здравствуйте')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Скелет кисти: жест принят' })).toBeTruthy();
    expect(document.querySelector('.sb-demo-watermark')).toBeNull();
    await openPage(user, 'Настройки');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    act(() => deliver(makeDemoFrame('thanks', 'recognized')));
    await openPage(user, 'Общение');
    expect(within(screen.getByRole('log')).queryByText('Спасибо')).toBeNull();
  });
  it('keeps microphone features disabled when the browser does not support captions', () => {
    render(<SignBridgeApp />);
    expect(
      (screen.getByRole('button', { name: /Субтитры речи собеседника/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').captionsConsent).toBe(false);
  });
  it('labels the dictionary as a prototype and restores focus after closing a card', async () => {
    const user = userEvent.setup();
    render(<SignBridgeApp />);
    await openPage(user, 'Словарь жестов');
    await user.type(screen.getByPlaceholderText(/Найти фразу/), 'помощь');
    const button = screen.getByRole('button', { name: /Подробнее: Мне нужна помощь/ });
    await user.click(button);
    expect(screen.getByText(/Форма жеста и соответствие классу пока не/)).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
  it('requests captions only after explicit consent and stops them before TTS', async () => {
    let instance: Recognizer | undefined;
    class Recognizer {
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror = null;
      onresult = null;
      start = vi.fn();
      abort = vi.fn();
      constructor() {
        instance = this;
      }
    }
    class Utterance {
      constructor(public text: string) {}
    }
    const speak = vi.fn();
    vi.stubGlobal('SpeechRecognition', Recognizer);
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      speak,
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const user = userEvent.setup();
    render(<SignBridgeApp />);
    await user.click(screen.getByRole('button', { name: /Субтитры речи собеседника/ }));
    expect(instance).toBeUndefined();
    const permission = screen.getByRole('dialog', { name: 'Разрешение на субтитры' });
    expect(within(permission).getByText(/звук отправляется внешнему сервису/)).toBeTruthy();
    await user.click(within(permission).getByRole('button', { name: 'Включить субтитры' }));
    expect(instance?.start).toHaveBeenCalledTimes(1);
    act(() => instance?.onstart?.());
    await user.type(screen.getByLabelText('Ваше сообщение'), 'Спасибо');
    await user.click(screen.getByRole('button', { name: 'Отправить ваше сообщение' }));
    await user.click(screen.getByRole('button', { name: 'Озвучить: Спасибо' }));
    expect(instance?.abort).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Субтитры приостановлены на время озвучивания/)).toBeTruthy();
  });
});
