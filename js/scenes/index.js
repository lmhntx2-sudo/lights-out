// Everything the cutscene player loads in one go, the first time a scene plays.
import * as moments from './moments.js';
import * as places from './places.js';
import { SCENES } from '../ui/cutscene-pick.js';

export { createStage } from './kit.js';

const all = { ...moments, ...places };
export const BUILDERS = Object.fromEntries(SCENES.map((id) => [id, all[id]]));
