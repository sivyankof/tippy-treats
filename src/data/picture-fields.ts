/**
 * Room (px, on every side) added around the drawing of a picture whose outline or tips ran past
 * the field the picture was first baked at (found by the clip guard, docs/06 section 1, "Поле
 * картинки"). The drawing keeps its coordinates; where a picture has a pivot or a spot it is
 * placed by, it follows through `paddedOrigin` (`util/field-pad.ts`).
 */
export const FIELD_PAD = {
  kitchenLadle: 4,
  kitchenLid: 4,
  kitchenPendulum: 8,
  showcaseStand: 4,
  windowDrop: 3,
} as const;
