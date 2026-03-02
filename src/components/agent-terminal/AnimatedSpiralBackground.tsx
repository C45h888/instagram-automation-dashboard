/**
 * AnimatedSpiralBackground.tsx
 *
 * Three asymmetric flaring galaxy arms with differential rotation.
 * Dense central body (not a void) with spiral arm structure visible
 * through brightness modulation. Matches reference: filled center,
 * wide sweeping arms, individual ASCII chars visible at outer edges.
 */

import { useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpiralPoint {
  baseTheta:    number;
  r:            number;
  perpOffset:   number;
  char:         string;
  brightness:   number;
  isEpicenter:  boolean;
}

interface ArmConfig {
  offset:      number;
  widthMult:   number;
  brightMult:  number;
  perpSamples: number;
  pointsMult:  number;
}

interface AnimatedSpiralBackgroundProps {
  intensity?:     number;
  rotationSpeed?: number;
}

// ─── Arm configuration — asymmetric by design ─────────────────────────────────

const ARM_CONFIG: ArmConfig[] = [
  // Dominant arm — massive, brightest
  { offset: 0,               widthMult: 2.85, brightMult: 2.0, perpSamples: 35, pointsMult: 1.00 },
  // Secondary arm — large, clearly visible
  { offset: Math.PI * 0.72,  widthMult: 1.85, brightMult: 1.5, perpSamples: 27, pointsMult: 0.82 },
  // Ghost arm — same size as original dominant
  { offset: Math.PI * 1.44,  widthMult: 1.00, brightMult: 1.25, perpSamples: 25, pointsMult: 0.58 },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const SPIRAL_B       = 0.28;           // tighter coiling → more wraps visible
const THETA_MAX      = Math.PI * 5.0;  // enough sweep for ~2.5 rotations before maxR clip
const INNER_R        = 8;              // arms start close to center — NO void
const EPICENTER_R    = 3;              // tiny true void at absolute center
const SCATTER_RADIUS = 100;            // epicenter scatter extends to 100px → fills center body
const FLARE_RATIO    = 0.28;           // effectiveHalf = r × FLARE_RATIO × widthMult
const SIGMA_RATIO    = 0.11;           // sigma = r × SIGMA_RATIO × widthMult
const BASE_PTS       = 340;            // centerline points per arm (dense)
const MAX_ARM_BRIGHT = 0.22;           // per-char brightness cap — prevents orb from overlap
const DIFFERENTIAL   = 0.28;           // outer 28% faster than inner
const SHIMMER_RATE   = 0.974;          // ~2.6% chars flicker each frame
const CHAR_FONT      = '8px "JetBrains Mono", monospace';
const CHARS          = '0123456789ABCDEFXx=+-:.*';

// Pre-computed perpendicular normalization factor for log spiral
const SPIRAL_PERP_NORM = Math.sqrt(SPIRAL_B * SPIRAL_B + 1);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brightnessToColor(b: number): string {
  const v = Math.round(b * 213 + 42);
  return `rgb(${v},${v},${v})`;
}

function buildSpiralPoints(
  width: number,
  height: number
): { points: SpiralPoint[]; maxR: number } {
  const maxR  = Math.min(width, height) * 0.58;
  const points: SpiralPoint[] = [];

  // ── Epicenter scatter ──────────────────────────────────────────────────────
  // Dense field from EPICENTER_R to SCATTER_RADIUS — fills the central body
  // This is NOT a void — it's the galaxy core, same data texture as the arms
  const SCATTER_COUNT = 300;
  for (let i = 0; i < SCATTER_COUNT; i++) {
    const angle      = Math.random() * Math.PI * 2;
    const r          = EPICENTER_R + Math.random() * (SCATTER_RADIUS - EPICENTER_R);
    const normalized = (r - EPICENTER_R) / (SCATTER_RADIUS - EPICENTER_R);

    // Thinning: denser at center, sparser at scatter edge
    if (Math.random() > (1 - normalized * 0.5)) continue;

    points.push({
      baseTheta:   angle,
      r,
      perpOffset:  0,
      char:        CHARS[Math.floor(Math.random() * CHARS.length)],
      // Brighter at center, fading toward scatter edge
      brightness:  0.10 + 0.16 * (1 - normalized),
      isEpicenter: true,
    });
  }

  // ── Arm points ─────────────────────────────────────────────────────────────
  for (const config of ARM_CONFIG) {
    const armPts   = Math.round(BASE_PTS * config.pointsMult);
    const halfSamp = Math.floor(config.perpSamples / 2);

    for (let i = 0; i < armPts; i++) {
      const theta = (i / armPts) * THETA_MAX;
      const r     = INNER_R * Math.exp(SPIRAL_B * theta);
      if (r > maxR) break;

      // Radial brightness: soft power falloff, CAPPED to prevent orb
      const normalizedR      = (r - INNER_R) / (maxR - INNER_R);
      const radialBrightness = MAX_ARM_BRIGHT * Math.pow(1 - normalizedR, 0.5) * config.brightMult;

      // FLARE: perpendicular spread grows proportionally with radius
      const flaredHalf = r * FLARE_RATIO * config.widthMult;
      const sigma      = r * SIGMA_RATIO * config.widthMult;
      const spacing    = halfSamp > 0 ? flaredHalf / halfSamp : 0;

      for (let j = -halfSamp; j <= halfSamp; j++) {
        const offset      = j * spacing;
        // Gaussian cross-section — soft arm edges
        const gaussWeight = sigma > 0
          ? Math.exp(-(offset * offset) / (2 * sigma * sigma))
          : 1;
        const brightness  = radialBrightness * gaussWeight;

        if (brightness < 0.015) continue;

        points.push({
          baseTheta:   config.offset + theta,
          r,
          perpOffset:  offset,
          char:        CHARS[Math.floor(Math.random() * CHARS.length)],
          brightness,
          isEpicenter: false,
        });
      }
    }
  }

  return { points, maxR };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnimatedSpiralBackground({
  intensity     = 0.90,
  rotationSpeed = 0.00025,
}: AnimatedSpiralBackgroundProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const ctxRef         = useRef<CanvasRenderingContext2D | null>(null);
  const pointsRef      = useRef<SpiralPoint[]>([]);
  const timeRef        = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const isVisibleRef   = useRef(true);
  const dimensionsRef  = useRef({ width: 0, height: 0 });
  const maxRRef        = useRef<number>(0);

  const animate = useCallback(() => {
    if (!isVisibleRef.current || !ctxRef.current) return;

    const ctx               = ctxRef.current;
    const { width, height } = dimensionsRef.current;
    const time              = timeRef.current++;
    const maxR              = maxRRef.current;

    // Epicenter centered
    const cx = width  * 0.50;
    const cy = height * 0.50;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.font         = CHAR_FONT;
    ctx.textBaseline = 'middle';

    for (const p of pointsRef.current) {
      // Differential rotation — outer points travel faster (galaxy physics)
      const normalizedR = p.r / maxR;
      const speed       = rotationSpeed * (1 + normalizedR * DIFFERENTIAL);
      const theta       = p.baseTheta + time * speed;

      // Centerline position
      const cxPt = cx + p.r * Math.cos(theta);
      const cyPt = cy + p.r * Math.sin(theta);

      let x: number;
      let y: number;

      if (p.perpOffset === 0) {
        x = cxPt;
        y = cyPt;
      } else {
        // Perpendicular unit vector for log spiral
        const perpX = -(SPIRAL_B * Math.sin(theta) + Math.cos(theta)) / SPIRAL_PERP_NORM;
        const perpY =  (SPIRAL_B * Math.cos(theta) - Math.sin(theta)) / SPIRAL_PERP_NORM;
        x = cxPt + perpX * p.perpOffset;
        y = cyPt + perpY * p.perpOffset;
      }

      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;

      // Shimmer — subtle char flicker for organic texture
      const char = Math.random() > SHIMMER_RATE
        ? CHARS[Math.floor(Math.random() * CHARS.length)]
        : p.char;

      ctx.globalAlpha = p.brightness * intensity;
      ctx.fillStyle   = brightnessToColor(p.brightness);
      ctx.fillText(char, x, y);
    }

    ctx.globalAlpha        = 1;
    animationIdRef.current = requestAnimationFrame(animate);
  }, [intensity, rotationSpeed]);

  const handleResize = useCallback(() => {
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas    = canvasRef.current;
    const ctx       = ctxRef.current;
    const dpr       = window.devicePixelRatio || 1;
    const newWidth  = window.innerWidth;
    const newHeight = window.innerHeight;

    dimensionsRef.current = { width: newWidth, height: newHeight };
    canvas.width          = newWidth  * dpr;
    canvas.height         = newHeight * dpr;
    canvas.style.width    = `${newWidth}px`;
    canvas.style.height   = `${newHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const { points, maxR } = buildSpiralPoints(newWidth, newHeight);
    pointsRef.current = points;
    maxRRef.current   = maxR;
  }, []);

  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = document.visibilityState === 'visible';
    if (isVisibleRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationIdRef.current);
    }
  }, [animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctxRef.current = ctx;
    handleResize();

    animationIdRef.current = requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [animate, handleResize, handleVisibilityChange]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[-1] pointer-events-none block bg-black"
    />
  );
}
