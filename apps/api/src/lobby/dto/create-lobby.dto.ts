import { CARD_CATEGORY_ORDER, CardCategory } from '@shelterplus/shared';
import { IsEnum, IsInt, IsObject, IsOptional, IsPositive } from 'class-validator';

type EnabledCategories = Partial<Record<CardCategory, boolean>>;

type ChannelsConfig = {
  guildId?: string;
  voiceChannelId?: string;
  textChannelId?: string;
  officialPresetIndex?: number;
};

export class CreateLobbyDto {
  @IsEnum(['OFFICIAL', 'CUSTOM', 'WEB'], { message: 'Invalid lobby mode' })
  mode!: 'OFFICIAL' | 'CUSTOM' | 'WEB';

  @IsInt()
  @IsPositive()
  rounds!: number;

  @IsInt()
  @IsPositive()
  minuteDurationSec!: number;

  @IsObject()
  enabledCategories!: EnabledCategories;

  @IsObject()
  @IsOptional()
  channelsConfig?: ChannelsConfig;
}

export const normalizeEnabledCategories = (
  enabled?: EnabledCategories
): Record<CardCategory, boolean> => {
  const base: Record<CardCategory, boolean> = CARD_CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = true;
      return acc;
    },
    {} as Record<CardCategory, boolean>
  );

  if (!enabled) {
    return base;
  }

  for (const category of CARD_CATEGORY_ORDER) {
    base[category] = enabled[category] ?? true;
  }

  return base;
};
