/**
 * Timing of the landing globe (seconds) and the burn-then-regrowth loop.
 * Display only: none of this is measured. Pure, tested.
 */

/* The globe always turns; the intro only adds a faster start. */
export const TURN = 4.2; // degrees of longitude per second: one revolution in about 86 s
export const SPIN = 5; // the extra opening turn decelerates over this long
export const SPIN_FROM = 120; // degrees of extra turn at the very start
export const ASSEMBLE_SPREAD = 1.15; // dots appear on the lit side first, sweeping to the night side
export const DOT_GROW = 0.9;
export const MARK_AT = 2.6;
export const LEADER_AT = 3.2;
export const TYPE_AT = 3.5;
export const ORBITS_AT = 1.4; // orbit paths start drawing
export const ORBIT_DRAW = 2.2; // and take this long to close
/** A time after every intro step: reduced motion draws this pose. */
export const SETTLED = 99;

/* Burn and regrowth at the study area: land pins near it burn down in burgundy, then
   grow back in mint, on a loop. */
export const BURN_R = 11; // degrees around the study area that take part
export const BURN_CYCLE = 11; // seconds per loop
export const BURN_AT = MARK_AT + 1.4;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const quintOut = (x: number) => 1 - Math.pow(1 - x, 5);
export const cubicOut = (x: number) => 1 - Math.pow(1 - x, 3);

/** Where the burn loop is: `active` once it has started, `c` the position in the loop (0…1). */
export function burnCycle(t: number, still: boolean): { active: boolean; c: number } {
  const active = !still && t > BURN_AT;
  return { active, c: active ? ((t - BURN_AT) % BURN_CYCLE) / BURN_CYCLE : 0 };
}

/**
 * 0 = living, 1 = just burned, for a place `d` degrees from the study area at
 * loop position `c`. The fire spreads outward (farther places start a little
 * later), holds, then eases back as the forest regrows.
 */
export function heatAt(c: number, d: number): number {
  const p = c - (d / BURN_R) * 0.1;
  if (p < 0 || p >= 0.85) return 0;
  if (p < 0.03) return p / 0.03;
  if (p < 0.3) return 1;
  const x = (p - 0.3) / 0.55;
  return 1 - x * x * (3 - 2 * x);
}

/** Heat of a land pin: as `heatAt`, strongest at the centre and fading to nothing at `BURN_R`. */
export function pinHeat(c: number, d: number): number {
  if (d >= BURN_R) return 0;
  return heatAt(c, d) * (1 - Math.pow(d / BURN_R, 2));
}

/** The study mark's own heat: burned before the loop starts, then following the loop's centre. */
export function coreHeat(cycle: { active: boolean; c: number }): number {
  return cycle.active ? heatAt(cycle.c, 0) : 1;
}
