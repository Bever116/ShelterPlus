import { Controller, Get } from '@nestjs/common';
import { OfficialConfigService } from './official-config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly officialConfig: OfficialConfigService) {}

  @Get('official')
  getOfficial() {
    return this.officialConfig.getAll();
  }
}
