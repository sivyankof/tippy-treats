import { Capacitor, registerPlugin, SystemBars } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { SplashScreen } from '@capacitor/splash-screen';
import { DEBUG_TOOLS } from '../util/build-kind';
import { AdMob } from '@capacitor-community/admob';
import { showStubOverlay, WebAds } from './rewarded-video/web';
import { NativeAds } from './rewarded-video/native';
import { pickAdUnits } from './rewarded-video/ad-units';
import { createAdMobAdsPlugin } from './rewarded-video/plugin';
import type { ConsentService } from './consent/types';
import { WebConsent } from './consent/web';
import { NativeConsent } from './consent/native';
import { readDebugParams } from '../util/debug-params';
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
import { NativeAnalytics, type AnalyticsPlugin } from './telemetry/native';
import { LoggedAnalytics, telemetryLog } from './telemetry/event-log';
import { GatedAnalytics } from './telemetry/gated';
import {
  bindAnalyticsConsent,
  toConsentSignals,
  type ConsentSource,
  type RawConsentSignals,
} from './telemetry/collection-consent';
import type { CrashService } from './crash/types';
import { WebCrash } from './crash/web';
import { NativeCrash, type CrashPlugin } from './crash/native';
import type { StorageService } from './storage/types';
import { WebStorage } from './storage/web';
import { NativeStorage } from './storage/native';
import type { NotificationsService } from './notifications/types';
import { WebNotifications } from './notifications/web';
import { NativeNotifications } from './notifications/native';
import { t } from '../i18n';

/** Everything the game asks of the device. Scenes use these and never pick an implementation. */
export interface Services {
  audio: AudioService;
  silentMode: SilentModeService;
  haptics: HapticsService;
  ads: AdsService;
  /** Google UMP and, on iOS, the tracking question (docs/09-services-analytics.md, section 4). */
  consent: ConsentService;
  iap: IapService;
  storage: StorageService;
  share: ShareService;
  telemetry: AnalyticsService;
  /** Local reminders (gift, streak, daily tower, come back); a stub in the browser. */
  notifications: NotificationsService;
  /** Failure reports (Crashlytics inside the app, when its settings file is in the build). */
  crash: CrashService;
  /** The iOS or Android app around the game; a stub in the browser. */
  appShell: AppShellService;
  /** The system's rating window; a stub in the browser. */
  rating: RatingService;
}

/** Inside the iOS or Android app (Capacitor); false in any browser. */
const native = Capacitor.isNativePlatform();

/**
 * The Firebase SDKs are configured only when the build had the settings file of its system
 * (`vite.config.ts` sets the flags): without it a call to the plugin would reach an SDK that was
 * never started. Then analytics and failure reports stay the silent browser services.
 */
const appPlatform = Capacitor.getPlatform();
const firebaseOn =
  (appPlatform === 'ios' && __FIREBASE_IOS__) ||
  (appPlatform === 'android' && __FIREBASE_ANDROID__);

/**
 * Firebase Analytics, with the debug log of the internal build in front of it. The two Firebase
 * plugins are reached by name through `registerPlugin`, not by importing their packages: the
 * packages' web part needs the `firebase` web SDK, which this game does not install, and the
 * native side registers the plugins under these names all the same.
 */
function createTelemetry(consentSource: ConsentSource): AnalyticsService {
  const warn = DEBUG_TOOLS
    ? (message: string): void => {
        telemetryLog.add(`! ${message}`);
        if (import.meta.env.DEV) console.warn(`[telemetry] ${message}`);
      }
    : undefined;
  let inner: AnalyticsService = new WebAnalytics();
  if (firebaseOn) {
    // `setEnabled` turns the collection on or off; Firebase keeps it across launches.
    const plugin = registerPlugin<
      AnalyticsPlugin & { setEnabled(options: { enabled: boolean }): Promise<void> }
    >('FirebaseAnalytics');
    // Collection follows the consent in the EEA, the UK and Switzerland (docs 09, section 6).
    const gate = new GatedAnalytics(new NativeAnalytics(plugin, warn), (enabled) =>
      plugin.setEnabled({ enabled }),
    );
    bindAnalyticsConsent(gate, consentSource, () =>
      tippyDevice.consentSignals().then(toConsentSignals),
    );
    inner = gate;
  }
  return DEBUG_TOOLS ? new LoggedAnalytics(inner, telemetryLog) : inner;
}

/** `TippyDevice.consentSignals`: the IAB TCF strings UMP wrote on the device. */
interface ConsentSignalsPlugin {
  consentSignals(): Promise<RawConsentSignals>;
}

/**
 * The test stubs of ads and purchases act only where the debug tools are (the dev server and the
 * internal build). The store build keeps them silent until the real SDKs come (M8): no fake ads,
 * nothing on sale (docs/09-services-analytics.md, sections 3 and 5).
 */
const TEST_STUBS = DEBUG_TOOLS;

const webAds = new WebAds(showStubOverlay, TEST_STUBS ? 'reward' : 'no_fill');

/** `ios` or `android` inside the app. */
const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

const ads: AdsService = native
  ? new NativeAds(
      createAdMobAdsPlugin(AdMob),
      pickAdUnits({ debugTools: DEBUG_TOOLS, platform, env: import.meta.env }),
    )
  : webAds;

/** The app's own plugin (`ios/App/App/TippyDevicePlugin.swift`, `android/.../TippyDevicePlugin.java`). */
const tippyDevice = registerPlugin<DevicePlugin & ConsentSignalsPlugin>('TippyDevice');

const consent: ConsentService = native
  ? new NativeConsent(AdMob, platform)
  : new WebConsent(typeof window !== 'undefined' && readDebugParams().consent === true);

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
 * there, the ambient session obeys it by itself. Ads and consent are the AdMob plugin, purchases
 * RevenueCat, the analytics and crash reports Firebase (when its settings file is in the build).
 */
export const services: Services = {
  audio: webAudio,
  silentMode: new WebSilentMode(),
  haptics: native ? new NativeHaptics(Haptics) : new WebHaptics(),
  ads,
  consent,
  iap,
  storage: native ? new NativeStorage(Preferences) : new WebStorage(),
  share: new WebShare(),
  telemetry: createTelemetry(consent),
  crash: firebaseOn
    ? new NativeCrash(registerPlugin<CrashPlugin>('FirebaseCrashlytics'))
    : new WebCrash(),
  appShell: native
    ? new NativeAppShell(App, SplashScreen, SystemBars, undefined, tippyDevice)
    : new WebAppShell(),
  rating: native
    ? new NativeRating(InAppReview)
    : new WebRating(DEBUG_TOOLS ? (line) => console.info(line) : null),
  notifications: native
    ? new NativeNotifications(LocalNotifications, (key) => t(key))
    : new WebNotifications(import.meta.env.DEV),
};

/** Dev switch of the ad stub (debug panel). Not part of the services: native ads have none. */
export const adsDev: AdsDevControl = webAds;

/** Dev switch of the store stub (debug panel). Null outside the development build, so the reset cannot be reached in production. */
export const iapDev: IapDevControl | null = import.meta.env.DEV ? webIap : null;

/** Dev levels of the audio (soundboard sliders). Null outside the development build. */
export const audioDev: AudioDevControl | null = DEBUG_TOOLS ? webAudio : null;
