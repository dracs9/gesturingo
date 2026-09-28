import { describe, expect, it } from 'vitest';
import {
  credibleCandidate,
  demoDictionary,
  guardFrame,
  loadPreferences,
  makeDemoFrame,
} from './model';

describe('Recognition boundary', () => {
  it('rejects low confidence and competing intents', () => {
    expect(credibleCandidate([{ id: 'hello', score: 0.64 }], demoDictionary)).toBeNull();
    expect(
      credibleCandidate(
        [
          { id: 'hello', score: 0.9 },
          { id: 'help', score: 0.81 },
        ],
        demoDictionary,
      ),
    ).toBeNull();
  });
  it('does not promote a known class when an unknown class wins', () => {
    expect(
      credibleCandidate(
        [
          { id: 'outside-dictionary', score: 0.99 },
          { id: 'hello', score: 0.8 },
        ],
        demoDictionary,
      ),
    ).toBeNull();
    expect(
      credibleCandidate(
        [
          { id: 'hello', score: 0.8 },
          { id: 'outside-dictionary', score: 0.75 },
        ],
        demoDictionary,
      ),
    ).toBeNull();
  });
  it('deduplicates labels and ignores invalid scores', () => {
    expect(
      credibleCandidate(
        [
          { id: 'hello', score: 0.9 },
          { id: 'hello', score: 0.89 },
          { id: 'help', score: NaN },
        ],
        demoDictionary,
      )?.id,
    ).toBe('hello');
  });
  it('withholds arrows and messages for ambiguous frames', () => {
    const input = makeDemoFrame('hello', 'almost');
    input.candidates = [
      { id: 'hello', score: 0.85 },
      { id: 'help', score: 0.82 },
    ];
    const output = guardFrame(input, demoDictionary);
    expect(output.status).toBe('uncertain');
    expect(output.corrections).toEqual([]);
    expect(output.eventId).toBeUndefined();
  });
  it('requires verified camera classes, while allowing explicit UI fixtures', () => {
    const input = makeDemoFrame('hello', 'recognized');
    expect(guardFrame(input, demoDictionary).status).toBe('recognized');
    input.source = 'camera';
    expect(guardFrame(input, demoDictionary).status).toBe('uncertain');
    expect(
      guardFrame(
        input,
        demoDictionary.map((item) => ({ ...item, verified: true })),
      ).status,
    ).toBe('recognized');
  });
  it('requires completed confirmation and a stable event identifier', () => {
    const input = makeDemoFrame('hello', 'recognized');
    expect(guardFrame({ ...input, holdProgress: 0.9 }, demoDictionary).status).toBe('tracking');
    expect(guardFrame({ ...input, eventId: '' }, demoDictionary).status).toBe('tracking');
    expect(guardFrame({ ...input, holdProgress: NaN }, demoDictionary).eventId).toBeUndefined();
  });
  it('rejects malformed coordinates rather than drawing a misleading skeleton', () => {
    const input = makeDemoFrame('hello', 'recognized');
    input.landmarks[5] = { x: Infinity, y: 0.5 };
    const output = guardFrame(input, demoDictionary);
    expect(output.status).toBe('uncertain');
    expect(output.landmarks).toEqual([]);
    expect(output.eventId).toBeUndefined();
  });
  it('requires a specific valid correction before showing the red state', () => {
    const input = makeDemoFrame('hello', 'almost');
    input.corrections[0].jointIds = [99];
    expect(guardFrame(input, demoDictionary).status).toBe('uncertain');
    expect(
      guardFrame({ ...makeDemoFrame('hello', 'almost'), corrections: [] }, demoDictionary)
        .corrections,
    ).toEqual([]);
  });
});

describe('Privacy defaults', () => {
  it('restores malformed settings with microphone, TTS and history disabled', () => {
    for (const raw of ['broken', 'null', '[]', '{"captionsConsent":"yes","saveDialog":1}']) {
      const preferences = loadPreferences(raw);
      expect(preferences.captionsConsent).toBe(false);
      expect(preferences.saveDialog).toBe(false);
      expect(preferences.speak).toBe(false);
    }
  });
});
