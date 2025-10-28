import {
  CARD_CATEGORY_ORDER,
  CardCategory,
  CATEGORY_DEFAULTS,
  SHELTER_PLUS_APOCALYPSE_BUNKER_POOL,
  SHELTER_PLUS_ENDINGS
} from '@shelterplus/shared';

export const APOCALYPSE_BUNKER_POOL = SHELTER_PLUS_APOCALYPSE_BUNKER_POOL;

export const APOCALYPSE_POOL = APOCALYPSE_BUNKER_POOL.map((entry) => entry.apocalypse);

export const BUNKER_POOL = APOCALYPSE_BUNKER_POOL.map((entry) => entry.bunker);

export const CATEGORY_POOLS: Record<CardCategory, string[]> = {
  ...CATEGORY_DEFAULTS
};

export const uniqueCategories = CARD_CATEGORY_ORDER.filter(
  (category) => category !== 'ActionCard' && category !== 'ConditionCard'
);

export const ENDING_POOL = SHELTER_PLUS_ENDINGS;
