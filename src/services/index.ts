import { Capacitor, SystemBars } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
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
import { NativeAppShell } from './app-shell/native';
import { productIds } from './iap/product-ids';
import type { IapDevControl, IapService } from './iap/types';
import { createStubIap } from './iap/stub-iap';
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
  /** Google UMP and, on iOS, the tracking question (docs/09-services-analytics.md, section 4). */
  consent: ConsentService;
  iap: IapService;
  storage: StorageService;
  share: ShareService;
  telemetry: AnalyticsService;
  /** The iOS or Android app around the game; a stub in the browser. */
  appShell: AppShellService;
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

/** `ios` or `android` inside the app. */
const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

const ads: AdsService = native
  ? new NativeAds(
      createAdMobAdsPlugin(AdMob),
      pickAdUnits({ debugTools: DEBUG_TOOLS, platform, env: import.meta.env }),
    )
  : webAds;

const consent: ConsentService = native
  ? new NativeConsent(AdMob, platform)
  : new WebConsent(typeof window !== 'undefined' && readDebugParams().consent === true);

const webIap = createStubIap(productIds, TEST_STUBS);

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
 * there, the ambient session obeys it by itself. Ads and consent are the AdMob plugin; purchases,
 * analytics and sharing stay the stubs until the rest of stage M8.
 */
export const services: Services = {
  audio: webAudio,
  silentMode: new WebSilentMode(),
  haptics: native ? new NativeHaptics(Haptics) : new WebHaptics(),
  ads,
  consent,
  iap: webIap,
  storage: native ? new NativeStorage(Preferences) : new WebStorage(),
  share: new WebShare(),
  telemetry: new WebAnalytics(),
  appShell: native ? new NativeAppShell(App, SplashScreen, SystemBars) : new WebAppShell(),
};

/** Dev switch of the ad stub (debug panel). Not part of the services: native ads have none. */
export const adsDev: AdsDevControl = webAds;

/** Dev switch of the store stub (debug panel). Null outside the development build, so the reset cannot be reached in production. */
export const iapDev: IapDevControl | null = import.meta.env.DEV ? webIap : null;

/** Dev levels of the audio (soundboard sliders). Null outside the development build. */
export const audioDev: AudioDevControl | null = DEBUG_TOOLS ? webAudio : null;
