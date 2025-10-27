import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { UpdateLobbyPlayersDto } from './dto/update-players.dto';

@Controller('lobbies')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Post()
  create(@Body() dto: CreateLobbyDto) {
    return this.lobbyService.create(dto);
  }

  @Get(':id')
  get(@Param('id') lobbyId: string) {
    return this.lobbyService.get(lobbyId);
  }

  @Post(':id/collect')
  collect(@Param('id') lobbyId: string) {
    return this.lobbyService.collectPlayers(lobbyId);
  }

  @Patch(':id/collect')
  update(@Param('id') lobbyId: string, @Body() dto: UpdateLobbyPlayersDto) {
    return this.lobbyService.updatePlayers(lobbyId, dto);
  }
}
