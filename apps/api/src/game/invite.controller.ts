import { Body, Controller, Param, Post } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('invites')
export class InviteController {
  constructor(private readonly gameService: GameService) {}

  @Post(':code/accept')
  accept(
    @Param('code') code: string,
    @Body() body: { userId: string; nickname: string }
  ) {
    return this.gameService.acceptInvite(code, body.userId, body.nickname);
  }
}
