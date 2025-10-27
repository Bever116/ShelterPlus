import { Controller, Get } from '@nestjs/common';
import { GameService } from '../game/game.service';

@Controller()
export class MetricsController {
  constructor(private readonly gameService: GameService) {}

  @Get('metrics')
  getMetrics() {
    return this.gameService.getMetrics();
  }
}
