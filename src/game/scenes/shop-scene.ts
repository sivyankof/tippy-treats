import * as Phaser from 'phaser';
import type { Currency } from '../../core/economy/economy';
import { starterPackContents } from '../../core/economy/shop';
import type { CreatureId } from '../../data/creatures/creatures';
import { BERRY_PACKS } from '../../data/economy/economy';
import { MENU } from '../../data/common/menu-layout';
import { PRODUCTS, SHOP, type ProductKey } from '../../data/economy/shop';
import { t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { logShopOpen, type ShopSource } from '../economy/economy-telemetry';
import {
  buyOutcomeKey,
  buyProduct,
  loadPrices,
  takeLaunchRestored,
  restorePurchases,
  type Prices,
} from '../economy/purchases';
import { showRewarded } from '../economy/rewarded';
import { openScreen, SCENES } from '../app/scene-keys';
import type { DailySection } from '../ui/menu/daily/daily-section';
import { flyReward, type WalletTargets } from '../ui/menu/widgets/reward-flight';
import { ScreenHeader } from '../ui/menu/widgets/screen-header';
import {
  berriesSection,
  creaturesSection,
  exchangeSection,
  freeSection,
  noAdsSection,
  restoreBlock,
  type ShopActions,
} from '../ui/menu/shop/shop-blocks';
import { ShopStarter } from '../ui/menu/shop/shop-starter';
import { Toast } from '../ui/menu/shop/shop-toast';
import { BottomCover } from '../ui/style/bottom-cover';
import { MenuScenery } from '../ui/style/menu-scenery';
import { ScrollList } from '../ui/style/scroll-list';
import { safeFrame } from '../ui/common/safe-frame';
import { enterScreen, leaveScreen } from '../ui/common/transition';

const cfg = MENU.shop;

/** The shop: the starter pack, creatures for coins, free coins, berries, the exchange, no ads (docs/07-ui-screens.md, section 9). */
export class ShopScene extends Phaser.Scene {
  private bg!: MenuScenery;
  private header!: ScreenHeader;
  private list!: ScrollList;
  private cover!: BottomCover;
  private toast!: Toast;
  private blocks: DailySection[] = [];
  private starter: ShopStarter | null = null;
  private prices: Prices = {};
  private loaded = false;
  private adReady = false;
  private busy = false;
  private leaving = false;
  private source: ShopSource = 'return';

  constructor() {
    super(SCENES.shop);
  }

  /** `source`: the place that opened the shop; a return from the new creature screen counts as `return`. */
  init(data?: { source?: ShopSource }): void {
    this.source = data?.source ?? 'return';
  }

  create(): void {
    logShopOpen(this.source);
    this.leaving = false;
    this.busy = false;
    this.loaded = false;
    this.blocks = [];
    this.starter = null;
    this.prices = {};
    gameState.refreshDay();
    this.bg = new MenuScenery(this, 'list');
    this.list = new ScrollList(this);
    this.header = new ScreenHeader(this, t('shop.title'), () => this.leave(() => this.toHome()), {
      band: true,
    });
    this.cover = new BottomCover(this);
    this.toast = new Toast(this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    enterScreen(this, [...this.header.parts, this.list.root]);
    void loadPrices().then((prices) => {
      if (!this.scene.isActive()) return;
      this.prices = prices;
      this.loaded = true;
      this.rebuild();
    });
  }

  override update(time: number, delta: number): void {
    this.bg.update(delta);
    this.header.update(time, delta);
    this.list.tick(delta);
    this.starter?.tick(delta);
    if (!this.loaded || this.busy || this.leaving) return;
    // The launch check may end later (on another screen, or during an ad here): the starter pack
    // then leaves the list because the account owns it, and the player is told why, once.
    if (takeLaunchRestored().length > 0) this.toast.show(t('shop.restoreResult.restored'));
    const ready = services.ads.isRewardedReady();
    const offered = gameState.starterPackInShop;
    if (ready !== this.adReady || offered !== (this.starter !== null)) this.rebuild();
    this.starter?.refreshTimer();
  }

  /** What the buttons do. Taps that were drags are dropped by the list. */
  private readonly actions: ShopActions = {
    buyCreature: (id) => this.guarded(() => this.buyCreature(id)),
    watchAd: () => this.guarded(() => void this.watchAd()),
    exchange: (berries) => this.guarded(() => this.exchange(berries)),
    buy: (key) => this.guarded(() => void this.buy(key)),
    restore: () => this.guarded(() => void this.restore()),
    refuse: (currency) => this.guarded(() => this.header.refuse(currency)),
  };

  private guarded(act: () => void): void {
    this.list.guard(() => {
      if (!this.busy && !this.leaving) act();
    })();
  }

  /** (Re)builds the blocks from the save, keeping the place the list is scrolled to. */
  private rebuild(): void {
    for (const block of this.blocks) block.root.destroy();
    this.adReady = services.ads.isRewardedReady();
    this.starter = gameState.starterPackInShop
      ? new ShopStarter(this, this.prices.starter_pack ?? null, () =>
          this.actions.buy('starter_pack'),
        )
      : null;
    const a = this.actions;
    this.blocks = [
      this.starter,
      creaturesSection(this, a),
      freeSection(this, a, this.adReady),
      berriesSection(this, a, this.prices),
      exchangeSection(this, a),
      noAdsSection(this, a, this.prices),
      restoreBlock(this, a),
    ].filter((block): block is DailySection => block !== null);
    let y = cfg.top;
    for (const block of this.blocks) {
      block.root.setPosition(0, y);
      this.list.content.add(block.root);
      y += block.height + cfg.gap;
    }
    this.list.setContentHeight(y - cfg.gap);
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.bg.resize(width, height);
    const frame = safeFrame(height);
    this.header.layout(width, frame.top);
    this.list.layout(width, frame.bottom, frame.top + MENU.header.contentTop);
    this.cover.layout(width, height, frame.bottom);
    this.toast.layout(width, frame.top);
  }

  /** Where a reward flies from: the finger that tapped. */
  private tapPoint(): { x: number; y: number } {
    const { x, y } = this.input.activePointer;
    return { x, y };
  }

  private fly(currency: Currency, amount: number, from: { x: number; y: number }): void {
    const wallet: WalletTargets = this.header.wallet;
    flyReward(this, { currency, amount, from, wallet });
  }

  private buyCreature(id: CreatureId): void {
    if (!gameState.buyCreature(id, 'coins').ok) return;
    services.audio.coin();
    services.haptics.play('success');
    this.leave(() =>
      openScreen(this, SCENES.newCreature, {
        creatures: [id],
        then: { kind: 'screen', key: SCENES.shop },
      }),
    );
  }

  private async watchAd(): Promise<void> {
    const from = this.tapPoint();
    this.busy = true;
    const result = await showRewarded('shop_coins');
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (result === 'rewarded') {
      if (gameState.claimFreeCoins()) this.fly('coins', SHOP.freeCoins.amount, from);
    }
    this.rebuild();
  }

  private exchange(berries: number): void {
    const from = this.tapPoint();
    const pack = BERRY_PACKS.find((entry) => entry.berries === berries);
    if (!pack || !gameState.exchangeBerries(berries)) return;
    services.haptics.play('success');
    this.fly('coins', pack.coins, from);
    this.rebuild();
  }

  private async buy(key: ProductKey): Promise<void> {
    const from = this.tapPoint();
    const newCreature =
      key === 'starter_pack' ? starterPackContents(gameState.data.creatures).creature : null;
    this.busy = true;
    const outcome = await buyProduct(key);
    this.busy = false;
    if (!this.scene.isActive()) return;
    const message = buyOutcomeKey(outcome);
    if (message !== null) this.toast.show(t(message));
    if (outcome !== 'purchased') return;
    services.haptics.play('success');
    const { berries = 0 } = PRODUCTS[key].grant;
    if (newCreature !== null) {
      this.leave(() =>
        openScreen(this, SCENES.newCreature, {
          creatures: [newCreature],
          then: { kind: 'screen', key: SCENES.shop },
        }),
      );
      return;
    }
    if (key.startsWith('berries_')) this.fly('berries', berries, from);
    this.rebuild();
  }

  private async restore(): Promise<void> {
    this.busy = true;
    const outcome = await restorePurchases();
    this.busy = false;
    if (!this.scene.isActive()) return;
    this.toast.show(t(`shop.restoreResult.${outcome}`));
    this.rebuild();
  }

  private toHome(): void {
    openScreen(this, SCENES.home);
  }

  /** Stops taps while the screen leaves, then runs `go`. */
  private leave(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.list.setEnabled(false);
    this.header.setBackEnabled(false);
    leaveScreen(this, [...this.header.parts, this.list.root], go);
  }
}
