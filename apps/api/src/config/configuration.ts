import { OFFICIAL_CONFIG_JSON } from '@shelterplus/shared';

type EnvConfig = {
  databaseUrl: string;
  discordToken?: string;
  officialConfigJson: string;
};

export default (): EnvConfig => ({
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/shelterplus',
  discordToken: process.env.DISCORD_BOT_TOKEN,
  officialConfigJson: process.env.OFFICIAL_CONFIG_JSON ?? OFFICIAL_CONFIG_JSON
});
