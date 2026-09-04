/**
 * connections.ts — topología de landmarks de MediaPipe, compartida por
 * el overlay 2D del video y el esqueleto 3D, para que el 3D sea la
 * réplica exacta de lo que se ve sobre el video.
 */

/** Pose (33 puntos): torso, brazos, piernas y cara mínima */
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [9, 10],
  [2, 5],
];

/** Mano (21 puntos): palma + 5 dedos */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

/** Índices de muñeca en la pose (MediaPipe) */
export const POSE_WRIST = { left: 15, right: 16 } as const;
