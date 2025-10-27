import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { GameModule } from '../game/game.module';

@Module({
  imports: [GameModule],
  controllers: [MetricsController]
})
export class MetricsModule {}
