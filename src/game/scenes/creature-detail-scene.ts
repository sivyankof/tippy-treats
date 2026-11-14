import * as Phaser from 'phaser';
import { abilityChanges, abilityValues } from '../../core/ability-values';
import type { Currency } from '../../core/economy';
import { addToTeam } from '../../core/team';
import { CREATURES, MAX_CREATURE_LEVEL, type CreatureId } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { RARITY_COLORS } from '../../data/rarity';
import { LOGICAL_SIZE } from '../../data/screen';
import { formatDecimal, t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { Particles } from '../fx/particles';
import { starBurst } from '../fx/sparkle-fx';
import { CreaturePortrait } from '../objects/creature-portrait';
import { demoRun } from '../run-request';
import { openScreen, SCENES, startRunFrom, type CreatureDetailData } from '../scene-keys';
import { createOutlinedText, createStrokedText } from '../ui/outlined-text';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';
import { DetailActions } from '../ui/menu/detail-actions';
import { changeText, formatValues } from '../ui/menu/detail-model';
import { fitText } from '../ui/menu/fit-text';
import { MenuBackground } from '../ui/menu/menu-background';
import { ScreenHeader } from '../ui/menu/screen-header';
import { LevelStars } from '../ui/menu/stars';

const cfg = MENU.detail;

/** The card of one creature: live portrait, ability, upgrade or buy, a demo run and the team. */
export class CreatureDetailScene extends Phaser.Scene {
  private request!: CreatureDetailData;
  private level: number | null = null;
  private leaving = false;
  private bg!: MenuBackground;
  private header!: ScreenHeader;
  private name!: Phaser.GameObjects.Text;
  private rarity!: Phaser.GameObjects.Text;
  private trait!: Phaser.GameObjects.Text;
  private stage!: Phaser.GameObjects.Container;
  private portrait!: CreaturePortrait;
  private stars: LevelStars | null = null;
  private ability!: Phaser.GameObjects.Text;
  private next: Phaser.GameObjects.Text | null = null;
  private actions!: DetailActions;
  private particles!: Particles;

  constructor() {
    super(SCENES.creatureDetail);
  }

  create(request: CreatureDetailData): void {
    this.request = request;
    this.leaving = false;
    this.level = gameState.data.creatures[request.id]?.level ?? null;
    const def = CREATURES[request.id];
    this.bg = new MenuBackground(this);
    this.header = new ScreenHeader(this, '', () => this.goBack());
    this.particles = new Particles(this);
    this.name = fitText(
      createOutlinedText(this, 0, 0, t(def.nameKey), cfg.nameFont),
      cfg.abilityWrap,
    );
    this.rarity = createOutlinedText(
      this,
      0,
      0,
      t(`rarity.${def.rarity}`),
      cfg.rarityFont,
      RARITY_COLORS[def.rarity],
    );
    this.trait = fitText(this.bodyText(t(def.traitKey), cfg.traitFont, false), cfg.abilityWrap);
    this.build();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.particles.clear();
    });
    this.layout();
    enterScreen(this, this.content());
  }

  override update(_time: number, delta: number): void {
    this.bg.update(delta);
    this.header.update(this.time.now, delta);
    this.portrait.tick(delta);
    this.particles.update(delta);
  }

  /** A centred text in the body style; only the ability text wraps, the trait stays on one line. */
  private bodyText(text: string, font: number, wrap: boolean): Phaser.GameObjects.Text {
    const line = createStrokedText(
      this,
      0,
      0,
      text,
      font,
      PALETTE.textDark,
      PALETTE.panel,
      cfg.bodyStroke,
    ).setAlign('center');
    return wrap ? line.setWordWrapWidth(cfg.abilityWrap) : line;
  }

  /** Everything that depends on the owned level: rebuilt after an upgrade. */
  private build(): void {
    const { id } = this.request;
    const level = this.level;
    const { bakerLevel, team } = gameState.data;
    this.stage = this.add.container(0, 0);
    this.portrait = new CreaturePortrait(this, 0, 0, id, level ?? 1, cfg.portraitWidth);
    if (level === null) this.portrait.setAlpha(cfg.lockedAlpha);
    const hit = new Phaser.Geom.Rectangle(
      0,
      0,
      cfg.portraitWidth,
      cfg.portraitWidth * cfg.portraitHit,
    );
    this.portrait
      .setSize(hit.width, hit.height)
      .setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    this.portrait.on(Phaser.Input.Events.POINTER_DOWN, () => this.portrait.poke());
    this.stage.add(this.portrait);
    this.stars = level === null ? null : new LevelStars(this, 0, 0, level, cfg.starsScale);

    this.ability = this.bodyText(
      t(CREATURES[id].descKey, formatValues(abilityValues(id, level ?? 1), formatDecimal)),
      cfg.abilityFont,
      true,
    ).setOrigin(0.5, 0);
    this.next = level !== null && level < MAX_CREATURE_LEVEL ? this.nextLine(id, level) : null;

    this.actions = new DetailActions(
      this,
      {
        id,
        level,
        bakerLevel,
        coins: gameState.coins,
        berries: gameState.berries,
        inTeam: team.includes(id),
        teamFull: addToTeam(team, id, bakerLevel) === team,
      },
      {
        upgrade: () => this.upgrade(),
        buy: (currency) => this.buy(currency),
        tryIt: () => this.tryIt(),
        toTeam: () => this.toTeam(),
      },
    );
  }

  /** The green line with what the next level changes. */
  private nextLine(id: CreatureId, level: number): Phaser.GameObjects.Text {
    const change = changeText(abilityChanges(id, level, level + 1), formatDecimal);
    const text = change
      ? t('detail.nextLevel', { n: level + 1, change })
      : t('detail.noChange', { n: level + 1 });
    return createOutlinedText(this, 0, 0, text, cfg.abilityFont, PALETTE.success)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(cfg.abilityWrap)
      .setAlign('center');
  }

  private destroyLevelParts(): void {
    for (const part of [this.stage, this.stars, this.ability, this.next, ...this.actions.parts]) {
      part?.destroy();
    }
  }

  private content(): Movable[] {
    return [
      ...this.header.parts,
      this.stage,
      ...(this.stars ? [this.stars] : []),
      this.name,
      this.rarity,
      this.trait,
      this.ability,
      ...(this.next ? [this.next] : []),
      ...this.actions.parts,
    ];
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    const shift = Math.max(0, height - LOGICAL_SIZE.minHeight) * cfg.extraShare;
    this.cameras.main.setSize(width, height);
    this.bg.resize(width, height);
    this.header.layout(width);
    this.stage.setPosition(cx, cfg.portraitY + shift);
    this.stars?.setPosition(cx, cfg.starsY + shift);
    this.name.setPosition(cx, cfg.nameY + shift);
    this.rarity.setPosition(cx, cfg.rarityY + shift);
    this.trait.setPosition(cx, cfg.traitY + shift);
    this.ability.setPosition(cx, cfg.abilityY + shift);
    this.next?.setPosition(cx, cfg.abilityY + shift + this.ability.height + cfg.nextGap);
    this.actions.layout(width, height);
  }

  /** Stops taps on the buttons while the screen leaves, then runs `go`. */
  private leave(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.actions.setEnabled(false);
    this.header.setBackEnabled(false);
    leaveScreen(this, this.content(), go);
  }

  private goBack(): void {
    this.leave(() => openScreen(this, this.request.back));
  }

  private tryIt(): void {
    const { id, back } = this.request;
    this.leave(() => startRunFrom(this, demoRun(id, this.level ?? 1, back)));
  }

  private toTeam(): void {
    const { bakerLevel, team } = gameState.data;
    gameState.setTeam(addToTeam(team, this.request.id, bakerLevel));
    this.refresh();
  }

  private upgrade(): void {
    const result = gameState.upgradeCreature(this.request.id);
    if (!result.ok) return;
    this.level = result.value;
    this.refresh();
    starBurst(this.particles, this.stage.x, this.stage.y, cfg.burst.count, 0, cfg.burst.style);
    this.portrait.poke();
    if (this.stars) {
      this.tweens.add({
        targets: this.stars,
        scale: { from: cfg.starsPop, to: 1 },
        duration: cfg.popMs,
        ease: 'Back.easeOut',
      });
    }
    services.audio.perfect(1);
    services.haptics.play('success');
  }

  private buy(currency: Currency): void {
    const { id, back } = this.request;
    if (!gameState.buyCreature(id, currency).ok) return;
    services.audio.coin();
    services.haptics.play('success');
    this.leave(() =>
      openScreen(this, SCENES.newCreature, {
        creatures: [id],
        then: { kind: 'screen', key: SCENES.creatureDetail, data: { id, back } },
      }),
    );
  }

  /** Rebuilds the parts that depend on the save, without the entry cascade. */
  private refresh(): void {
    this.destroyLevelParts();
    this.build();
    this.layout();
  }
}
