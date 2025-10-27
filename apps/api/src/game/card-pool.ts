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

export const ENDING_POOL = [
  {
    title: 'A New Dawn',
    description: 'The survivors rebuild society with newfound cooperation and resilience.'
  },
  {
    title: 'Seeds of Hope',
    description: 'Hidden vaults of knowledge help the bunker population restore critical infrastructure.'
  },
  {
    title: 'The Long Night',
    description: 'Resources are scarce, but a small council keeps the bunker united for the next decade.'
  },
  {
    title: 'Contact Established',
    description: 'A distant colony responds to your signal, offering trade routes and an uncertain alliance.'
  }
];
