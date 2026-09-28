// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCamera } from './hooks';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mediaMock(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    get: () => ({ getUserMedia }),
  });
}
const fakeStream = () => {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
};

describe('Camera lifecycle', () => {
  it('releases a stream that arrives after unmounting', async () => {
    const fake = fakeStream();
    let resolve!: (value: MediaStream) => void;
    mediaMock(
      () =>
        new Promise<MediaStream>((done) => {
          resolve = done;
        }),
    );
    const { result, unmount } = renderHook(useCamera);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.start();
    });
    expect(result.current.status).toBe('loading');
    unmount();
    await act(async () => {
      resolve(fake.stream);
      await pending;
    });
    expect(fake.stop).toHaveBeenCalledTimes(1);
  });

  it('stops acquired tracks when playback fails', async () => {
    const fake = fakeStream();
    mediaMock(async () => fake.stream);
    const { result } = renderHook(useCamera);
    const video = document.createElement('video');
    vi.spyOn(video, 'play').mockRejectedValue(new Error('Playback failed'));
    result.current.video.current = video;
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });

  it('keeps the camera off when stopping during a pending playback', async () => {
    const fake = fakeStream();
    mediaMock(async () => fake.stream);
    let played!: () => void;
    const { result } = renderHook(useCamera);
    const video = document.createElement('video');
    vi.spyOn(video, 'play').mockImplementation(
      () =>
        new Promise<void>((done) => {
          played = done;
        }),
    );
    result.current.video.current = video;
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.start();
      await Promise.resolve();
    });
    act(() => result.current.stop());
    await act(async () => {
      played();
      await pending;
    });
    expect(result.current.status).toBe('off');
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });
});
