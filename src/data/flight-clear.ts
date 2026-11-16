/**
 * The background travellers of Space (satellite, comet, rare guests) keep out of the line of the
 * incoming layer (docs/06, section 5): the stripe reaches this many layer heights above and below
 * the layer's centre.
 */
export const FLIGHT_CLEAR = {
  aroundLayers: 1,
} as const;
