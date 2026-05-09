/**
 * CapitalPathChart — animated solvency-ratio line chart for ORSA scene.
 *
 * Solid line for base, coloured line for stress; left-to-right reveal animation
 * gives the audience the "results landing" moment. Lowest-point annotation
 * marks where the stress bites.
 */
import { useEffect, useRef, useState } from 'react';

export interface PathPoint {
  yearOffset: number;
  projectionYear: number;
  baseRatio: number;
  scenarioRatio: number;
}

export default function CapitalPathChart({ points, scenarioLabel }: { points: PathPoint[]; scenarioLabel: string }) {
  const [progress, setProgress] = useState(0);     // 0..1
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    setProgress(0);
    startRef.current = null;
    const ANIM_MS = 1200;
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / ANIM_MS);
      setProgress(p);
      if (p < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [points]);

  if (points.length === 0) return null;

  const W = 720, H = 280;
  const PAD_L = 56, PAD_R = 24, PAD_T = 24, PAD_B = 38;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const allRatios = points.flatMap((p) => [p.baseRatio, p.scenarioRatio]);
  const yMin = Math.max(0, Math.min(...allRatios) - 30);
  const yMax = Math.max(...allRatios) + 20;

  const xFor = (i: number) => PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yFor = (v: number) => PAD_T + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  // Build SVG path strings
  const buildPath = (key: 'baseRatio' | 'scenarioRatio') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p[key]).toFixed(1)}`).join(' ');

  const basePath = buildPath('baseRatio');
  const scenarioPath = buildPath('scenarioRatio');

  // gridlines: 4 horizontal
  const gridY = [0, 1, 2, 3, 4].map((i) => yMin + (yMax - yMin) * (i / 4));

  // Lowest stress point + annotation
  const lowestIdx = points.reduce((min, p, i) => p.scenarioRatio < points[min].scenarioRatio ? i : min, 0);
  const lowest = points[lowestIdx];
  const lowestX = xFor(lowestIdx);
  const lowestY = yFor(lowest.scenarioRatio);

  // Stress colour by lowest ratio
  const stressColour = lowest.scenarioRatio < 100 ? '#dc2626' : lowest.scenarioRatio < 130 ? '#d97706' : '#15803d';

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <clipPath id="chartReveal">
            <rect x={PAD_L} y={0} width={innerW * progress} height={H} />
          </clipPath>
        </defs>

        {/* Gridlines */}
        {gridY.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={yFor(g)} x2={W - PAD_R} y2={yFor(g)} stroke="#e5e7eb" strokeWidth={1} strokeDasharray={i === 0 ? '0' : '4 4'} />
            <text x={PAD_L - 6} y={yFor(g) + 4} fontSize={10} fill="#94a3b8" textAnchor="end" fontFamily="ui-monospace, monospace">
              {g.toFixed(0)}%
            </text>
          </g>
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={i} x={xFor(i)} y={H - PAD_B + 18} fontSize={11} fill="#475569" textAnchor="middle" fontFamily="ui-monospace, monospace">
            {p.yearOffset === 0 ? 'now' : `+${p.yearOffset}y`}
          </text>
        ))}
        {points.map((p, i) => p.yearOffset > 0 && (
          <text key={`pyear-${i}`} x={xFor(i)} y={H - PAD_B + 32} fontSize={9} fill="#94a3b8" textAnchor="middle" fontFamily="ui-monospace, monospace">
            ({p.projectionYear})
          </text>
        ))}

        {/* Base line */}
        <path d={basePath} fill="none" stroke="#1e40af" strokeWidth={2} clipPath="url(#chartReveal)" />
        {points.map((p, i) => (
          <circle key={`b-${i}`} cx={xFor(i)} cy={yFor(p.baseRatio)} r={3} fill="#1e40af" opacity={progress > i / Math.max(points.length - 1, 1) ? 1 : 0} />
        ))}

        {/* Stress line */}
        <path d={scenarioPath} fill="none" stroke={stressColour} strokeWidth={2.5} clipPath="url(#chartReveal)" />
        {points.map((p, i) => (
          <circle key={`s-${i}`} cx={xFor(i)} cy={yFor(p.scenarioRatio)} r={3.5} fill={stressColour}
            opacity={progress > i / Math.max(points.length - 1, 1) ? 1 : 0} />
        ))}

        {/* Lowest point annotation — appears after animation finishes */}
        {progress >= 0.95 && (
          <g opacity={progress >= 0.95 ? (progress - 0.95) / 0.05 : 0}>
            <line x1={lowestX} y1={lowestY} x2={lowestX} y2={lowestY - 32} stroke={stressColour} strokeWidth={1} strokeDasharray="2 2" />
            <rect x={lowestX - 110} y={lowestY - 60} width={220} height={28} rx={4} fill="white" stroke={stressColour} strokeWidth={1.25} />
            <text x={lowestX} y={lowestY - 42} fontSize={11} fill={stressColour} textAnchor="middle" fontWeight={600}>
              {scenarioLabel}: dips to {lowest.scenarioRatio}% in {lowest.projectionYear}
            </text>
          </g>
        )}

        {/* Legend */}
        <g transform={`translate(${PAD_L + 8}, ${PAD_T + 8})`}>
          <line x1={0} y1={0} x2={18} y2={0} stroke="#1e40af" strokeWidth={2} />
          <text x={24} y={3} fontSize={11} fill="#1e293b">base</text>
          <line x1={70} y1={0} x2={88} y2={0} stroke={stressColour} strokeWidth={2.5} />
          <text x={94} y={3} fontSize={11} fill="#1e293b">stress · {scenarioLabel}</text>
        </g>
      </svg>
    </div>
  );
}
