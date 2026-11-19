/** Layout of the temporary creature line-up screen (`?lineup=1`, docs/08 section 9). */
export const LINEUP = {
  level: 3,
  margin: 90,
  /** Tower on the left: centre x, widths and cut sides in turn. */
  stackX: 290,
  stackWidths: [500, 460, 480, 420, 500, 440, 470, 400, 500, 450, 480, 430],
  stackCuts: [
    null,
    'left',
    null,
    'right',
    null,
    null,
    'left',
    null,
    'right',
    null,
    null,
    'left',
  ] as ReadonlyArray<'left' | 'right' | null>,
  /** Whole layers on the right: centre x, width and distance between rows. */
  rowX: 800,
  rowWidth: 420,
  rowStep: 150,
} as const;
