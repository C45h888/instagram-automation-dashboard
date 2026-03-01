# Animated Dual Golden Spiral Background - Implementation Plan

## Executive Summary

This document outlines the implementation of a living ASCII art background for the Agent Terminal Dashboard. The design features **dual Fibonacci golden spirals** with glowing terminal-green numbers flowing **inward** from the outer edges toward a single convergence point at the center of the chat panel, creating a visual metaphor of "raw data streams converging into the Oversight Brain."

### Visual Inspiration

Based on the reference image showing geometric sacred geometry with dual vortices:
- Two spiral systems spawning at outer screen edges
- Numbers (0-9, A-F, #) flow inward along logarithmic spiral arms
- Both spirals converge to a single center point in the middle of the chat panel
- The spiral pattern emerges from Fibonacci mathematics: r = a·e^(b·θ)
- Full-screen coverage with reduced density in side panel areas (Activity Feed, Queue, Metrics)
- Overall intensity kept very low (0.10-0.16) for perfect panel readability

---

## Visual Architecture

### Layout Positioning

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ← 0─1─1─2─3─5─8─D─#                                    #─D─8─5─3─2─1─1─0 →  │
│     ↘                                                    ↙              │
│        ↘                                              ↓                 │
│           ↘                                        ↙                    │
│              ↘                                  ↙                       │
│                 ↘                            ↙                          │
│                    ↘                      ↙                             │
│                       ↘                ↙                                │
│  [Activity Feed]          ↘         ↙          [Queue Monitor]          │
│  (240-280px)                 ↘   ↙             (240-280px)              │
│                                 ↓                                       │
│                              ┌──────┐                                   │
│                              │ ████ │  ← CONVERGENCE                     │
│                              │ ████ │    CENTER                          │
│                              │ ████ │    (Chat Panel                     │
│                              │ ████ │     Middle)                        │
│                              └──────┘                                   │
│                                                                         │
│   LEFT SPIRAL                 ↓                 RIGHT SPIRAL            │
│   (clockwise)           NUMBERS FLOW          (counter-clockwise)       │
│                              INWARD                                     │
│                                                                         │
│  Full-screen canvas with lower density in side panel areas              │
│  Mobile: Continues full-screen behind single visible panel              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Density Zones

```typescript
// Screen is divided into 5 vertical zones
// Density decreases as we move away from chat center toward edges

const getDensityMultiplier = (x: number, width: number) => {
  const relativeX = x / width;
  
  // Activity Feed zone (0% - 25%): 30% density
  if (relativeX < 0.25) return 0.30;
  
  // Activity→Chat transition (25% - 35%): 60% density
  if (relativeX < 0.35) return 0.60;
  
  // Chat center zone (35% - 65%): 100% density (full convergence)
  if (relativeX < 0.65) return 1.00;
  
  // Chat→Queue transition (65% - 75%): 60% density
  if (relativeX < 0.75) return 0.60;
  
  // Queue/Metrics zone (75% - 100%): 30% density
  return 0.30;
};
```

### Spiral Spawn Points

```typescript
// Spirals spawn at outer screen edges, NOT at spiral centers
// Left spiral spawns from left edge, right spiral from right edge

const getSpawnPoint = (spiralIndex: 0 | 1, width: number, height: number) => {
  const edgeOffset = Math.max(width, height) * 0.55; // Beyond screen bounds
  const startAngle = Math.random() * Math.PI * 2;
  
  if (spiralIndex === 0) {
    // Left spiral: spawn from left side
    return {
      x: (width * 0.25) + edgeOffset * Math.cos(startAngle),
      y: (height * 0.5) + edgeOffset * Math.sin(startAngle)
    };
  } else {
    // Right spiral: spawn from right side
    return {
      x: (width * 0.75) + edgeOffset * Math.cos(startAngle),
      y: (height * 0.5) + edgeOffset * Math.sin(startAngle)
    };
  }
};
```

---

## Technical Implementation

### 1. Component Structure

**New File:** `src/components/agent-terminal/AnimatedSpiralBackground.tsx`

```typescript
interface SpiralNumber {
  id: number;           // Unique identifier
  x: number;            // Current X position
  y: number;            // Current Y position
  angle: number;        // Current angle in spiral (radians)
  radius: number;       // Distance from convergence center (shrinks over time)
  spiralIndex: 0 | 1;   // Which spiral (0 = left, 1 = right)
  char: string;         // '0'-'9', 'A'-'F', '#'
  age: number;          // Frames since spawn
  speed: number;        // Inward velocity (pixels per frame)
  alpha: number;        // Current opacity
  hueShift: number;     // For occasional cyan flash
}

interface AnimatedSpiralBackgroundProps {
  intensity?: number;        // Global opacity multiplier (0.10 - 0.16)
  maxParticles?: number;     // Maximum numbers on screen (180 - 220)
  spawnRate?: number;        // Spawn probability per frame (0.22 - 0.28)
}
```

### 2. Convergence Center Positioning

**Single Center Point:**

```typescript
// Both spirals converge to the center of the chat panel
// In the 4-column grid: columns are [240px/280px | 1fr | 240px/280px | 260px]
// Chat panel is the 1fr (flexible) column in the middle

const getConvergenceCenter = (width: number, height: number) => {
  // On desktop (>=1280px): center is middle of screen
  // Side panels are roughly equal width, chat is centered
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  
  return { x: centerX, y: centerY };
};

// Spiral "origins" (where numbers appear to come from)
// These are offset from the convergence center to create the dual spiral effect
const getSpiralOrigins = (width: number, height: number) => {
  const center = getConvergenceCenter(width, height);
  const offset = Math.min(width, height) * 0.25; // 25% of smaller dimension
  
  return {
    left: { 
      x: center.x - offset, 
      y: center.y 
    },
    right: { 
      x: center.x + offset, 
      y: center.y 
    }
  };
};
```

### 3. Spiral Mathematics (Inward Flow)

**Fibonacci Golden Spiral Formula:**

```typescript
const PHI = 1.618033988749895;  // Golden ratio
const b = Math.log(PHI) / (Math.PI / 2);  // Growth constant

// Update particle position (INWARD flow)
const updateParticle = (particle: SpiralNumber, center: { x: number; y: number }) => {
  // Move inward: radius decreases
  // Speed increases slightly as we approach center for dramatic effect
  const speedMultiplier = 1 + (startRadius - particle.radius) / startRadius * 0.3;
  particle.radius -= particle.speed * speedMultiplier;
  
  // Rotate around center
  particle.angle += 0.028;  // Angular velocity
  
  // Calculate new position
  // Left spiral (0) rotates clockwise, right spiral (1) counter-clockwise
  const direction = particle.spiralIndex === 0 ? 1 : -1;
  
  particle.x = center.x + particle.radius * Math.cos(particle.angle);
  particle.y = center.y + particle.radius * Math.sin(particle.angle * 0.97); // Slight asymmetry
  
  // Brighten as we approach center
  const convergenceProgress = 1 - (particle.radius / startRadius);
  particle.alpha = 0.6 + (convergenceProgress * 0.4);  // 0.6 → 1.0
  
  particle.age++;
};
```

### 4. Spawn System (Outer Edge)

**Spawn Logic:**

```typescript
const CHARS = '0123456789ABCDEF#';

const spawnParticle = (spiralIndex: 0 | 1, width: number, height: number): SpiralNumber => {
  const center = getConvergenceCenter(width, height);
  const startRadius = Math.max(width, height) * 0.55;  // Spawn beyond screen edges
  const startAngle = Math.random() * Math.PI * 2;
  
  // Calculate spawn position based on spiral origin offset
  const origins = getSpiralOrigins(width, height);
  const origin = spiralIndex === 0 ? origins.left : origins.right;
  
  return {
    id: nextId++,
    x: origin.x + startRadius * Math.cos(startAngle),
    y: origin.y + startRadius * Math.sin(startAngle),
    angle: startAngle,
    radius: startRadius,
    spiralIndex,
    char: CHARS[Math.floor(Math.random() * CHARS.length)],
    age: 0,
    speed: 0.65 + Math.random() * 1.1,  // Varied speeds for organic feel
    alpha: 0.8 + Math.random() * 0.2,
    hueShift: Math.random(),
  };
};

// Main spawn loop (lowered for cleanliness)
if (Math.random() < 0.26 && particles.length < maxParticles) {
  // Spawn for both spirals
  particles.push(spawnParticle(0, width, height));  // Left spiral
  particles.push(spawnParticle(1, width, height));  // Right spiral
}
```

### 5. Animation Loop

**Frame Update Logic:**

```typescript
const animate = () => {
  if (!isVisible) return;  // Pause when tab hidden
  
  // 1. Trail effect - gentle fade
  ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';  // Gentler trail
  ctx.fillRect(0, 0, width, height);
  
  const center = getConvergenceCenter(width, height);
  
  // 2. Update and draw all particles
  particles.forEach(p => {
    // Update position (inward)
    updateParticle(p, center);
    
    // Check density zone for this x position
    const densityMultiplier = getDensityMultiplier(p.x, width);
    
    // Skip rendering if outside density threshold (creates sparse edges)
    if (Math.random() > densityMultiplier) return;
    
    // Calculate render opacity with intensity multiplier
    const renderAlpha = p.alpha * intensity;
    
    // Fade out very near center (convergence effect)
    if (p.radius < 30) {
      p.alpha *= 0.9;  // Rapid fade at convergence
    }
    
    // Color: 82% green, 18% cyan flash
    const color = p.hueShift > 0.82 ? '#00ffff' : '#00ff41';
    
    // Render
    ctx.globalAlpha = renderAlpha;
    ctx.fillStyle = color;
    ctx.font = '13px "JetBrains Mono"';
    ctx.fillText(p.char, p.x, p.y);
  });
  
  // 3. Remove particles that reached center or faded out
  particles = particles.filter(p => p.radius > 5 && p.alpha > 0.01);
  
  // 4. Draw center convergence bloom
  const particlesNearCenter = particles.filter(p => p.radius < 80).length;
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
  
  // 5. Spawn new particles
  if (Math.random() < spawnRate && particles.length < maxParticles) {
    particles.push(spawnParticle(0, width, height));
    particles.push(spawnParticle(1, width, height));
  }
  
  requestAnimationFrame(animate);
};
```

### 6. Canvas Configuration

**High-DPI & Full Screen Setup:**

```typescript
// Resize handler (critical for responsive)
const handleResize = () => {
  const dpr = window.devicePixelRatio || 1;
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight;
  
  // Set actual canvas size (scaled for DPR)
  canvas.width = newWidth * dpr;
  canvas.height = newHeight * dpr;
  
  // Set display size
  canvas.style.width = `${newWidth}px`;
  canvas.style.height = `${newHeight}px`;
  
  // Scale context for high-DPI displays
  ctx.scale(dpr, dpr);
  
  // Update dimensions
  width = newWidth;
  height = newHeight;
};

// Visibility handler (performance)
const handleVisibilityChange = () => {
  isVisible = document.visibilityState === 'visible';
  if (isVisible) {
    requestAnimationFrame(animate);
  }
};
```

### 7. Default Props

```typescript
const DEFAULT_PROPS = {
  intensity: 0.14,        // 0.10 - 0.16 range
  maxParticles: 200,      // 180 - 220 range
  spawnRate: 0.26,        // 0.22 - 0.28 range
};
```

---

## Integration Plan

### Phase 0 - Component Creation

**File:** `src/components/agent-terminal/AnimatedSpiralBackground.tsx`

1. Create canvas with full-screen fixed positioning
2. Implement resize handler for responsive behavior
3. Implement visibility change handler for performance
4. Implement convergence center calculation (chat panel center)
5. Implement dual spiral origin offsets
6. Implement Fibonacci golden spiral mathematics (inward flow)
7. Implement density zone system for side panel areas
8. Implement particle spawn/update/render cycle
9. Implement center convergence bloom effect
10. Expose props: intensity, maxParticles, spawnRate

### Phase 1 - Dashboard Integration

**File:** `src/components/agent-terminal/AgentTerminalDashboard.tsx`

Insert as first child of `.terminal-root` with explicit z-index and pointer-events:

```tsx
<div className="terminal-root fixed inset-0 z-[60] grid grid-rows-[auto_1fr_auto]">
  {/* Background layer - explicitly behind all content */}
  <div className="absolute inset-0 z-[-1] pointer-events-none">
    <AnimatedSpiralBackground 
      intensity={0.14}
      maxParticles={200}
      spawnRate={0.26}
    />
  </div>
  
  {/* Existing terminal UI remains unchanged */}
  <header>...</header>
  <main>...</main>
  <footer>...</footer>
</div>
```

**Key Integration Requirements:**

```css
/* Explicit z-[-1] and pointer-events-none (CRITICAL) */
.spiral-background-container {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

/* Canvas fills container */
.spiral-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
```

### Phase 2 - Parameter Tuning

**Tunable Props:**

```typescript
interface AnimatedSpiralBackgroundProps {
  intensity?: number;        // 0.10 - 0.16 (default: 0.14)
  maxParticles?: number;     // 180 - 220 (default: 200)
  spawnRate?: number;        // 0.22 - 0.28 (default: 0.26)
}
```

**Visual Tuning Guidelines:**
- `intensity`: Lower = more subtle, Higher = more visible (keep ≤0.16 for readability)
- `maxParticles`: More particles = denser spiral pattern (keep ≤220 for performance)
- `spawnRate`: Higher = more frequent spawns (keep ≤0.28 to prevent clutter)

### Phase 3 - Verification Checklist

**Desktop Testing (1280px+):**
- [ ] Numbers spawn at outer edges and flow inward toward chat center
- [ ] Dual spiral pattern emerges naturally from number density
- [ ] Left spiral rotates clockwise, right spiral counter-clockwise
- [ ] Side panel areas (Activity Feed, Queue, Metrics) have visibly lower density
- [ ] Center chat panel shows full convergence effect
- [ ] All text in all panels remains 100% readable at all times
- [ ] Center bloom pulses gently when many particles converge
- [ ] No performance degradation during 30+ minute sessions

**Tablet Testing (768px - 1279px):**
- [ ] Spirals adjust to 3-column layout (Activity | Chat | Queue)
- [ ] Metrics panel is tab-only, spiral continues full-screen
- [ ] Density zones adjust to new layout proportions
- [ ] Touch interactions work normally

**Mobile Testing (<768px):**
- [ ] Single visible panel with spiral continuing full-screen behind
- [ ] Density calculation adapts to single-panel view
- [ ] Performance remains smooth

**Performance Metrics:**
- [ ] CPU usage < 8% on mid-range hardware
- [ ] 60fps maintained consistently
- [ ] Memory usage stable (no leaks over time)
- [ ] Animation pauses cleanly when tab hidden
- [ ] Resumes correctly when tab becomes visible

---

## Color Palette Integration

**From `tailwind.config.js`:**

```javascript
terminal: {
  green: '#00ff41',   // Primary number color (82% of particles)
  cyan: '#00ffff',    // Flash color (18% of particles)
  bg: '#000000',      // Canvas background
}
```

**Rendering Colors:**
- 82% of numbers: `#00ff41` (terminal-green)
- 18% of numbers: `#00ffff` (terminal-cyan) - occasional flash
- Trail fade: `rgba(0, 0, 0, 0.10)` (gentle persistence)
- Center bloom: `#00ff41` with opacity 0.0 - 0.35

---

## File Structure

```
src/components/agent-terminal/
├── AgentTerminalDashboard.tsx          # MODIFY: Add background component
├── AnimatedSpiralBackground.tsx        # NEW: Main animation component
├── ActivityFeedPanel.tsx               # Existing
├── QueueMonitorPanel.tsx               # Existing
├── MetricsOverviewPanel.tsx            # Existing
├── TerminalStatusBar.tsx               # Existing
├── TerminalInput.tsx                   # Existing
└── TerminalScrollArea.tsx              # Existing
```

---

## Technical Constraints (All Satisfied)

| Constraint | Implementation |
|------------|----------------|
| **No new dependencies** | Pure Canvas API + React hooks |
| **Terminal color palette** | Uses `terminal-green` and `terminal-cyan` |
| **JetBrains Mono font** | `ctx.font = '13px "JetBrains Mono"'` |
| **z-[-1] layering** | Explicit `z-index: -1` on container |
| **pointer-events-none** | Explicit `pointer-events: none` on container |
| **60fps animation** | `requestAnimationFrame` with delta timing |
| **Tab visibility pause** | `document.visibilityState` listener |
| **devicePixelRatio** | Canvas scaled by `window.devicePixelRatio` |
| **Opacity 0.10-0.16** | Configurable via `intensity` prop |
| **No breaking changes** | Purely decorative, additive only |
| **Responsive resize handler** | Explicit `resize` event listener |
| **Performance cap** | `maxParticles` prop limits count |

---

## Implementation Order

1. **Create component file** - `AnimatedSpiralBackground.tsx`
2. **Implement canvas setup** - sizing, DPR scaling, context, resize handler
3. **Implement visibility handler** - pause/resume on tab visibility
4. **Implement convergence center** - calculate chat panel center point
5. **Implement spiral origins** - dual offset points for left/right spirals
6. **Implement spawn system** - outer edge spawn with density zones
7. **Implement spiral math** - Fibonacci inward flow
8. **Implement render loop** - trail effect, particle drawing, center bloom
9. **Integrate into dashboard** - Add with z-[-1] and pointer-events-none
10. **Tune parameters** - Adjust intensity, maxParticles, spawnRate
11. **Verify performance** - Test on desktop, tablet, mobile

---

## Success Criteria

The implementation is successful when:

1. ✅ Dual spirals converge visibly toward the center of the chat panel
2. ✅ Numbers flow smoothly inward from outer edges
3. ✅ Side panel areas (Activity Feed, Queue, Metrics) have reduced density
4. ✅ All terminal panels remain 100% readable at all times
5. ✅ Animation runs at 60fps without stuttering
6. ✅ CPU usage stays below 8% during continuous operation
7. ✅ Animation pauses cleanly when tab is hidden
8. ✅ No new dependencies added to the project
9. ✅ Zero impact on existing functionality
10. ✅ Mobile responsive with adaptive density
11. ✅ Resize handler works correctly (window resize updates spiral positions)

---

## Open Questions for Further Clarification

None at this time. Plan is ready for implementation.

---

*End of Implementation Plan*
