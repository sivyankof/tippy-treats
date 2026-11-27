import type * as Phaser from 'phaser';
import { TROPHY_ART } from '../../../data/games/trophy-art';
import { bakeParts } from '../journal/journal-textures';

export const TROPHY_KEY = 'games_trophy';

/** The trophy of the game services (lazy: drawn once). */
export function bakeTrophy(scene: Phaser.Scene): void {
  bakeParts(scene, TROPHY_KEY, TROPHY_ART.size, TROPHY_ART.parts);
}
