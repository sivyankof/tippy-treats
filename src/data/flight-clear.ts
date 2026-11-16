/**
 * The background travellers of Space (satellite, comet, rare guests) keep out of the line of the
 * incoming layer (docs/06, section 5): the stripe reaches this many layer heights above and below
 * the layer's centre.
 */
export const FLIGHT_CLEAR = {
  aroundLayers: 1,
  /**
   * The satellite and the comet also keep off the top of the tower: their stripe reaches down to
   * this far below the tower top (a traveller resting on the top layer looked like it sat on it).
   */
  travellerBelowTopPx: 90,
} as const;
