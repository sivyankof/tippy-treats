import { describe, expect, it, vi } from 'vitest';
import type { Services } from '../../services';
import { cuesForMoment } from './moment-cues';
import { playCues } from './run-cues';

describe('cuesForMoment', () => {
  it('plays the record fanfare with the three-hit vibration', () => {
    expect(cuesForMoment('recordBeaten')).toEqual({
      sounds: [{ kind: 'record' }],
      haptics: ['triple'],
    });
  });

  it('confirms a continue with a success', () => {
    const cues = cuesForMoment('continued');
    expect(cues.sounds).toEqual([{ kind: 'berry' }]);
    expect(cues.haptics).toEqual(['success']);
  });

  it('keeps a decline silent', () => {
    expect(cuesForMoment('declined')).toEqual({ sounds: [], haptics: [] });
  });

  it('hands the new sound kinds to the audio service', () => {
    const audio = { click: vi.fn(), berry: vi.fn(), record: vi.fn() };
    const haptics = { play: vi.fn() };
    const services = { audio, haptics } as unknown as Services;
    playCues(cuesForMoment('offerOpened'), services);
    playCues(cuesForMoment('continued'), services);
    playCues(cuesForMoment('recordBeaten'), services);
    expect(audio.click).toHaveBeenCalledOnce();
    expect(audio.berry).toHaveBeenCalledOnce();
    expect(audio.record).toHaveBeenCalledOnce();
    expect(haptics.play).toHaveBeenCalledTimes(3);
  });
});
