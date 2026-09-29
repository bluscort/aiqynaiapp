import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '@/theme';

interface Axis {
  label: string;
  value: number;
}

/** XP-per-subject radar. Values are normalised to the strongest subject. */
export function RadarChart({ axes, size = 280 }: { axes: Axis[]; size?: number }) {
  const c = size / 2;
  const r = size / 2 - 34;
  const max = Math.max(1, ...axes.map((a) => a.value));
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, k: number) => [c + Math.cos(angle(i)) * r * k, c + Math.sin(angle(i)) * r * k] as const;
  const ring = (k: number) => axes.map((_, i) => point(i, k).join(',')).join(' ');
  const shape = axes.map((a, i) => point(i, Math.max(0.04, a.value / max)).join(',')).join(' ');

  return (
    <Svg width={size} height={size}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <Polygon key={k} points={ring(k)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <Line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
      })}
      <Polygon points={shape} fill="rgba(34,211,238,0.22)" stroke={colors.cyan} strokeWidth={2} />
      {axes.map((a, i) => {
        const [x, y] = point(i, Math.max(0.04, a.value / max));
        const [lx, ly] = point(i, 1.2);
        return (
          <G key={a.label}>
            <Circle cx={x} cy={y} r={3} fill={colors.cyan} />
            <SvgText x={lx} y={ly + 4} fill={colors.muted} fontSize={11} fontWeight="600" textAnchor="middle">
              {a.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
