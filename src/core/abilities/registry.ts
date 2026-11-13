import { brownie } from './brownie';
import { caramel } from './caramel';
import { crumb } from './crumb';
import { frosty } from './frosty';
import { ghost } from './ghost';
import { honey } from './honey';
import { jelly } from './jelly';
import { lemon } from './lemon';
import { puff } from './puff';
import { rainbow } from './rainbow';
import { sprinkle } from './sprinkle';
import { twins } from './twins';
import type { Ability, CreatureId } from './types';

/** The Record type makes the compiler demand an ability for every creature id. */
export const ABILITIES: Readonly<Record<CreatureId, Ability>> = {
  honey,
  puff,
  jelly,
  caramel,
  frosty,
  brownie,
  sprinkle,
  crumb,
  ghost,
  twins,
  lemon,
  rainbow,
};
