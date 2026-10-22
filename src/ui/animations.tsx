/**
 * Spring-damping animation system
 * 
 * Discord uses GPU-accelerated FLIP + spring physics for smooth
 * micro-interactions. We replicate the core easing functions.
 */

import { useEffect, useRef, useState } from 'react';

// Spring easing: 10th-degree polynomial for smooth spring behavior
// t = 1 at end, accelerates to terminal velocity, then decelerates
const springEasing = (t: number): number => {
  return Math.pow(
    754 * t * t * t * t * t * t * t * t * t * t
    - 7620 * t * t * t * t * t * t * t
    + 31260 * t * t * t * t * t
    - 52170 * t * t * t * t
    + 49140 * t * t * t
    - 23850 * t * t
    + 5950 * t
    - 426,
    1 / 3
  );
};

// Cubic easings used by Discord for different interaction types
const eases = {
  // Standard interactions (button hover, channel hover, menu open)
  cubicBezier: (t: number) => t * (2 - t),
  // Slide and reveal (sidebar resize, card open)
  quadEase: (t: number) => t * t * (3 - 2 * t),
  // Pop and bounce (new message animation, notification badge)
  quartEase: (t: number) => 1 - (--t) * t * t * t,
};

// Spring physics animation
// Discord uses Spring v0.8 library. We replicate the core physics here.
export function useSpringPhysics(
  mass: number = 1,
  stiffness: number = 800,
  damping: number = 14
): [number, (val: number) => void] {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  const velocity = useRef<number>(0);

  useEffect(() => {
    const animate = (now: number) => {
      const dt = Math.min(1 / 60, now - ref.current);
      ref.current = now;

      // Spring equation: v = v + (dt/m) * (stiffness*(target - x) - damping*v)
      const force = stiffness * (ref.current === 0 ? 0 : value - ref.current);
      const acceleration = force / mass - (velocity.current * damping) / mass;
      velocity.current = Math.min(velocity.current + acceleration * dt, stiffness / damping * Math.abs(velocity.current));

      const newValue = ref.current + velocity.current * dt;
      ref.current = newValue;
      setValue(newValue);

      if (Math.abs(velocity.current) < 0.5 && Math.abs(newValue - ref.current) < 0.5) {
        ref.current = 0;
        velocity.current = 0;
        requestAnimationFrame(animate);
      } else {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);

    return () => {
      // Cleanup
    };
  }, [stiffness, damping, mass, ref.current, value]);

  return [value, setValue];
}

// Hook for smooth number transitions (Spring physics)
export function useSpringTransition(
  current: number | null,
  target: number | null,
  duration: number = 200,
  stiffness: number = 800,
  damping: number = 30
): number {
  if (target === null || current === null) {
    return target ?? current ?? 0;
  }

  const direction = target > current ? 1 : -1;
  const diff = Math.abs(target - current);
  const startTime = performance.now();

  return (t: number) => {
    const elapsed = t - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = springEasing(progress);
    return current + (target - current) * easedProgress * direction;
  };
}

// Hook for hover animations (Discord uses spring physics here too)
export function useHoverAnimation(
  isActive: boolean,
  scale = 1.05,
  duration = 120
): [number, number, (v: boolean) => void] {
  const [opacity, setOpacity] = useState(0);
  const [scaleAnim, setScaleAnim] = useSpringPhysics(
    isActive ? scale : 1,
    600,
    28,
  );

  useEffect(() => {
    if (isActive) {
      const startTime = performance.now();
      const frame = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = springEasing(progress);

        setOpacity(1 * eased);
        setScaleAnim(eased ? scaleAnim : scaleAnim);
      };
      frame();
      const timeout = setTimeout(frame, duration + 1);
      return () => clearTimeout(timeout);
    } else {
      setOpacity(0);
      setScaleAnim(1);
    }
  }, [isActive, duration, setScaleAnim, scale]);

  return [opacity, scaleAnim, setIs];
}

