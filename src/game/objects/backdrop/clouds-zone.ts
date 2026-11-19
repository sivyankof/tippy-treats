import type * as Phaser from 'phaser';
import { BD_TEX } from '../../../data/backdrop/backdrop';
import { MOUNTAIN_SLOT } from '../../../data/backdrop/backdrop-mountains';
import { BACKDROP_COLORS } from '../../../data/backdrop/backdrop-colors';
import { BACKDROP_LIFE } from '../../../data/backdrop/backdrop-life';
import { bakeTexture } from '../../ui/bake-texture';
import { cloudShape, tiled } from './art-kit';
import { inSky } from './layer-anchor';
import { Traveler } from './life';
import { bakeMountains, Mountains } from './mountains';
import type { WeatherId } from '../../../data/weather/weather';
import { WEATHER_LOOK } from '../../../data/weather/weather-look';
import { bakeWeatherSky } from './weather-art';
import { mountainTintOf } from './weather-palette';
import { weatherSkyLives } from './weather-sky';
import type { ZoneArt } from './zone-scenery';

const TILE = 512;
const CL = BD_TEX.clouds;
const C = BACKDROP_COLORS.clouds;
const WHITE = BACKDROP_COLORS.shared.white;
/** Half the width of a cloud picture at scale 1: how far it can reach over a tile edge. */
const CLOUD_REACH = 90;

interface CloudSpot {
  x: number;
  y: number;
  scale: number;
}

function bakeClouds(scene: Phaser.Scene, key: string, color: number, spots: CloudSpot[]): void {
  bakeTexture(scene, key, TILE, TILE, (g) => {
    for (const { x, y, scale } of spots) {
      tiled(TILE, x, y, CLOUD_REACH * scale + 40, (px, py) =>
        cloudShape(g, px, py, scale, color, 1),
      );
    }
  });
}

/** Rain and storm: the clouds are grey-blue, not the pink of the evening. */
const GREY = WEATHER_LOOK.cloudsGrey;
const isGrey = (weather: WeatherId): boolean => weather === 'rain' || weather === 'storm';
const layerKey = (key: string, weather: WeatherId): string =>
  isGrey(weather) ? `${key}_grey` : key;

function bakeLayers(scene: Phaser.Scene, weather: WeatherId): void {
  const grey = isGrey(weather);
  bakeClouds(scene, layerKey(CL.far, weather), grey ? GREY.far : C.far, [
    { x: 60, y: 60, scale: 0.5 },
    { x: 250, y: 140, scale: 0.55 },
    { x: 440, y: 40, scale: 0.45 },
    { x: 130, y: 260, scale: 0.5 },
    { x: 350, y: 330, scale: 0.55 },
    { x: 470, y: 440, scale: 0.5 },
    { x: 90, y: 440, scale: 0.45 },
  ]);
  bakeClouds(scene, layerKey(CL.mid, weather), grey ? GREY.mid : C.mid, [
    { x: 100, y: 110, scale: 0.85 },
    { x: 380, y: 270, scale: 0.8 },
    { x: 150, y: 400, scale: 0.9 },
    { x: 420, y: 470, scale: 0.7 },
  ]);
  bakeClouds(scene, layerKey(CL.near, weather), grey ? GREY.near : C.near, [
    { x: 330, y: 90, scale: 1.2 },
    { x: 70, y: 300, scale: 1.1 },
    { x: 400, y: 410, scale: 1.25 },
  ]);
  bakeTexture(scene, layerKey(CL.haze, weather), TILE, TILE, (g) => {
    g.fillStyle(grey ? GREY.haze : C.haze, 0.45);
    for (const { x, y, w } of [
      { x: 120, y: 70, w: 300 },
      { x: 380, y: 230, w: 360 },
      { x: 150, y: 390, w: 280 },
    ]) {
      tiled(TILE, x, y, w / 2, (px, py) => g.fillEllipse(px, py, w, 26));
    }
  });
}

function bakeLife(scene: Phaser.Scene): void {
  bakeTexture(scene, CL.balloon, 130, 190, (g) => {
    g.fillStyle(C.rope, 1);
    g.lineStyle(3, C.rope, 1);
    g.lineBetween(52, 138, 52, 158);
    g.lineBetween(78, 138, 78, 158);
    g.fillStyle(C.balloonA, 1);
    g.fillEllipse(65, 68, 118, 130);
    g.fillStyle(C.balloonB, 1);
    g.fillEllipse(65, 68, 62, 130);
    g.fillStyle(WHITE, 0.35);
    g.fillEllipse(40, 44, 14, 36);
    g.fillStyle(C.balloonA, 1);
    g.fillRoundedRect(48, 126, 34, 16, 5);
    g.fillStyle(C.basket, 1);
    g.fillRoundedRect(46, 156, 38, 26, 6);
  });
  bakeTexture(scene, CL.plane, 120, 50, (g) => {
    g.fillStyle(C.planeWing, 1);
    g.fillTriangle(10, 6, 30, 26, 6, 26);
    g.fillStyle(C.planeBody, 1);
    g.fillEllipse(60, 26, 92, 24);
    g.fillStyle(C.planeWing, 1);
    g.fillEllipse(58, 34, 54, 8);
    g.fillStyle(C.planeWindow, 1);
    for (const x of [48, 62, 76]) g.fillCircle(x, 24, 3.5);
    g.fillStyle(WHITE, 0.4);
    g.fillEllipse(110, 26, 6, 30);
  });
}

/** Clouds at sunset: three layers of drifting clouds, a hot-air balloon and a little plane. */
export const cloudsArt: ZoneArt = {
  bake(scene, look) {
    bakeWeatherSky(scene, 'clouds', look.weather);
    bakeLayers(scene, look.weather);
    bakeLife(scene);
    bakeMountains(scene);
  },
  build(scene, look) {
    const life = BACKDROP_LIFE.clouds;
    return {
      layers: [CL.far, CL.mid, CL.near, CL.haze].map((key) => layerKey(key, look.weather)),
      weatherSky: weatherSkyLives(scene, 'clouds', look.weather),
      lives: [
        { slot: MOUNTAIN_SLOT.clouds, life: new Mountains(scene, mountainTintOf(look.weather)) },
        { slot: 1, life: new Traveler(scene, life.balloon, inSky('traveler')) },
        { slot: 2, life: new Traveler(scene, life.plane, inSky('traveler')) },
      ],
    };
  },
};
