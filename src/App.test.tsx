// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { defaults, parseProgress, STORAGE_KEY } from './state';
import { courses, letterById } from './data';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const saved = () => parseProgress(localStorage.getItem(STORAGE_KEY));
const selectPage = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(
    within(screen.getByRole('navigation', { name: 'Основная навигация' })).getByRole('button', {
      name: label,
    }),
  );
};

describe('Frontend user journeys', () => {
  it('lets the user finish all six courses and reach all 26 letters', async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const course of courses) {
      await user.click(screen.getByRole('button', { name: `Начать урок «${course.title}»` }));
      await user.click(screen.getByRole('button', { name: /Начнём/ }));
      for (let index = 0; index < course.letters.length; index++) {
        const letter = course.letters[index];
        expect(
          screen
            .getByRole('img', { name: new RegExp(`Образец буквы ${letter} `) })
            .getAttribute('src'),
        ).toMatch(new RegExp(`/asl/${letter}\\.png$`));
        await user.click(screen.getByRole('button', { name: /Верный жест/ }));
        await user.click(
          screen.getByRole('button', {
            name: index === course.letters.length - 1 ? /^Завершить урок/ : /Следующая буква/,
          }),
        );
      }
      await user.click(screen.getByRole('button', { name: /Вернуться к обучению/ }));
    }
    expect(saved().mastered).toHaveLength(26);
    expect(saved().completedCourses).toHaveLength(6);
    expect(saved().history).toHaveLength(6);
    await selectPage(user, 'Мой прогресс');
    expect(screen.getByText('26/26')).toBeTruthy();
    expect(screen.getByText('Весь алфавит')).toBeTruthy();
  });
  it('completes the corrected lesson, unlocks the next course and restores progress', async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    expect(
      screen
        .getByRole('button', { name: 'Начать урок «Знакомство с азбукой»' })
        .hasAttribute('disabled'),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: /Начать первый урок/ }));
    await user.click(screen.getByRole('button', { name: /Начнём/ }));
    await user.click(screen.getByRole('button', { name: /Показать ошибку/ }));
    expect(screen.getByText(letterById.L.correction)).toBeTruthy();
    for (const letter of ['L', 'V', 'Y']) {
      expect(screen.getByRole('heading', { name: `Покажите букву ${letter}` })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /Верный жест/ }));
      await user.click(
        screen.getByRole('button', {
          name: letter === 'Y' ? /^Завершить урок/ : /Следующая буква/,
        }),
      );
    }
    expect(screen.getByRole('heading', { name: 'Ещё один шаг вперёд!' })).toBeTruthy();
    expect(screen.getByText('+30')).toBeTruthy();
    expect(saved().mastered).toEqual(['L', 'V', 'Y']);
    expect(saved().history[0].assisted).toBe(1);
    expect(saved().history).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /Вернуться к обучению/ }));
    expect(
      screen
        .getByRole('button', { name: 'Начать урок «Знакомство с азбукой»' })
        .hasAttribute('disabled'),
    ).toBe(false);
    app.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Повторить урок «Ваши первые жесты»' })).toBeTruthy();
    expect(saved().history).toHaveLength(1);
  });

  it('filters all 26 letters, opens a detail and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectPage(user, 'Алфавит');
    await user.click(screen.getByRole('link', { name: 'К содержимому' }));
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(window.location.hash).toBe('#alphabet');
    expect(screen.getAllByRole('button', { name: /^Буква [A-Z]:/ })).toHaveLength(26);
    await user.click(screen.getByRole('button', { name: 'В движении' }));
    expect(screen.getAllByRole('button', { name: /^Буква [A-Z]:/ })).toHaveLength(2);
    await user.type(screen.getByRole('searchbox', { name: 'Найти букву' }), 'Z');
    const tile = screen.getByRole('button', { name: /^Буква Z:/ });
    await user.click(tile);
    expect(screen.getByRole('dialog', { name: 'Буква Z' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(tile);
    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('button', { name: 'Пройденные' }));
    expect(screen.getByText('Первые буквы ещё впереди')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Показать все буквы' }));
    expect(screen.getAllByRole('button', { name: /^Буква [A-Z]:/ })).toHaveLength(26);
  });

  it('persists preferences and only resets them after confirmation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectPage(user, 'Настройки');
    await user.type(screen.getByRole('textbox', { name: 'Как вас называть?' }), '  Саша  ');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await user.click(screen.getByRole('button', { name: /Регулярно/ }));
    await user.click(screen.getByRole('button', { name: 'Левая' }));
    await user.click(screen.getByRole('switch', { name: 'Меньше анимации' }));
    expect(saved().preferences).toMatchObject({
      name: 'Саша',
      goal: 5,
      hand: 'left',
      reducedMotion: true,
    });
    expect(document.documentElement.dataset.motion).toBe('reduced');
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    await user.click(screen.getByRole('button', { name: 'Оставить прогресс' }));
    expect(saved().preferences.name).toBe('Саша');
    await user.click(screen.getByRole('button', { name: 'Сбросить' }));
    await user.click(screen.getByRole('button', { name: 'Сбросить всё' }));
    expect(saved()).toEqual(defaults);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('handles a camera refusal and lets the user leave an unfinished lesson without saving it', async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      get: () => ({ getUserMedia }),
    });
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Начать первый урок/ }));
    await user.click(screen.getByRole('button', { name: /Начнём/ }));
    await user.click(screen.getByRole('button', { name: /Включить камеру/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Доступ к камере закрыт');
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    await user.click(screen.getByRole('button', { name: /Верный жест/ }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Сделаем паузу?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Завершить урок/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saved().history).toHaveLength(0);
    expect(saved().mastered).toHaveLength(0);
  });
});
