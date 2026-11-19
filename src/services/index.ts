import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { STUB_PRICES } from '../data/economy/iap-stub';
import { PRODUCT_KEYS, PRODUCTS } from '../data/economy/shop';
import { t } from '../i18n';
import { WebAds } from './rewarded-video/web';
import type { AdsDevControl, AdsService } from './rewarded-video/types';
import { createBrowserAudioContext, WebAudioService } from './audio/web';
import { MUSIC_PLAYLIST } from '../data/audio/music';
import { playableTracks, setupAudioSession } from './audio/music/audio-session';
import { createMusicPreload } from './audio/music/music-preload';
import { playlistPlayerFactory } from './audio/music/playlist-player';
import { trackUrl } from './audio/music/tune-loader';
import type { ShareService } from './share/types';
import type { SilentModeService } from './silent-mode/types';
import { WebSilentMode } from './silent-mode/web';
import { WebShare } from './share/web';
import type { AudioDevControl, AudioService } from './audio/types';
import type { HapticsService } from './haptics/types';
import { WebHaptics } from './haptics/web';
import { NativeHaptics } from './haptics/native';
import type { AppShellService } from './app-shell/types';
import { WebAppShell } from './app-shell/web';
import { NativeAppShell } from './app-shell/native';
import { productIds } from './iap/product-ids';
import type { IapDevControl, IapService } from './iap/types';
import { WebIap, type StubProduct } from './iap/web';
import type { AnalyticsService } from './telemetry/types';
import { WebAnalytics } from './telemetry/web';
import type { StorageService } from './storage/types';
import { WebStorage } from './storage/web';
import { NativeStorage } from './storage/native';

/** Everything the game asks of the device. Scenes use these and never pick an implementation. */
export interface Services {
  audio: AudioService;
  silentMode: SilentModeService;
  haptics: HapticsService;
  ads: AdsService;
  iap: IapService;
  storage: StorageService;
  share: ShareService;
  telemetry: AnalyticsService;
  /** The iOS or Android app around the game; a stub in the browser. */
  appShell: AppShellService;
}

/** Inside the iOS or Android app (Capacitor); false in any browser. */
const native = Capacitor.isNativePlatform();

const webAds = new WebAds();

/** The products of the store stub: the ones `.env` gives an id to, at stub prices. */
const stubCatalog: StubProduct[] = PRODUCT_KEYS.flatMap((key) => {
  const id = productIds.idOf(key);
  if (id === null) return [];
  return [
    {
      id,
      priceString: STUB_PRICES[key],
      title: () => t(`shop.product.${key}`),
      consumable: PRODUCTS[key].kind === 'consumable',
    },
  ];
});

const webIap = new WebIap(stubCatalog);

// Before any audio context or media element: the page's audio session obeys the silent switch.
const audioSession = setupAudioSession(typeof navigator === 'undefined' ? undefined : navigator);
const musicPlaylist = playableTracks(MUSIC_PLAYLIST, audioSession.streams);
// The first track of the playlist loads while the game does (once the saved music switch says on),
// so the music starts right after the first tap.
const musicPreload = createMusicPreload(musicPlaylist, audioSession.streams, (track) =>
  trackUrl(track),
);
const webAudio = new WebAudioService(
  createBrowserAudioContext,
  Math.random,
  playlistPlayerFactory({
    playlist: musicPlaylist,
    streams: audioSession.streams,
    preload: musicPreload,
  }),
  (on) => (on ? musicPreload.start() : musicPreload.release()),
);

/**
 * The single place that picks implementations (docs/08-architecture.md, section 8). Inside the app
 * the storage, haptics and the shell are native; the sound is the same Web Audio (the app's audio
 * session is set natively, ios/App/App/AppDelegate.swift); the silent switch needs no reading
 * there, the ambient session obeys it by itself. Ads, purchases, analytics and sharing stay the
 * stubs until stage M8.
 */
export const services: Services = {
  audio: webAudio,
  silentMode: new WebSilentMode(),
  haptics: native ? new NativeHaptics(Haptics) : new WebHaptics(),
  ads: webAds,
  iap: webIap,
  storage: native ? new NativeStorage(Preferences) : new WebStorage(),
  share: new WebShare(),
  telemetry: new WebAnalytics(),
  appShell: native ? new NativeAppShell(App, SplashScreen) : new WebAppShell(),
};

/** Dev switch of the ad stub (debug panel). Not part of the services: native ads have none. */
export const adsDev: AdsDevControl = webAds;

/** Dev switch of the store stub (debug panel). Null outside the development build, so the reset cannot be reached in production. */
export const iapDev: IapDevControl | null = import.meta.env.DEV ? webIap : null;

/** Dev levels of the audio (soundboard sliders). Null outside the development build. */
export const audioDev: AudioDevControl | null = import.meta.env.DEV ? webAudio : null;
