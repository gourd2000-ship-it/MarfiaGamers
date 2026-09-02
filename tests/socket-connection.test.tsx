// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useCallback } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectionStatus } from '../apps/web/src/components/connection-status.js';
import { useSocketConnection } from '../apps/web/src/hooks/use-socket-connection.js';

class FakeSocket {
  private readonly handlers = new Map<string, () => void>();
  disconnected = false;

  on(event: string, handler: () => void) {
    this.handlers.set(event, handler);
    return this;
  }

  off(event: string) {
    this.handlers.delete(event);
    return this;
  }

  disconnect() {
    this.disconnected = true;
    return this;
  }

  trigger(event: string) {
    this.handlers.get(event)?.();
  }
}

function ConnectionProbe({ socket }: { socket: FakeSocket }) {
  const socketFactory = useCallback(() => socket, [socket]);
  const state = useSocketConnection('http://example.test', socketFactory);
  return <ConnectionStatus state={state} />;
}

describe('useSocketConnection', () => {
  afterEach(cleanup);

  it('shows connect, reconnect and error states from the Socket client', () => {
    const socket = new FakeSocket();
    render(<ConnectionProbe socket={socket} />);

    expect(screen.getByRole('status')).toHaveTextContent('실시간 서버에 연결 중');

    act(() => socket.trigger('connect'));
    expect(screen.getByRole('status')).toHaveTextContent('실시간 서버에 연결됨');

    act(() => socket.trigger('disconnect'));
    expect(screen.getByRole('status')).toHaveTextContent('다시 연결하는 중');

    act(() => socket.trigger('connect_error'));
    expect(screen.getByRole('status')).toHaveTextContent('실시간 서버 연결 오류');
  });

  it('disconnects the Socket client when the page leaves', () => {
    const socket = new FakeSocket();
    const rendered = render(<ConnectionProbe socket={socket} />);

    rendered.unmount();

    expect(socket.disconnected).toBe(true);
  });
});