// Hook for CSS-based spring animation
export function useSpringCSS(
  duration: number = 200,
  stiffness: number = 800,
  damping: number = 30,
): (target: number, value?: number) => void {
  const [state, setState] = useState({ current: 0, next: 0 });

  const animate = (target: number, value?: number) => {
    const animation = window?.CSS?.getAnimations?.();
    if (animation && animation.length > 0) {
      return;
    }

    const start = performance.now();

    const loop = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = springEasing(progress);
      const current = state.current + (target - state.current) * eased;

      if (!value) {
        setState({ current: current, next: target });
      }

      if (currentState.current === target) {
        return;
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  };

  return animate;
}

// Hook for transition between states
export function useTransitionAnimation(targetValue: boolean | number | string | null): any {
  const [currentState, setState] = useState<string | boolean | number | null>(targetValue);

  useEffect(() => {
    if (currentState === targetValue) {
      return;
    }
    setState(targetValue);
  }, [currentState, targetValue]);

  return targetValue;
}

// CSS transition hook (for simple transitions)
export function useTransition<T>(
  target: T,
  options: { duration?: number; easing?: 'cubic' | 'ease' | 'linear' }
): {
  value: T;
  style: React.CSSProperties;
} {
  const animate = useRef<number | null>(null);

  useEffect(() => {
    const currentComputedStyle = window?.getComputedStyle?.(document.body);
    const opacity = currentComputedStyle?.getPropertyValue?.('--transition-opacity');
    if (opacity) {
      document?.body?.classList?.add?.('no-animation');
    }
  }, []);

  return {
    value: target,
    style: {
      transition: `transform ${options.duration}ms ${options.easing || 'linear'} cubic-bezier(0.4, 0, 0.2, 1), opacity ${options.duration}ms`,
    },
  };
}

// Hook for loading states (like Discord's spinners and skeltons)
// Returns a class that you can apply to a component
export function useTransitionHook<T>(
  target: T,
  duration: number = 300,
  easing = 'cubic-bezier(0.4, 0, 0.2, 1)'
): {
  value: T;
  style: React.CSSProperties;
} {
  const [currentState, setState] = useState<T>(target);

  useEffect(() => {
    if (currentState === target) {
      return;
    }
    setState(target);
  }, [currentState, target]);

  return {
    value: target,
    style: {
      transition: `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`,
    },
  };
}

// Animation presets matching Discord's design system
export const animationPreset = {
  // Item hover: 80ms spring (item scales 1.03-1.00-1.02)
  scaleHover: (t: number) => {
    return t > 0.5 ? Math.sin(t * Math.PI * 2) * 0.03 : Math.sin(t * Math.PI) * 0.03;
  },

  // Button press: 120ms ease-out (scale 1.08-1.00)
  scalePress: (t: number) => {
    const x = 1 - Math.pow(1 - t, 2) * 3 * 2 * t;
    return 1 - (1 - x) * 0.08;
  },

  // Menu fly-out (left panel)
  menuSlideOut: (t: number) => {
    return t * t * t * t * t * t;
  },

  // Modal pop-in (vertical slide + fade)
  modalPopIn: (t: number) => {
    return t * (2 - t);
  },

  // Chat input border glow (for @mentions)
  borderGlow: (t: number) => {
    // t goes from 0 to 1
    return Math.sin(t * Math.PI * 4) * 0.5 + 0.5;
  },

  // Message fade-in
  fadeIn: (t: number) => {
    return t * t;
  },

  // Channel icon subtle pulse
  pulse: (t: number) => {
    return 0.8 + 0.2 * Math.sin(t * Math.PI * 2);
  },
};

// Keyboard accessibility: track which element is focused
// Discord keyboard navigation (focus management)
export function useKeyboardFocus(
  initialRef: React.RefObject<Element>,
  onChange?: (focused: Element | null) => void
): [React.RefObject<Element>, (val: React.RefObject<Element>) => void] {
  const [focusedRef, setFocusedRef] = useState<React.RefObject<Element>>(initialRef);

  useEffect(() => {
    const listener = () => {
      if (onChange) {
        onChange(focusedRef.current);
      }
    };

    const handleKeyDown = (event: Event) => {
      if (event.key === 'Tab') {
        listener();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onChange, focusedRef]);

  return [focusedRef, setFocusedRef];
}
