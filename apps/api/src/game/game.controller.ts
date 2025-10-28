import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { GameService } from './game.service';
import type { Request } from 'express';
import { CardCategory, VoteSource } from '@prisma/client';
import { buildAbsoluteUrl } from '../common/utils/request-origin';

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

  @Get(':id/public')
  getPublic(@Param('id') id: string) {
    return this.gameService.getPublicGame(id);
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

  @Post(':id/spectators/invite')
  spectatorInvite(@Param('id') id: string, @Req() req: Request) {
    return this.gameService.createSpectatorInvite(id).then((invite) => ({
      code: invite.code,
      expiresAt: invite.expiresAt,
      role: invite.role,
      url: buildAbsoluteUrl(req, `/invite/${invite.code}`)
    }));
  }

  @Post(':id/cohosts/invite')
  cohostInvite(@Param('id') id: string, @Req() req: Request) {
    return this.gameService.createCoHostInvite(id).then((invite) => ({
      code: invite.code,
      expiresAt: invite.expiresAt,
      role: invite.role,
      url: buildAbsoluteUrl(req, `/invite/${invite.code}`)
    }));
  }

  @Get(':id/events')
  listEvents(
    @Param('id') id: string,
    @Query('type') type?: string,
    @Query('playerId') playerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take = '50',
    @Query('cursor') cursor?: string
  ) {
    return this.gameService.listEvents(
      id,
      {
        type: type ?? undefined,
        playerId: playerId ?? undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined
      },
      Number(take),
      cursor
    );
  }

  @Get(':id/export')
  exportGame(@Param('id') id: string) {
    return this.gameService.exportGame(id);
  }

  @Post(':id/ending')
  ending(@Param('id') id: string) {
    return this.gameService.triggerEnding(id);
  }
}
