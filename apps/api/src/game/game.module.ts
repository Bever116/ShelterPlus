import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { InviteController } from './invite.controller';

@Module({
  providers: [GameService, GameGateway],
  controllers: [GameController, InviteController],
  exports: [GameService]
})
export class GameModule {}
