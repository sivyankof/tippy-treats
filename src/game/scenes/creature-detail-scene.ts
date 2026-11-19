import * as Phaser from 'phaser';
import type { Currency } from '../../core/economy/economy';
import { addToTeam } from '../../core/creatures/team';
import { CREATURES } from '../../data/creatures/creatures';
import { MENU } from '../../data/common/menu-layout';
import { TRANSFORM } from '../../data/creatures/transform-scene';
import { RARITY_COLORS } from '../../data/creatures/rarity';
import { t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { Particles } from '../fx/common/particles';
import { starBurst } from '../fx/common/sparkle-fx';
import { demoRun } from '../run-request';
import { openScreen, SCENES, startRunFrom, type CreatureDetailData } from '../scene-keys';
import { enterScreen, leaveScreen, type Movable } from '../ui/common/transition';
import { DetailActions } from '../ui/menu/detail-actions';
import { abilityText } from '../ui/menu/detail-model';
import { DetailBio } from '../ui/menu/detail-bio';
import { detailPlan, DETAIL_PLAN_STEPS, masterBlock, upgradeRows } from '../ui/menu/detail-rows';
import { MasteryTransform } from '../ui/menu/mastery-transform';
import { transformKind, type TransformKind } from '../ui/menu/transform-plan';
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
  private bio: DetailBio | null = null;
  private bioVeil: Phaser.GameObjects.Zone | null = null;
  private transform: MasteryTransform | null = null;

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
    this.transform?.update(delta);
  }

  /**
   * Everything that depends on the owned level: rebuilt after an upgrade. On a short screen the
   * window drops its secondary parts one step at a time until it fits (`detailPlan`).
   */
  private build(): void {
    const height = this.scale.gameSize.height;
    for (let step = 0; step < DETAIL_PLAN_STEPS; step++) {
      this.buildStep(step);
      if (step === DETAIL_PLAN_STEPS - 1 || this.freeHeight(height) >= 0) return;
      this.destroyLevelParts();
    }
  }

  /** Free height between the hero plate, the text block and the buttons; negative when they overlap. */
  private freeHeight(height: number): number {
    const used = cfg.stage.height + cfg.blockGap + this.info.bodyHeight;
    return this.actions.topY(height) - cfg.blockGap - cfg.stageTop - used;
  }

  private buildStep(step: number): void {
    const { id } = this.request;
    const level = this.level;
    const { bakerLevel, team } = gameState.data;
    const plan = detailPlan(step);
    this.closeBio();
    this.stage = new DetailStage(
      this,
      id,
      level,
      RARITY_COLORS[CREATURES[id].rarity],
      cfg.stage.width,
      level === null ? null : () => this.toggleBio(),
    );
    const master = level === null ? [] : masterBlock(id, level);
    this.info = new DetailInfo(this, id, {
      abilityText: abilityText(id, level ?? 1),
      master: plan.masterPhrase ? master : master.filter((row) => row.kind !== 'phrase'),
      next: level === null ? [] : upgradeRows(id, level),
      trait: plan.trait,
    });

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
        plan,
      },
      {
        upgrade: () => this.upgrade(),
        buy: (currency) => this.buy(currency),
        tryIt: () => this.tryIt(),
        toTeam: () => this.toTeam(),
      },
    );
  }

  /** The funny description opens over the text block and closes on any tap. */
  private toggleBio(): void {
    if (this.bio) {
      this.closeBio();
      return;
    }
    const { width, height } = this.scale.gameSize;
    this.bioVeil = this.add
      .zone(0, 0, width, height)
      .setOrigin(0)
      .setInteractive()
      .setDepth(cfg.bio.depth - 1);
    this.bioVeil.on(Phaser.Input.Events.POINTER_DOWN, () => this.closeBio());
    this.bio = new DetailBio(this, this.request.id, () => this.closeBio()).setDepth(cfg.bio.depth);
    this.info.setVisible(false);
    this.layoutBio();
    this.stage.portrait.poke();
  }

  private layoutBio(): void {
    this.bio?.setPosition(this.info.x, this.info.y);
  }

  private closeBio(): void {
    if (this.bio) this.info.setVisible(true);
    this.bio?.destroy();
    this.bioVeil?.destroy();
    this.bio = null;
    this.bioVeil = null;
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
    // Too short a screen: the gap under the hero plate gives way before the text meets the buttons.
    const squeeze = Math.min(Math.max(0, -free), cfg.blockGap - cfg.minStageGap);
    this.info.setPosition(cx, stageTop + cfg.stage.height + cfg.blockGap + gap - squeeze);
    this.layoutBio();
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
    const { id } = this.request;
    const from = this.level ?? 1;
    const kind = transformKind(id, from);
    const result = gameState.upgradeCreature(id);
    if (!result.ok) return;
    this.level = result.value;
    this.refresh();
    if (kind) {
      this.playTransform(kind, from);
      return;
    }
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

  /** The scene of the new look or the master level; the window under it already shows the new level. */
  private playTransform(kind: TransformKind, from: number): void {
    const { frame, portrait } = this.stage;
    frame?.setVisible(false);
    portrait.setAlpha(0);
    this.actions.setEnabled(false);
    this.header.setBackEnabled(false);
    this.transform = new MasteryTransform(this, {
      id: this.request.id,
      kind,
      fromLevel: from,
      toLevel: from + 1,
      at: { x: this.stage.x, y: this.stage.y + cfg.stage.portraitY },
      particles: this.particles,
      onDone: () => {
        this.transform = null;
        portrait.setAlpha(1);
        this.actions.setEnabled(true);
        this.header.setBackEnabled(true);
        if (!frame) return;
        frame.setVisible(true);
        this.tweens.add({
          targets: frame,
          scale: { from: TRANSFORM.framePop.from, to: 1 },
          duration: TRANSFORM.framePop.ms,
          ease: 'Back.easeOut',
        });
      },
    });
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
