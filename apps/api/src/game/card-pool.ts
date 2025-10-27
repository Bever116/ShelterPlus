import { CARD_CATEGORY_ORDER, CardCategory, CATEGORY_DEFAULTS } from '@shelterplus/shared';

export const APOCALYPSE_POOL = [
  'Asteroid impact imminent',
  'Global pandemic mutation',
  'AI uprising across the globe',
  'Volcanic winter'
];

export const BUNKER_POOL = [
  'Underground research facility',
  'High-tech mountain bunker',
  'Deep sea survival station',
  'Retro-fitted subway network'
];

export const CATEGORY_POOLS: Record<CardCategory, string[]> = {
  ...CATEGORY_DEFAULTS
};

export const uniqueCategories = CARD_CATEGORY_ORDER.filter(
  (category) => category !== 'ActionCard' && category !== 'ConditionCard'
);
