/** Centre x of the tempo chip: it docks `gap` right of the wobble plate. */
export function tempoChipX(plateRight: number, chipWidth: number, gap: number): number {
  return plateRight + gap + chipWidth / 2;
}

/**
 * Centre x of the wobble plate. It stands in the middle of the screen unless the plate, the gap
 * and the tempo chip would come closer than `margin` to the right screen edge; then the whole
 * row moves left so the chip fits without covering the plate.
 */
export function wobbleCentreX(
  screenWidth: number,
  plateWidth: number,
  chipWidth: number,
  gap: number,
  margin: number,
): number {
  const centre = screenWidth / 2;
  const chipRight = centre + plateWidth / 2 + gap + chipWidth;
  return centre - Math.max(0, chipRight - (screenWidth - margin));
}
