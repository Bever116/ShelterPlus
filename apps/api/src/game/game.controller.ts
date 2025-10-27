import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GameService } from './game.service';
import { CardCategory, VoteSource } from '@prisma/client';

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

  @Get(':id/state')
  getState(@Param('id') id: string) {
    return this.gameService.getState(id);
  }

  @Post(':id/round/start')
  startRound(@Param('id') id: string, @Body() body: { round: number }) {
    return this.gameService.startRound(id, body.round);
  }

  @Post(':id/round/end')
  endRound(@Param('id') id: string, @Body() body: { round: number }) {
    return this.gameService.endRound(id, body.round);
  }

  @Post(':id/char/preselect')
  preselect(
    @Param('id') id: string,
    @Body()
    body: {
      playerId: string;
      round: number;
      categories: CardCategory[];
    }
  ) {
    return this.gameService.preselectCategories(id, body.playerId, body.round, body.categories);
  }

  @Post(':id/char/open')
  open(
    @Param('id') id: string,
    @Body() body: { playerId: string; category: CardCategory; round: number }
  ) {
    return this.gameService.openCategory(id, body.playerId, body.category, body.round);
  }

  @Post(':id/minutes/enqueue')
  enqueue(
    @Param('id') id: string,
    @Body() body: { playerId: string; round: number }
  ) {
    return this.gameService.enqueueMinute(id, body.round, body.playerId);
  }

  @Post(':id/minutes/approve')
  approve(
    @Param('id') id: string,
    @Body() body: { playerId: string; round: number }
  ) {
    return this.gameService.approveMinute(id, body.playerId, body.round);
  }

  @Post(':id/minutes/start')
  startMinute(
    @Param('id') id: string,
    @Body() body: { playerId?: string; durationSec?: number }
  ) {
    return this.gameService.controlMinuteTimer(id, body.playerId ?? null, 'start', body.durationSec);
  }

  @Post(':id/minutes/stop')
  stopMinute(
    @Param('id') id: string,
    @Body() body: { playerId?: string }
  ) {
    return this.gameService.controlMinuteTimer(id, body.playerId ?? null, 'stop');
  }

  @Post(':id/minutes/reset')
  resetMinute(
    @Param('id') id: string,
    @Body() body: { playerId?: string; durationSec?: number }
  ) {
    return this.gameService.controlMinuteTimer(id, body.playerId ?? null, 'reset', body.durationSec);
  }

  @Post(':id/voting/start')
  votingStart(@Param('id') id: string, @Body() body: { round: number }) {
    return this.gameService.startVoting(id, body.round);
  }

  @Post(':id/voting/stop')
  votingStop(@Param('id') id: string, @Body() body: { round: number }) {
    return this.gameService.stopVoting(id, body.round);
  }

  @Post(':id/voting/revote')
  votingRevote(@Param('id') id: string, @Body() body: { round: number }) {
    return this.gameService.revote(id, body.round);
  }

  @Post(':id/voting/cast')
  votingCast(
    @Param('id') id: string,
    @Body() body: { round: number; voterPlayerId: string; targetPlayerId: string | null; source: VoteSource }
  ) {
    return this.gameService.castVote(id, body.round, body.voterPlayerId, body.targetPlayerId, body.source);
  }

  @Post(':id/kick')
  kick(@Param('id') id: string, @Body() body: { playerId: string }) {
    return this.gameService.kickPlayer(id, body.playerId);
  }
}
