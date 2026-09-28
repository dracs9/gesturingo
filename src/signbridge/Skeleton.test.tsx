// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';
import { makeDemoFrame } from './model';
afterEach(cleanup);
it('projects a mirrored widescreen hand into the contained video and supports a second hand', () => {
  const frame = makeDemoFrame('hello', 'recognized');
  frame.source = 'camera';
  frame.secondaryLandmarks = frame.landmarks.map((point) => ({ x: point.x / 2, y: point.y }));
  render(<Skeleton frame={frame} aspect={16 / 9} mirror />);
  const svg = screen.getByRole('img');
  const circles = svg.querySelectorAll('circle');
  expect(circles.length).toBe(42);
  expect(Number(circles[0].getAttribute('cx'))).toBeCloseTo(490);
  expect(Number(circles[0].getAttribute('cy'))).toBeCloseTo(532.5);
  expect(svg.getAttribute('aria-label')).toBe('Скелет кисти: жест принят');
});
