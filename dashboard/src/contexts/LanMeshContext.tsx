import React, { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
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

export interface LanMeshContextValue {
  userName: string;
  hasJoined: boolean;
  peers: LanPeerInfo[];
  messages: ChatMessage[];
  isConnected: boolean;
  unreadCount: number;
  latestIncomingMessage: ChatMessage | null;
  join: (name: string) => void;
  leave: () => void;
  sendMessage: (text: string) => void;
  sendFile: (file: File) => void;
  markMessagesRead: () => void;
  clearLatestIncomingMessage: () => void;
}

/**
 * Resolves the authenticated user's assigned profile name.
 * Prioritizes:
 * 1. Explicit LeadWeave Profile Name in sessionStorage (leadweave_user_name)
 * 2. Persistent Profile Name in localStorage (leadweave_user_name or openwa_profile_name)
 * 3. Logged-in email display prefix (e.g. "arun@modbitlabs.com" -> "Arun")
 * 4. Fallback default ("Admin User")
 */
export function getProfileAssignedName(): string {
  if (typeof window === 'undefined') return 'Admin User';

  // 1. Check leadweave_user_name in sessionStorage
  const sessionName = sessionStorage.getItem('leadweave_user_name');
  if (sessionName && sessionName.trim() && !sessionName.trim().startsWith('User-')) {
    return sessionName.trim();
  }

  // 2. Check leadweave_user_name in localStorage
  const localName = localStorage.getItem('leadweave_user_name') || localStorage.getItem('openwa_profile_name');
  if (localName && localName.trim() && !localName.trim().startsWith('User-')) {
    return localName.trim();
  }

  // 3. Check email prefix
  const email = sessionStorage.getItem('leadweave_user_email') || localStorage.getItem('leadweave_user_email');
  if (email && email.includes('@')) {
    const prefix = email.split('@')[0].trim();
    if (prefix && prefix.toLowerCase() !== 'admin' && prefix.toLowerCase() !== 'user') {
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
  }

  // 4. Default if nothing else
  return sessionName?.trim() || 'Admin User';
}

const LanMeshContext = createContext<LanMeshContextValue | null>(null);

export const LanMeshProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userName, setUserName] = useState<string>(() => getProfileAssignedName());
  const [hasJoined, setHasJoined] = useState(false);
  const [peers, setPeers] = useState<LanPeerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestIncomingMessage, setLatestIncomingMessage] = useState<ChatMessage | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const webrtcPeersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());
  const myIdRef = useRef<string>('');

  const initiateWebRtcConnection = useCallback((targetPeerId: string, initiator: boolean) => {
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
      try {
        const parsedData = JSON.parse(data.toString()) as ChatMessage;
        setMessages(prev => [...prev, parsedData]);
        setLatestIncomingMessage(parsedData);
        setUnreadCount(prev => prev + 1);
      } catch (e) {
        console.error('Failed to parse WebRTC data', e);
      }
    });

    peer.on('close', () => {
      webrtcPeersRef.current.delete(targetPeerId);
      setPeers(prev => prev.filter(p => p.peerId !== targetPeerId));
    });

    peer.on('error', err => {
      console.warn('WebRTC peer error:', err);
      webrtcPeersRef.current.delete(targetPeerId);
      setPeers(prev => prev.filter(p => p.peerId !== targetPeerId));
    });

    webrtcPeersRef.current.set(targetPeerId, peer);
    return peer;
  }, []);

  const connectToSignaling = useCallback(
    (name: string) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const socket = io('/lan-mesh', {
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        myIdRef.current = socket.id || '';
        socket.emit('join-mesh', { name }, (response: { status: string; peers: string[] }) => {
          if (response && response.status === 'ok' && Array.isArray(response.peers)) {
            response.peers.forEach((peerId: string) => {
              initiateWebRtcConnection(peerId, true);
            });
          }
        });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        webrtcPeersRef.current.forEach(peer => peer.destroy());
        webrtcPeersRef.current.clear();
        setPeers([]);
      });

      socket.on('peer-joined', (data: LanPeerInfo) => {
        setPeers(prev => {
          const filtered = prev.filter(p => p.peerId !== data.peerId);
          return [...filtered, data];
        });
      });

      socket.on('peer-disconnected', (peerId: string) => {
        setPeers(prev => prev.filter(p => p.peerId !== peerId));
        if (webrtcPeersRef.current.has(peerId)) {
          webrtcPeersRef.current.get(peerId)?.destroy();
          webrtcPeersRef.current.delete(peerId);
        }
      });

      socket.on('webrtc-signal', (data: { senderPeerId: string; signal: any }) => {
        const { senderPeerId, signal } = data;
        let peer = webrtcPeersRef.current.get(senderPeerId);

        if (!peer) {
          peer = initiateWebRtcConnection(senderPeerId, false);
        }
        peer.signal(signal);
      });
    },
    [initiateWebRtcConnection],
  );

  const join = useCallback(
    (name: string) => {
      const trimmed = name.trim() || getProfileAssignedName();
      try {
        sessionStorage.setItem('leadweave_user_name', trimmed);
        localStorage.setItem('leadweave_user_name', trimmed);
        localStorage.setItem('openwa_lan_mesh_name', trimmed);
      } catch (err) {
        console.warn('Failed to save mesh name:', err);
      }
      setUserName(trimmed);
      setHasJoined(true);
      connectToSignaling(trimmed);
    },
    [connectToSignaling],
  );

  const leave = useCallback(() => {
    setHasJoined(false);
    setIsConnected(false);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    webrtcPeersRef.current.forEach(peer => peer.destroy());
    webrtcPeersRef.current.clear();
    setPeers([]);
  }, []);

  // Synchronize with profile changes in real time
  useEffect(() => {
    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ userName: string }>;
      const newName = customEvent.detail?.userName || getProfileAssignedName();
      if (newName && newName !== userName) {
        setUserName(newName);
        // Re-announce name to signaling server if connected
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('join-mesh', { name: newName });
        }
      }
    };

    window.addEventListener('leadweave:profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);

    return () => {
      window.removeEventListener('leadweave:profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [userName]);

  // Auto-join using the assigned profile name on mount
  useEffect(() => {
    const assignedName = getProfileAssignedName();
    if (assignedName) {
      join(assignedName);
    }
  }, [join]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const currentProfileName = userName || getProfileAssignedName();

      const msg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        senderId: myIdRef.current,
        senderName: currentProfileName,
        text: trimmed,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, msg]);

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
          const currentProfileName = userName || getProfileAssignedName();

          const msg: ChatMessage = {
            id: Math.random().toString(36).substring(7),
            senderId: myIdRef.current,
            senderName: currentProfileName,
            fileName: file.name,
            text: `Shared a file: ${file.name}`,
            timestamp: Date.now(),
          };

          const payload = JSON.stringify(msg);
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

  const markMessagesRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearLatestIncomingMessage = useCallback(() => {
    setLatestIncomingMessage(null);
  }, []);

  useEffect(() => {
    const peersMap = webrtcPeersRef.current;
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      peersMap.forEach(peer => peer.destroy());
    };
  }, []);

  const value: LanMeshContextValue = {
    userName,
    hasJoined,
    peers,
    messages,
    isConnected,
    unreadCount,
    latestIncomingMessage,
    join,
    leave,
    sendMessage,
    sendFile,
    markMessagesRead,
    clearLatestIncomingMessage,
  };

  return <LanMeshContext.Provider value={value}>{children}</LanMeshContext.Provider>;
};

export function useLanMeshContext() {
  const context = useContext(LanMeshContext);
  if (!context) {
    throw new Error('useLanMeshContext must be used within a LanMeshProvider');
  }
  return context;
}
