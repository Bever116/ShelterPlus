import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LobbyPlayerDto {
  @IsString()
  id!: string;

  @IsInt()
  number!: number;

  @IsString()
  nickname!: string;

  @IsString()
  @IsOptional()
  discordId?: string;
}

export class UpdateLobbyPlayersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LobbyPlayerDto)
  players!: LobbyPlayerDto[];
}
