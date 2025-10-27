import { Controller, Get, Param, Post } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post(':lobbyId/start')
  start(@Param('lobbyId') lobbyId: string) {
    return this.gameService.startFromLobby(lobbyId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.gameService.getGame(id);
  }
}
