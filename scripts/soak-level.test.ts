import { describe, expect, it } from 'vitest';
import { pickSoakLevel } from './soak-level.cjs';

describe('pickSoakLevel', () => {
  it('runs nothing for docs, texts, data, scripts and tests', () => {
    const files = [
      'docs/08-architecture.md',
      'CLAUDE.md',
      'src/i18n/ru.ts',
      'src/data/tower/balance.ts',
      'scripts/sim.ts',
      'src/game/ui/panel.test.ts',
    ];
    expect(pickSoakLevel(files)).toEqual({ level: 'none', triggers: [] });
    expect(pickSoakLevel([]).level).toBe('none');
  });

  it('runs the smoke lap for other game code', () => {
    const choice = pickSoakLevel(['docs/a.md', 'src/game/ui/common/button.ts']);
    expect(choice).toEqual({ level: 'smoke', triggers: ['src/game/ui/common/button.ts'] });
  });

  it('adds five minutes for scenes, pools, textures, save, core and the safety wrapper', () => {
    const deep = [
      'src/game/scenes/home-scene.ts',
      'src/game/run/run-restart.ts',
      'src/game/objects/tower/landing-prep.ts',
      'src/game/objects/glaze/tongue-view.ts',
      'src/game/fx/shared-atlas.ts',
      'src/game/ui/panel-textures.ts',
      'src/state/game-state.ts',
      'src/services/storage/local.ts',
      'src/core/tower/tower-sim.ts',
      'src/game/common/fx-guard.ts',
    ];
    for (const file of deep) {
      expect(pickSoakLevel(['src/game/ui/common/button.ts', file])).toEqual({
        level: 'smoke+5min',
        triggers: [file],
      });
    }
  });

  it('does not count tests under core as game code', () => {
    expect(pickSoakLevel(['src/core/tower/tower-sim.test.ts']).level).toBe('none');
  });
});
