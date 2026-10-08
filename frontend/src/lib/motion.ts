import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Motion helpers. Durations and the easing curve are CSS tokens (--dur-*, --ease in
 * styles.css); script-driven motion reads the same tokens, and everything becomes an instant
 * change when the system asks for reduced motion.
 */
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const DEFAULT_EASE = 'cubic-bezier(0.2, 0, 0, 1)';
const FALLBACK_MS = { '--dur-fast': 150, '--dur': 200, '--dur-slow': 300 } as const;
export type DurationToken = keyof typeof FALLBACK_MS;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(REDUCED_QUERY).matches;
}

function subscribeReduced(callback: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(REDUCED_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

/** True while the system asks for reduced motion; follows changes live. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, prefersReducedMotion, () => false);
}

function cssToken(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A duration token in milliseconds (0 under reduced motion). */
export function durationMs(token: DurationToken): number {
  if (prefersReducedMotion()) return 0;
  const raw = cssToken(token);
  if (!raw) return FALLBACK_MS[token];
  const value = parseFloat(raw);
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : FALLBACK_MS[token];
}

/** The shared easing curve, as CSS writes it: "cubic-bezier(x1, y1, x2, y2)". */
export function easingToken(): string {
  return cssToken('--ease') || DEFAULT_EASE;
}

/** Evaluates a CSS cubic-bezier easing at progress t (0..1). */
export function cubicBezier(easing: string): (t: number) => number {
  const match = /cubic-bezier\(([^)]+)\)/.exec(easing);
  const nums = match?.[1]?.split(',').map(Number) ?? [];
  const [x1, y1, x2, y2] = nums.length === 4 && nums.every(Number.isFinite) ? nums : [0.2, 0, 0, 1];
  const bez = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Find t for x by bisection (monotonic in x for valid CSS curves), then return y(t).
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bez(x1!, x2!, mid) < x) lo = mid;
      else hi = mid;
    }
    return bez(y1!, y2!, (lo + hi) / 2);
  };
}

/**
 * A number that counts from its previous value to the new one when it changes, over the slow
 * duration token with the shared easing. The first value and every value under reduced motion
 * are shown immediately.
 */
export function useCountUp(target: number | null): number | null {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    from.current = target;
    const duration = durationMs('--dur-slow');
    if (reduced || target === null || start === null || start === target || duration === 0) {
      setShown(target);
      return;
    }
    const ease = cubicBezier(easingToken());
    const began = performance.now();
    let frame = requestAnimationFrame(function step() {
      const p = Math.min(1, (performance.now() - began) / duration);
      setShown(start + (target - start) * ease(p));
      if (p < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);

  return shown;
}
