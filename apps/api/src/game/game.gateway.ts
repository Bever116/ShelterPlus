import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { corsConfig } from '../config/cors.config';

@WebSocketGateway({
  cors: corsConfig
})
export class GameGateway {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  emitToGame(gameId: string, event: string, payload: unknown) {
    if (!this.server) {
      this.logger.debug(`Socket server not ready for event ${event}`);
      return;
    }
    this.server.to(gameId).emit(event, payload);
  }

  joinGame(socketId: string, gameId: string) {
    const socket = this.server.sockets.sockets.get(socketId);
    if (!socket) {
      return;
    }
    socket.join(gameId);
  }

  @SubscribeMessage('game:join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    if (!data?.gameId) {
      return;
    }
    client.join(data.gameId);
    this.logger.debug(`Socket ${client.id} joined game ${data.gameId}`);
  }
}
