import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { ConnectionState } from '../components/connection-status.js';

export interface SocketConnection {
  on(event: 'connect' | 'disconnect' | 'connect_error', listener: () => void): unknown;
  off(event: 'connect' | 'disconnect' | 'connect_error', listener: () => void): unknown;
  disconnect(): unknown;
}

export type CreateSocket = (url: string) => SocketConnection;

const createSocket: CreateSocket = (url) => io(url);

export function useSocketConnection(
  url: string,
  socketFactory: CreateSocket = createSocket
): ConnectionState {
  const [state, setState] = useState<ConnectionState>('connecting');

  useEffect(() => {
    const socket = socketFactory(url);
    const onConnect = () => setState('connected');
    const onDisconnect = () => setState('reconnecting');
    const onConnectError = () => setState('error');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, [socketFactory, url]);

  return state;
}
