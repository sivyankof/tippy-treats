/**
 * Centres (x) of `count` buttons `buttonWidth` wide, `gap` apart, in one row whose last button ends
 * at `right` (the language row and the site links of the settings window).
 */
export function rowCentres(
  right: number,
  buttonWidth: number,
  count: number,
  gap: number,
): number[] {
  const rowWidth = buttonWidth * count + gap * (count - 1);
  const left = right - rowWidth;
  return Array.from({ length: count }, (_, i) => left + buttonWidth / 2 + i * (buttonWidth + gap));
}
