import { useMemo } from 'react';
import { encode } from 'uqr';

/**
 * Crisp SVG QR (never 3D: it must stay scannable). Static — one path for all dark modules;
 * `draw` (INV-13) — modules "print" diagonally, one rect each with a CSS delay (x + y) × 8 ms.
 */
export function Qr({ value, label, size = 88, draw = false, delay = 0 }: { value: string; label: string; size?: number; draw?: boolean; delay?: number }) {
  const { d, n, cells } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 1 });
    let path = '';
    const list: [number, number][] = [];
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (!on) return;
        path += `M${x} ${y}h1v1h-1z`;
        list.push([x, y]);
      }),
    );
    return { d: path, n: qr.size, cells: list };
  }, [value]);
  return (
    <svg className={draw ? 'qr qr--draw' : 'qr'} viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      {draw ? (
        <g fill="#07061a" style={{ ['--qr-delay' as string]: `${delay}ms` }}>
          {cells.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} style={{ ['--d' as string]: `${(x + y) * 8}ms` }} />
          ))}
        </g>
      ) : (
        <path d={d} fill="#07061a" />
      )}
    </svg>
  );
}
