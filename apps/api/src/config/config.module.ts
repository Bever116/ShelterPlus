import { Global, Module } from '@nestjs/common';
import { OfficialConfigService } from './official-config.service';
import { ConfigController } from './config.controller';

@Global()
@Module({
  providers: [OfficialConfigService],
  controllers: [ConfigController],
  exports: [OfficialConfigService]
})
export class AppConfigModule {}
