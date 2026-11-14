import * as Phaser from 'phaser';
import { abilityChanges, abilityValues } from '../../core/ability-values';
import type { Currency } from '../../core/economy';
import { addToTeam } from '../../core/team';
import { CREATURES, MAX_CREATURE_LEVEL, type CreatureId } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { RARITY_COLORS } from '../../data/rarity';
import { formatDecimal, t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { Particles } from '../fx/particles';
import { starBurst } from '../fx/sparkle-fx';
import { demoRun } from '../run-request';
import { openScreen, SCENES, startRunFrom, type CreatureDetailData } from '../scene-keys';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';
import { DetailActions } from '../ui/menu/detail-actions';
import { changeText, formatValues } from '../ui/menu/detail-model';
import { DetailInfo } from '../ui/menu/detail-info';
import { DetailStage } from '../ui/menu/detail-stage';
import { TitleRibbon } from '../ui/style/title-ribbon';
import { MenuScenery } from '../ui/style/menu-scenery';
import { ScreenHeader } from '../ui/menu/screen-header';

const cfg = MENU.detail;

/** The card of one creature: live portrait, ability, upgrade or buy, a demo run and the team. */
export class CreatureDetailScene extends Phaser.Scene {
  private request!: CreatureDetailData;
  private level: number | null = null;
  private leaving = false;
  private bg!: MenuScenery;
  private header!: ScreenHeader;
  private name!: TitleRibbon;
  private stage!: DetailStage;
  private info!: DetailInfo;
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
    this.bg = new MenuScenery(this, 'list');
    this.header = new ScreenHeader(this, '', () => this.goBack());
    this.particles = new Particles(this);
    this.name = new TitleRibbon(this, 0, 0, t(def.nameKey)).setDepth(cfg.ribbonDepth);
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
    this.stage.portrait.tick(delta);
    this.particles.update(delta);
  }

  /** Everything that depends on the owned level: rebuilt after an upgrade. */
  private build(): void {
    const { id } = this.request;
    const level = this.level;
    const { bakerLevel, team } = gameState.data;
    this.stage = new DetailStage(
      this,
      id,
      level,
      RARITY_COLORS[CREATURES[id].rarity],
      cfg.stage.width,
    );
    this.info = new DetailInfo(
      this,
      id,
      t(CREATURES[id].descKey, formatValues(abilityValues(id, level ?? 1), formatDecimal)),
      level !== null && level < MAX_CREATURE_LEVEL ? this.nextText(id, level) : null,
    );

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

  /** What the next level changes, for the green line. */
  private nextText(id: CreatureId, level: number): string {
    const change = changeText(abilityChanges(id, level, level + 1), formatDecimal);
    return change
      ? t('detail.nextLevel', { n: level + 1, change })
      : t('detail.noChange', { n: level + 1 });
  }

  private destroyLevelParts(): void {
    for (const part of [this.stage, this.info, ...this.actions.parts]) part.destroy();
  }

  private content(): Movable[] {
    return [...this.header.parts, this.name, this.stage, this.info, ...this.actions.parts];
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    this.cameras.main.setSize(width, height);
    this.bg.resize(width, height);
    this.header.layout(width);
    this.actions.layout(width, height);
    // The free height between the header and the buttons is shared by the gaps around the blocks.
    const used = cfg.stage.height + cfg.blockGap + this.info.bodyHeight;
    const free = this.actions.topY(height) - cfg.blockGap - cfg.stageTop - used;
    const gap = Math.max(0, free) / cfg.spreadGaps;
    const stageTop = cfg.stageTop + gap;
    this.name.setPosition(cx, cfg.ribbonY + gap);
    this.stage.setPosition(cx, stageTop + cfg.stage.height / 2);
    this.info.setPosition(cx, stageTop + cfg.stage.height + cfg.blockGap + gap);
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
    const { portrait, stars } = this.stage;
    starBurst(
      this.particles,
      this.stage.x,
      this.stage.y + cfg.stage.portraitY,
      cfg.burst.count,
      0,
      cfg.burst.style,
    );
    portrait.poke();
    if (stars) {
      this.tweens.add({
        targets: stars,
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
