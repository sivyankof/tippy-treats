import { AUDIO_LOG } from '../../data/audio/audio-log';
import { audioDev } from '../../services';
import { audioLog } from '../../services/audio/audio-log';
import { formatAudioStatus } from '../../services/audio/audio-status';

/**
 * The trace build of the iOS simulator run (`.github/workflows/ios.yml`, target `trace`): the
 * sound's status line goes to its log every `AUDIO_LOG.traceEveryMs`, so the console of a cold
 * launch shows whether the music ever plays.
 */
export function startAudioTrace(): void {
  const dev = audioDev;
  if (!dev) return;
  setInterval(
    () => audioLog.add(`status: ${formatAudioStatus(dev.status())}`),
    AUDIO_LOG.traceEveryMs,
  );
}
