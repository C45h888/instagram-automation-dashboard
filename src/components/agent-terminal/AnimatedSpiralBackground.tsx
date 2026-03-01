/**
 * AnimatedSpiralBackground.tsx
 *
 * Dual Fibonacci golden spiral background with ASCII numbers flowing inward.
 * Numbers spawn at outer edges and converge to the center of the chat panel,
 * creating a visual metaphor of "raw data streams converging into the Oversight Brain."
 *
 * Features:
 * - Full-screen canvas with density zones for side panels
 * - Dual spirals (left clockwise, right counter-clockwise)
 * - Fibonacci golden ratio mathematics
 * - Tab visibility pause for performance
 * - Responsive resize handling
 */

import { useEffect, useRef, useCallback } from 'react';

interface SpiralNumber {
  id: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  spiralIndex: 0 | 1;
  char: string;
  age: number;
  speed: number;
  alpha: number;
  hueShift: number;
}

interface AnimatedSpiralBackgroundProps {
  intensity?: number;
  maxParticles?: number;
  spawnRate?: number;
}

const CHARS = '0123456789ABCDEF#';

export default function AnimatedSpiralBackground({
  intensity = 0.14,
  maxParticles = 200,
  spawnRate = 0.26,
}: AnimatedSpiralBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const particlesRef = useRef<SpiralNumber[]>([]);
  const animationIdRef = useRef<number>(0);
  const isVisibleRef = useRef(true);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const nextIdRef = useRef(0);

  // Get convergence center (middle of screen where chat panel is)
  const getConvergenceCenter = useCallback((width: number, height: number) => {
    return {
      x: width * 0.5,
      y: height * 0.5,
    };
  }, []);

  // Get spiral origins (offset from center for dual spiral effect)
  const getSpiralOrigins = useCallback(
    (width: number, height: number) => {
      const center = getConvergenceCenter(width, height);
      const offset = Math.min(width, height) * 0.25;

      return {
        left: { x: center.x - offset, y: center.y },
        right: { x: center.x + offset, y: center.y },
      };
    },
    [getConvergenceCenter]
  );

  // Density multiplier based on x position (lower density in side panels)
  const getDensityMultiplier = (x: number, width: number): number => {
    const relativeX = x / width;

    // Activity Feed zone (0% - 25%): 30% density
    if (relativeX < 0.25) return 0.3;

    // Activity→Chat transition (25% - 35%): 60% density
    if (relativeX < 0.35) return 0.6;

    // Chat center zone (35% - 65%): 100% density (full convergence)
    if (relativeX < 0.65) return 1.0;

    // Chat→Queue transition (65% - 75%): 60% density
    if (relativeX < 0.75) return 0.6;

    // Queue/Metrics zone (75% - 100%): 30% density
    return 0.3;
  };

  // Spawn a new particle
  const spawnParticle = useCallback(
    (spiralIndex: 0 | 1, width: number, height: number): SpiralNumber => {
      const origins = getSpiralOrigins(width, height);
      const startRadius = Math.max(width, height) * 0.55;
      const startAngle = Math.random() * Math.PI * 2;
      const origin = spiralIndex === 0 ? origins.left : origins.right;

      return {
        id: nextIdRef.current++,
        x: origin.x + startRadius * Math.cos(startAngle),
        y: origin.y + startRadius * Math.sin(startAngle),
        angle: startAngle,
        radius: startRadius,
        spiralIndex,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        age: 0,
        speed: 0.65 + Math.random() * 1.1,
        alpha: 0.8 + Math.random() * 0.2,
        hueShift: Math.random(),
      };
    },
    [getSpiralOrigins]
  );

  // Update particle position (inward flow)
  const updateParticle = (
    particle: SpiralNumber,
    center: { x: number; y: number },
    startRadius: number
  ): void => {
    // Move inward: radius decreases
    // Speed increases slightly as we approach center
    const speedMultiplier =
      1 + ((startRadius - particle.radius) / startRadius) * 0.3;
    particle.radius -= particle.speed * speedMultiplier;

    // Rotate around center
    particle.angle += 0.028;

    // Calculate new position
    // Left spiral (0) rotates clockwise, right spiral (1) counter-clockwise
    const direction = particle.spiralIndex === 0 ? 1 : -1;

    particle.x =
      center.x + particle.radius * Math.cos(particle.angle * direction);
    particle.y =
      center.y +
      particle.radius * Math.sin(particle.angle * direction * 0.97);

    // Brighten as we approach center
    const convergenceProgress = 1 - particle.radius / startRadius;
    particle.alpha = 0.6 + convergenceProgress * 0.4;

    particle.age++;
  };

  // Main animation loop
  const animate = useCallback(() => {
    if (!isVisibleRef.current || !ctxRef.current || !canvasRef.current) return;

    const ctx = ctxRef.current;
    const { width, height } = dimensionsRef.current;

    // Trail effect - gentle fade
    ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
    ctx.fillRect(0, 0, width, height);

    const center = getConvergenceCenter(width, height);
    const startRadius = Math.max(width, height) * 0.55;

    // Update and draw all particles
    particlesRef.current.forEach((p) => {
      // Update position (inward)
      updateParticle(p, center, startRadius);

      // Check density zone for this x position
      const densityMultiplier = getDensityMultiplier(p.x, width);

      // Skip rendering based on density (creates sparse edges)
      if (Math.random() > densityMultiplier) return;

      // Fade out very near center (convergence effect)
      if (p.radius < 30) {
        p.alpha *= 0.9;
      }

      // Don't render if fully faded
      if (p.alpha <= 0.01) return;

      // Calculate render opacity with intensity multiplier
      const renderAlpha = p.alpha * intensity;

      // Color: 82% green, 18% cyan flash
      const color = p.hueShift > 0.82 ? '#00ffff' : '#00ff41';

      // Render
      ctx.globalAlpha = renderAlpha;
      ctx.fillStyle = color;
      ctx.font = '13px "JetBrains Mono"';
      ctx.fillText(p.char, p.x, p.y);
    });

    // Remove particles that reached center or faded out
    particlesRef.current = particlesRef.current.filter(
      (p) => p.radius > 5 && p.alpha > 0.01
    );

    // Draw center convergence bloom
    const particlesNearCenter = particlesRef.current.filter(
      (p) => p.radius < 80
    ).length;
    const centerBloomAlpha = Math.min(0.35, particlesNearCenter * 0.008);

    if (centerBloomAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = centerBloomAlpha * intensity;
      ctx.fillStyle = '#00ff41';
      ctx.beginPath();
      ctx.arc(center.x, center.y, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Spawn new particles
    if (
      Math.random() < spawnRate &&
      particlesRef.current.length < maxParticles
    ) {
      particlesRef.current.push(spawnParticle(0, width, height));
      particlesRef.current.push(spawnParticle(1, width, height));
    }

    animationIdRef.current = requestAnimationFrame(animate);
  }, [intensity, maxParticles, spawnRate, spawnParticle, getConvergenceCenter]);

  // Handle resize
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !ctxRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const dpr = window.devicePixelRatio || 1;

    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    // Update dimensions FIRST (before canvas operations)
    dimensionsRef.current = { width: newWidth, height: newHeight };

    // Set actual canvas size (scaled for DPR)
    canvas.width = newWidth * dpr;
    canvas.height = newHeight * dpr;

    // Set display size
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    // Reset transform and scale context for high-DPI displays
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }, []);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = document.visibilityState === 'visible';

    if (isVisibleRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationIdRef.current);
    }
  }, [animate]);

  // Initialize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas ref is null');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context');
      return;
    }

    ctxRef.current = ctx;

    // Initial setup
    handleResize();

    // Spawn initial particles so something is visible immediately
    const { width, height } = dimensionsRef.current;
    if (width > 0 && height > 0) {
      for (let i = 0; i < 20; i++) {
        particlesRef.current.push(spawnParticle(0, width, height));
        particlesRef.current.push(spawnParticle(1, width, height));
      }
    }

    // Start animation
    animationIdRef.current = requestAnimationFrame(animate);
    console.log('AnimatedSpiralBackground initialized');

    // Event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationIdRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [animate, handleResize, handleVisibilityChange, spawnParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{
        background: '#000000',
        display: 'block'
      }}
    />
  );
}
