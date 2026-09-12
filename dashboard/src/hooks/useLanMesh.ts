import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

export interface LanPeerInfo {
  peerId: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  fileName?: string;
  fileData?: ArrayBuffer;
  timestamp: number;
}

export function useLanMesh(userName: string) {
  const [peers, setPeers] = useState<LanPeerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const webrtcPeersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());
  const myIdRef = useRef<string>('');

  const initiateWebRtcConnection = (targetPeerId: string, initiator: boolean) => {
    const peer = new SimplePeer({
      initiator,
      trickle: false,
    });

    peer.on('signal', signalData => {
      socketRef.current?.emit('webrtc-signal', {
        targetPeerId,
        signal: signalData,
      });
    });

    peer.on('data', data => {
      // Receive message from P2P channel
      try {
        const parsedData = JSON.parse(data.toString());
        setMessages(prev => [...prev, parsedData]);
      } catch (e) {
        console.error('Failed to parse WebRTC data', e);
      }
    });

    peer.on('close', () => {
      webrtcPeersRef.current.delete(targetPeerId);
      setPeers(prev => prev.filter(p => p.peerId !== targetPeerId));
    });

    webrtcPeersRef.current.set(targetPeerId, peer);
    return peer;
  };

  useEffect(() => {
    // Connect to the signaling server
    const socket = io('/lan-mesh', {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      myIdRef.current = socket.id || '';
      socket.emit('join-mesh', { name: userName }, (response: { status: string; peers: string[] }) => {
        // We get a list of existing peers, we must send an offer to each of them
        if (response.status === 'ok') {
          response.peers.forEach((peerId: string) => {
            initiateWebRtcConnection(peerId, true);
          });
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      // Clean up WebRTC connections if signaling drops
      webrtcPeersRef.current.forEach(peer => peer.destroy());
      webrtcPeersRef.current.clear();
      setPeers([]);
    });

    socket.on('peer-joined', (data: LanPeerInfo) => {
      // The new peer will initiate the connection, we just wait for the offer
      setPeers(prev => [...prev.filter(p => p.peerId !== data.peerId), data]);
    });

    socket.on('peer-disconnected', (peerId: string) => {
      setPeers(prev => prev.filter(p => p.peerId !== peerId));
      if (webrtcPeersRef.current.has(peerId)) {
        webrtcPeersRef.current.get(peerId)?.destroy();
        webrtcPeersRef.current.delete(peerId);
      }
    });

    socket.on('webrtc-signal', (data: { senderPeerId: string; signal: unknown }) => {
      const { senderPeerId, signal } = data;
      let peer = webrtcPeersRef.current.get(senderPeerId);

      if (!peer) {
        // We received an offer from someone else
        peer = initiateWebRtcConnection(senderPeerId, false);
      }

      peer.signal(signal);
    });

    const peersMap = webrtcPeersRef.current;
    return () => {
      socket.disconnect();
      peersMap.forEach(peer => peer.destroy());
    };
  }, [userName]);

  const sendMessage = useCallback(
    (text: string) => {
      const msg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        senderId: myIdRef.current,
        senderName: userName,
        text,
        timestamp: Date.now(),
      };

      // Optimistic update
      setMessages(prev => [...prev, msg]);

      // Broadcast via WebRTC to all connected peers
      const payload = JSON.stringify(msg);
      webrtcPeersRef.current.forEach(peer => {
        if (peer.connected) {
          peer.send(payload);
        }
      });
    },
    [userName],
  );

  const sendFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          const msg: ChatMessage = {
            id: Math.random().toString(36).substring(7),
            senderId: myIdRef.current,
            senderName: userName,
            fileName: file.name,
            text: `Shared a file: ${file.name}`,
            timestamp: Date.now(),
          };

          // Broadcast via WebRTC
          const payload = JSON.stringify(msg); // Note: SimplePeer can send arraybuffers directly, but for simplicity here we stringify. In a real app we'd chunk array buffers.
          webrtcPeersRef.current.forEach(peer => {
            if (peer.connected) {
              peer.send(payload);
            }
          });

          setMessages(prev => [...prev, msg]);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [userName],
  );

  return {
    peers,
    messages,
    isConnected,
    sendMessage,
    sendFile,
  };
}
