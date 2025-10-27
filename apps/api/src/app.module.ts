import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { LobbyModule } from './lobby/lobby.module';
import { GameModule } from './game/game.module';
import { DiscordModule } from './discord/discord.module';
import { AppConfigModule } from './config/config.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    AppConfigModule,
    PrismaModule,
    DiscordModule,
    LobbyModule,
    GameModule,
    MetricsModule
  ]
})
export class AppModule {}
