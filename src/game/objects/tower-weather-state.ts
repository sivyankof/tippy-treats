/**
 * What the weather of the run tells the layers of the tower, written by `RunWeather` every frame and
 * read by the layer views (a view of a pool has no way to ask the backdrop): how much of the snow shows
 * on the tower (the Roof and the Clouds in snow; it follows the zone cross-fade) and whether the night
 * has made the layers sleepy (the zones that show the weather).
 */
export const towerWeather = {
  /** Share of the snow on the tower that shows, 0..1 (0 in any other weather). */
  snow: 0,
  /** The layers are sleepy: night weather in a zone that shows weather. */
  sleepy: false,
};
