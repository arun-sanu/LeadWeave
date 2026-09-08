import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LanDiscoveryService } from './lan-discovery.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/lan-mesh',
})
export class LanSignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;
  
  private readonly logger = new Logger(LanSignalingGateway.name);
  private readonly activePeers = new Map<string, string>();

  constructor(private readonly discoveryService: LanDiscoveryService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected for WebRTC signaling: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from signaling: ${client.id}`);
    this.activePeers.delete(client.id);
    client.broadcast.emit('peer-disconnected', client.id);
  }

  @SubscribeMessage('join-mesh')
  handleJoinMesh(
    @MessageBody() data: { name: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Client ${client.id} joining mesh as ${data.name}`);
    const existingPeerIds = Array.from(this.activePeers.keys()).filter(id => id !== client.id);
    this.activePeers.set(client.id, data.name || `User-${client.id.slice(0, 4)}`);

    // Notify everyone else that a new peer wants to connect via WebRTC
    client.broadcast.emit('peer-joined', { peerId: client.id, name: data.name });
    
    // Return the list of already connected peers so the new client can initiate offers
    return {
      status: 'ok',
      peers: existingPeerIds
    };
  }

  @SubscribeMessage('webrtc-signal')
  handleWebRtcSignal(
    @MessageBody() data: { targetPeerId: string, signal: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug(`Relaying WebRTC signal from ${client.id} to ${data.targetPeerId}`);
    
    // Forward the WebRTC signal (offer/answer/ice) to the specific target peer
    this.server.to(data.targetPeerId).emit('webrtc-signal', {
      senderPeerId: client.id,
      signal: data.signal
    });
  }
}
