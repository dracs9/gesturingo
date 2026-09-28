import { useId } from 'react';
import { connections, type RecognitionFrame } from './model';

export function Skeleton({
  frame,
  aspect = 4 / 3,
  mirror = false,
}: {
  frame: RecognitionFrame;
  aspect?: number;
  mirror?: boolean;
}) {
  const markerId = useId().replace(/:/g, '');
  if (!frame.landmarks.length) return null;
  const status = frame.status;
  const color = status === 'recognized' ? '#42dfa0' : status === 'almost' ? '#ff747d' : '#b8c4df';
  const correction = frame.corrections[0];
  const hands = [frame.landmarks, frame.secondaryLandmarks || []];
  const videoAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3;
  const width = videoAspect > 4 / 3 ? 1000 : 750 * videoAspect;
  const height = videoAspect > 4 / 3 ? 1000 / videoAspect : 750;
  const project = (point: { x: number; y: number }) => ({
    x: (1000 - width) / 2 + (mirror ? 1 - point.x : point.x) * width,
    y: (750 - height) / 2 + point.y * height,
  });
  const arrow = correction?.arrow;
  return (
    <svg
      className="sb-skeleton"
      viewBox="0 0 1000 750"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${frame.source === 'demo' ? 'Демо-скелет' : 'Скелет'} кисти: ${status === 'recognized' ? 'жест принят' : status === 'almost' ? 'нужна коррекция' : 'жест не определён'}`}
    >
      <defs>
        <marker id={markerId} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0 0L9 4.5L0 9" fill="none" stroke="#ffda93" strokeWidth="1.8" />
        </marker>
      </defs>
      {hands.map((hand, handIndex) => {
        const positions = hand.map(project);
        const highlighted =
          (correction?.hand === 'secondary' ? 1 : 0) === handIndex
            ? correction?.jointIds || []
            : [];
        return (
          <g key={handIndex}>
            <g
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {connections.map(([a, b]) =>
                positions[a] && positions[b] ? (
                  <line
                    key={`${a}-${b}`}
                    x1={positions[a].x}
                    y1={positions[a].y}
                    x2={positions[b].x}
                    y2={positions[b].y}
                    className={highlighted.includes(b) ? 'joint-error' : ''}
                  />
                ) : null,
              )}
            </g>
            {positions.map((point, index) => (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={highlighted.includes(index) ? 13 : 8}
                  fill={color}
                  stroke="#15263f"
                  strokeWidth="3"
                />
                {highlighted.includes(index) && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="22"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity=".5"
                  />
                )}
              </g>
            ))}
          </g>
        );
      })}
      {arrow && (
        <g className="sb-correction-arrow">
          <path
            d={`M${project(arrow.from).x} ${project(arrow.from).y} L${project(arrow.to).x} ${project(arrow.to).y}`}
            stroke="#ffda93"
            strokeWidth="5"
            strokeDasharray="9 8"
            markerEnd={`url(#${markerId})`}
            fill="none"
          />
          <circle
            cx={project(arrow.to).x}
            cy={project(arrow.to).y}
            r="24"
            stroke="#ffda93"
            fill="none"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
        </g>
      )}
    </svg>
  );
}
