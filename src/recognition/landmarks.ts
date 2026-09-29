export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export type Handedness = "Left" | "Right";

/** One detected hand in one video frame. Landmarks are image-normalized (0..1), not mirrored. */
export interface HandFrame {
  landmarks: Point3[];
  /** Raw MediaPipe label (MediaPipe assumes a mirrored image; verify before relying on it). */
  handedness: Handedness;
  score: number;
  timestamp: number;
  videoWidth: number;
  videoHeight: number;
}

export const LANDMARK_COUNT = 21;

export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // index
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // middle
  [9, 10],
  [10, 11],
  [11, 12],
  // ring
  [13, 14],
  [14, 15],
  [15, 16],
  // pinky
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // palm
  [5, 9],
  [9, 13],
  [13, 17],
];
