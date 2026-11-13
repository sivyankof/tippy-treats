import type { CreatureId } from '../../../data/creatures';
import { brownieFx } from './brownie';
import { caramelFx } from './caramel';
import { crumbFx } from './crumb';
import { frostyFx } from './frosty';
import { ghostFx } from './ghost';
import { honeyFx } from './honey';
import { jellyFx } from './jelly';
import type { SignatureFx } from './kit';
import { lemonFx } from './lemon';
import { puffFx } from './puff';
import { rainbowFx } from './rainbow';
import { sprinkleFx } from './sprinkle';
import { twinsFx } from './twins';

/**
 * The signature animation of every creature. A new creature needs its own file and one line
 * here; the type makes a missing line a compile error.
 */
export const SIGNATURES: Readonly<Record<CreatureId, SignatureFx>> = {
  honey: honeyFx,
  puff: puffFx,
  jelly: jellyFx,
  caramel: caramelFx,
  frosty: frostyFx,
  brownie: brownieFx,
  sprinkle: sprinkleFx,
  crumb: crumbFx,
  ghost: ghostFx,
  twins: twinsFx,
  lemon: lemonFx,
  rainbow: rainbowFx,
};
