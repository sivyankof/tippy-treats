import * as Phaser from 'phaser';
import { collectionCount } from '../../core/collection';
import { CREATURE_IDS } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { formatNumber, t } from '../../i18n';
import { gameState } from '../../state';
import { pickInt, pickRange } from '../../util/math';
import { openScreen, SCENES, type CreatureDetailData } from '../scene-keys';
import { createOutlinedText } from '../ui/outlined-text';
import { enterScreen, leaveScreen } from '../ui/transition';
import { collectionGrid } from '../ui/menu/collection-grid';
import { CollectionTile } from '../ui/menu/collection-tile';
import { MenuBackground } from '../ui/menu/menu-background';
import { ScreenHeader } from '../ui/menu/screen-header';

const cfg = MENU.collection;

/** Every creature of the game as a card: the owned ones alive, the locked ones as silhouettes. */
export class CollectionScene extends Phaser.Scene {
  private background!: MenuBackground;
  private header!: ScreenHeader;
  private count!: Phaser.GameObjects.Text;
  private tiles: CollectionTile[] = [];
  private pokeInMs = 0;
  private leaving = false;

  constructor() {
    super(SCENES.collection);
  }

  create(): void {
    this.leaving = false;
    const { creatures, bakerLevel } = gameState.data;
    this.background = new MenuBackground(this);
    this.header = new ScreenHeader(this, t('collection.title'), () => this.leave(SCENES.home));
    const { owned, total } = collectionCount(creatures);
    this.count = createOutlinedText(
      this,
      0,
      cfg.countY,
      t('collection.count', { owned: formatNumber(owned), total: formatNumber(total) }),
      cfg.countFont,
      PALETTE.gold,
    );
    this.tiles = CREATURE_IDS.map(
      (id) =>
        new CollectionTile(
          this,
          0,
          0,
          { id, level: creatures[id]?.level ?? null, bakerLevel },
          (tile) =>
            this.leave(SCENES.creatureDetail, { id: tile.card.id, back: SCENES.collection }),
        ),
    );
    this.pokeInMs = pickRange(cfg.pokeEveryMs);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    this.tiles.forEach((tile) => tile.setEnabled(false));
    this.header.setBackEnabled(false);
    enterScreen(this, this.content(), () => {
      this.tiles.forEach((tile) => tile.setEnabled(true));
      this.header.setBackEnabled(true);
    });
  }

  override update(time: number, delta: number): void {
    this.background.update(delta);
    this.header.update(time, delta);
    for (const tile of this.tiles) tile.tick(delta);
    this.pokeInMs -= delta;
    if (this.pokeInMs <= 0) {
      this.pokeInMs = pickRange(cfg.pokeEveryMs);
      this.pokeRandom();
    }
  }

  /** What slides in and out with the screen: header, counter, then the cards one by one. */
  private content() {
    return [...this.header.parts, this.count, ...this.tiles];
  }

  /** One random owned creature hops and squeaks. */
  private pokeRandom(): void {
    const alive = this.tiles.filter((tile) => tile.portrait !== null);
    if (this.leaving || alive.length === 0) return;
    alive[pickInt([0, alive.length - 1])]?.portrait?.poke();
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.background.resize(width, height);
    this.header.layout(width);
    this.count.setPosition(width / 2, cfg.countY);
    const grid = collectionGrid(width, height, this.tiles.length);
    this.tiles.forEach((tile, i) => {
      const cell = grid.cells[i];
      if (cell) tile.setBaseScale(grid.scale).setPosition(cell.x, cell.y);
    });
  }

  private leave(key: typeof SCENES.home): void;
  private leave(key: typeof SCENES.creatureDetail, data: CreatureDetailData): void;
  private leave(
    key: typeof SCENES.home | typeof SCENES.creatureDetail,
    data?: CreatureDetailData,
  ): void {
    if (this.leaving) return;
    this.leaving = true;
    this.header.setBackEnabled(false);
    this.tiles.forEach((tile) => tile.setEnabled(false));
    leaveScreen(this, this.content(), () => openScreen(this, key, data));
  }
}
