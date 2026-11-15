/**
 * Centre x of the tempo chip: it docks `gap` right of the wobble plate and never goes closer than
 * `margin` to the screen edge.
 */
export function tempoChipX(
  plateRight: number,
  chipWidth: number,
  gap: number,
  screenWidth: number,
  margin: number,
): number {
  const docked = plateRight + gap + chipWidth / 2;
  return Math.min(docked, screenWidth - margin - chipWidth / 2);
}
