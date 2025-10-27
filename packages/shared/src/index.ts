export type PlayerStatus = 'ALIVE' | 'OUT';
export type PlayerRole = 'PLAYER' | 'SPECTATOR';

export interface Player {
  id: string;
  gameId: string;
  discordId: string | null;
  number: number;
  nickname: string;
  status: PlayerStatus;
  role: PlayerRole;
  cards: Card[];
}

export type CardCategory =
  | 'Profession'
  | 'Bio'
  | 'Health'
  | 'Hobby'
  | 'Phobia'
  | 'Personality'
  | 'ExtraInfo'
  | 'Knowledge'
  | 'Luggage'
  | 'ActionCard'
  | 'ConditionCard';

export interface CardPayload {
  title: string;
  description?: string;
  [key: string]: unknown;
}

export interface Card {
  id: string;
  playerId: string;
  category: CardCategory;
  payload: CardPayload;
  isOpen: boolean;
  openedAt?: string | null;
  openedRound?: number | null;
}

export interface GameEvent {
  id: string;
  gameId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LobbyChannelsConfig {
  guildId?: string;
  voiceChannelId?: string;
  textChannelId?: string;
  officialPresetIndex?: number;
}

export interface Lobby {
  id: string;
  mode: 'OFFICIAL' | 'CUSTOM' | 'WEB';
  rounds: number;
  minuteDurationSec: number;
  enabledCategories: Record<CardCategory, boolean>;
  channelsConfig: LobbyChannelsConfig;
  createdAt: string;
  updatedAt: string;
  players?: Array<{
    id: string;
    number: number;
    nickname: string;
    discordId: string | null;
  }>;
  game?: { id: string } | null;
}

export interface Game {
  id: string;
  lobbyId: string;
  apocalypse: string;
  bunker: string;
  seats: number;
  currentRound: number;
  isSpectatorsEnabled: boolean;
  ending?: Record<string, unknown> | null;
  players: Player[];
  createdAt: string;
}

export type VoteSource = 'WEB' | 'DISCORD';

export interface Vote {
  id: string;
  gameId: string;
  round: number;
  voterPlayerId: string;
  targetPlayerId: string | null;
  source: VoteSource;
  updatedAt: string;
  createdAt: string;
}

export interface MinuteRequest {
  id: string;
  gameId: string;
  round: number;
  playerId: string;
  position: number;
  approved: boolean;
  startedAt?: string | null;
  durationSec?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RevealPlan {
  id: string;
  gameId: string;
  round: number;
  playerId: string;
  categories: CardCategory[];
  createdAt: string;
  updatedAt: string;
}

export type GameAdminRole = 'HOST' | 'CO_HOST';

export interface GameAdmin {
  id: string;
  gameId: string;
  userId: string;
  role: GameAdminRole;
  createdAt: string;
}

export type InviteRole = 'CO_HOST' | 'SPECTATOR';

export interface Invite {
  id: string;
  gameId: string;
  code: string;
  role: InviteRole;
  expiresAt: string;
  usedByUserId?: string | null;
  createdAt: string;
}

export interface PublicPlayerView {
  id: string;
  number: number;
  nickname: string;
  status: PlayerStatus;
  role: PlayerRole;
  openedCards: Array<{
    category: CardCategory;
    payload: CardPayload;
    openedAt?: string | null;
    openedRound?: number | null;
  }>;
}

export interface GamePublicState {
  id: string;
  apocalypse: string;
  bunker: string;
  seats: number;
  currentRound: number;
  ending?: Record<string, unknown> | null;
  players: PublicPlayerView[];
  votes: Record<string, number>;
  updatedAt: string;
}

export interface CollectPlayersResponse {
  players: Array<{
    id: string;
    number: number;
    nickname: string;
    discordId: string | null;
  }>;
}

export const CARD_CATEGORY_ORDER: CardCategory[] = [
  'Profession',
  'Bio',
  'Health',
  'Hobby',
  'Phobia',
  'Personality',
  'ExtraInfo',
  'Knowledge',
  'Luggage',
  'ActionCard',
  'ConditionCard'
];

export const OFFICIAL_CONFIG_JSON = `[
  {
    "apocalypse": "Asteroid Impact",
    "bunker": "Mountain Shelter",
    "voiceChannelId": "123",
    "textChannelId": "456"
  },
  {
    "apocalypse": "Global Pandemic",
    "bunker": "Underground Labs",
    "voiceChannelId": "234",
    "textChannelId": "567"
  },
  {
    "apocalypse": "Solar Flare Catastrophe",
    "bunker": "Polar Research Vault",
    "voiceChannelId": "345",
    "textChannelId": "678"
  },
  {
    "apocalypse": "Alien Invasion",
    "bunker": "Desert Command Center",
    "voiceChannelId": "456",
    "textChannelId": "789"
  },
  {
    "apocalypse": "Global Flood",
    "bunker": "Floating Ark",
    "voiceChannelId": "567",
    "textChannelId": "890"
  },
  {
    "apocalypse": "Nuclear Winter",
    "bunker": "Subterranean Metro Complex",
    "voiceChannelId": "678",
    "textChannelId": "901"
  }
]`;

export const CATEGORY_DEFAULTS: Record<CardCategory, string[]> = {
  Profession: ['Biologist', 'Engineer', 'Artist'],
  Bio: ['Age 25', 'Age 35', 'Age 42'],
  Health: ['Perfect health', 'Asthma', 'Diabetic'],
  Hobby: ['Gardening', 'Chess', 'Rock climbing'],
  Phobia: ['Fear of heights', 'Claustrophobic', 'Fear of spiders'],
  Personality: ['Optimistic', 'Pessimistic', 'Leader'],
  ExtraInfo: ['Knows first aid', 'Won a lottery', 'Is a twin'],
  Knowledge: ['Survival skills', 'Medical training', 'Mechanical skills'],
  Luggage: ['Backpack of tools', 'Suitcase of clothes', 'Box of canned food'],
  ActionCard: ['Swap a card', 'Peek at a card', 'Trade information'],
  ConditionCard: ['Lose a turn', 'Share a secret', 'Reveal a card']
};
