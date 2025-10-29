import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { getRequestIdFromHeaders } from '@shelterplus/shared/logging';
import { PinoLoggerService } from '../logging/logger.service';
import { runWithRequestContext } from '../logging/request-context';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { corsConfig } from '../config/cors.config';

@WebSocketGateway({
  cors: corsConfig
})
@Injectable()
export class GameGateway {
  private readonly logger: PinoLoggerService;

  constructor(logger: PinoLoggerService) {
    this.logger = logger.forContext(GameGateway.name);
  }

  @WebSocketServer()
  server!: Server;

  private ensureSocketRequestId(socket: Socket): string {
    if (!socket.data.requestId) {
      const headerId = getRequestIdFromHeaders(socket.handshake.headers);
      socket.data.requestId = headerId ?? uuidv4();
    }
    return socket.data.requestId as string;
  }

  private withSocketContext<T>(socket: Socket, callback: () => T): T {
    const requestId = this.ensureSocketRequestId(socket);
    return runWithRequestContext({ requestId, socketId: socket.id }, callback);
  }

  emitToGame(gameId: string, event: string, payload: unknown) {
    if (!this.server) {
      this.logger.debug('Socket server not ready to emit event', { action: 'ws.emit.skipped', event, gameId });
      return;
    }
    let payloadSize: number | undefined;
    try {
      payloadSize = JSON.stringify(payload ?? {}).length;
    } catch {
      payloadSize = undefined;
    }
    this.logger.debug('Emitting event to game room', { action: 'ws.emit', event, gameId, payloadSize });
    this.server.to(gameId).emit(event, payload);
  }

  joinGame(socketId: string, gameId: string) {
    const socket = this.server.sockets.sockets.get(socketId);
    if (!socket) {
      this.logger.warn('Socket not found for join request', { action: 'ws.join.missingSocket', socketId, gameId });
      return;
    }
    this.withSocketContext(socket, () => {
      socket.join(gameId);
      this.logger.debug('Socket joined game room', { action: 'ws.join', socketId, gameId });
    });
  }

  handleConnection(client: Socket) {
    this.withSocketContext(client, () => {
      this.logger.log('Socket connection established', { action: 'ws.connection', socketId: client.id });
    });
  }

  handleDisconnect(client: Socket) {
    this.withSocketContext(client, () => {
      this.logger.log('Socket disconnected', { action: 'ws.disconnect', socketId: client.id });
    });
  }

  @SubscribeMessage('game:join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { gameId: string }) {
    if (!data?.gameId) {
      return;
    }
    this.withSocketContext(client, () => {
      client.join(data.gameId);
      this.logger.debug('Socket joined game via message', { action: 'ws.message.join', socketId: client.id, gameId: data.gameId });
    });
  }
}
