import { Module, Logger } from '@nestjs/common';
import { LanDiscoveryService } from './lan-discovery.service';
import { LanSignalingGateway } from './lan-signaling.gateway';

@Module({
  providers: [LanDiscoveryService, LanSignalingGateway, Logger],
  exports: [LanDiscoveryService],
})
export class LanMeshModule {}
