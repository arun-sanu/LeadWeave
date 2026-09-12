import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Bonjour, { Service } from 'bonjour-service';
import { randomUUID } from 'crypto';

export interface LanPeer {
  id: string;
  name: string;
  address: string;
  port: number;
  lastSeen: Date;
}

@Injectable()
export class LanDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LanDiscoveryService.name);
  private bonjour: Bonjour | null = null;
  private publishedService: Service | null = null;
  private peers: Map<string, LanPeer> = new Map();
  public readonly instanceId = randomUUID();

  onModuleInit() {
    this.logger.log(`Initializing LAN Discovery (Instance: ${this.instanceId})`);

    // Initialize bonjour
    this.bonjour = new Bonjour();

    // Publish our service
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    this.publishedService = this.bonjour.publish({
      name: `OpenWA-Mesh-${this.instanceId}`,
      type: 'openwa-mesh',
      port,
      txt: { instanceId: this.instanceId, app: 'OpenWA' },
    });

    this.publishedService.on('up', () => {
      this.logger.log(`LAN Service published on port ${port}`);
    });

    this.publishedService.on('error', err => {
      this.logger.error(`Error publishing LAN service: ${err.message}`, err.stack);
    });

    // Browse for other peers
    const browser = this.bonjour.find({ type: 'openwa-mesh' });

    browser.on('up', (service: Service) => {
      // Ignore ourselves
      if (service.txt && service.txt.instanceId === this.instanceId) return;

      const peerId = service.txt?.instanceId || service.name;
      const address = service.addresses?.[0] || service.host;

      this.logger.log(`Discovered LAN Peer: ${peerId} at ${address}:${service.port}`);

      this.peers.set(peerId, {
        id: peerId,
        name: service.name,
        address,
        port: service.port,
        lastSeen: new Date(),
      });
    });

    browser.on('down', (service: Service) => {
      const peerId = service.txt?.instanceId || service.name;
      this.logger.log(`LAN Peer went offline: ${peerId}`);
      this.peers.delete(peerId);
    });
  }

  onModuleDestroy() {
    this.logger.log('Stopping LAN Discovery');
    if (this.publishedService) {
      this.publishedService.stop();
    }
    if (this.bonjour) {
      this.bonjour.destroy();
    }
  }

  getDiscoveredPeers(): LanPeer[] {
    return Array.from(this.peers.values());
  }
}
