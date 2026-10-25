/**
 * Static SVG ring — fallback without WebGL and placeholder until the 3D chunk arrives.
 * Matches the first frame of the 3D ring in the hero (position, size, tilt, thickness and the
 * gold → cream → pink → violet light around it), measured from renders at 1440×900 / 800×1000 /
 * 390×844, so the canvas cross-fades over it without a jump. Geometry lives in CSS (landing.css).
 */
export function RingPoster() {
  return (
    <svg className="ring-poster" viewBox="-500 -500 1000 1000" aria-hidden="true">
      <defs>
        <linearGradient id="rp-grad" x1="0" y1="0.25" x2="1" y2="0.85">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.3" stopColor="#fff1d6" />
          <stop offset="0.6" stopColor="#ff9cf2" />
          <stop offset="1" stopColor="#9a5cff" />
        </linearGradient>
        <filter id="rp-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <g className="ring-poster__tilt">
        <ellipse rx="400" ry="196" fill="none" stroke="url(#rp-grad)" strokeWidth="44" opacity="0.5" filter="url(#rp-glow)" />
        <ellipse rx="400" ry="196" fill="none" stroke="url(#rp-grad)" strokeWidth="16" />
      </g>
    </svg>
  );
}
