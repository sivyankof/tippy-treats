import { Capacitor, registerPlugin, SystemBars } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { SplashScreen } from '@capacitor/splash-screen';
import { DEBUG_TOOLS } from '../util/build-kind';
import { showStubOverlay, WebAds } from './rewarded-video/web';
import type { AdsDevControl, AdsService } from './rewarded-video/types';
import { createBrowserAudioContext, WebAudioService } from './audio/web';
import { audioLog } from './audio/audio-log';
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
import { type DevicePlugin, NativeAppShell } from './app-shell/native';
import type { RatingService } from './rating/types';
import { WebRating } from './rating/web';
import { NativeRating } from './rating/native';
import { productIds } from './iap/product-ids';
import type { IapDevControl, IapService } from './iap/types';
import { createStubIap } from './iap/stub-iap';
import { NativeIap } from './iap/native';
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
  /** The system's rating window; a stub in the browser. */
  rating: RatingService;
}

/** Inside the iOS or Android app (Capacitor); false in any browser. */
const native = Capacitor.isNativePlatform();

/**
 * The test stubs of ads and purchases act only where the debug tools are (the dev server and the
 * internal build). The store build keeps them silent until the real SDKs come (M8): no fake ads,
 * nothing on sale (docs/09-services-analytics.md, sections 3 and 5).
 */
const TEST_STUBS = DEBUG_TOOLS;

const webAds = new WebAds(showStubOverlay, TEST_STUBS ? 'reward' : 'no_fill');

const webIap = createStubIap(productIds, TEST_STUBS);

/** The public RevenueCat key of this platform; undefined until the owner puts it into `.env`. */
const revenueCatKey =
  Capacitor.getPlatform() === 'ios'
    ? import.meta.env.VITE_REVENUECAT_API_KEY_IOS
    : import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;

/** In the app the store is RevenueCat, with or without a key (no key: "store unavailable"), never the browser stub. */
const iap: IapService = native ? new NativeIap(Purchases, revenueCatKey, productIds) : webIap;

// Before any audio context or media element: the page's audio session obeys the silent switch.
const audioSession = setupAudioSession(typeof navigator === 'undefined' ? undefined : navigator);
const musicPlaylist = playableTracks(MUSIC_PLAYLIST, audioSession.streams);
// The first track of the playlist loads while the game does (once the saved music switch says on),
// so the music starts right after the first tap.
const musicPreload = createMusicPreload(musicPlaylist, audioSession.streams, (track) =>
  trackUrl(track),
);
audioLog.add(
  `start: ${native ? 'app' : 'browser'}, session ${audioSession.ambient ? 'ambient' : 'default'}, streams ${audioSession.streams ? 'on' : 'off'}, first track ${musicPreload.track ?? 'none'}`,
);
const webAudio = new WebAudioService(
  createBrowserAudioContext,
  Math.random,
  playlistPlayerFactory({
    playlist: musicPlaylist,
    streams: audioSession.streams,
    preload: musicPreload,
    bless: !native,
  }),
  (on) => (on ? musicPreload.start() : musicPreload.release()),
  // The app needs no gesture for sound: a dead context is made again at once.
  native,
);

/**
 * The single place that picks implementations (docs/08-architecture.md, section 8). Inside the app
 * the storage, haptics and the shell are native; the sound is the same Web Audio (the app's audio
 * session is set natively, ios/App/App/AppDelegate.swift); the silent switch needs no reading
 * there, the ambient session obeys it by itself. Purchases are RevenueCat in the app; ads, analytics and sharing stay the
 * stubs until stage M8.
 */
export const services: Services = {
  audio: webAudio,
  silentMode: new WebSilentMode(),
  haptics: native ? new NativeHaptics(Haptics) : new WebHaptics(),
  ads: webAds,
  iap,
  storage: native ? new NativeStorage(Preferences) : new WebStorage(),
  share: new WebShare(),
  telemetry: new WebAnalytics(),
  appShell: native
    ? new NativeAppShell(
        App,
        SplashScreen,
        SystemBars,
        undefined,
        registerPlugin<DevicePlugin>('TippyDevice'),
      )
    : new WebAppShell(),
  rating: native
    ? new NativeRating(InAppReview)
    : new WebRating(DEBUG_TOOLS ? (line) => console.info(line) : null),
};

/** Dev switch of the ad stub (debug panel). Not part of the services: native ads have none. */
export const adsDev: AdsDevControl = webAds;

/** Dev switch of the store stub (debug panel). Null outside the development build, so the reset cannot be reached in production. */
export const iapDev: IapDevControl | null = import.meta.env.DEV ? webIap : null;

/** Dev levels of the audio (soundboard sliders). Null outside the development build. */
export const audioDev: AudioDevControl | null = DEBUG_TOOLS ? webAudio : null;
