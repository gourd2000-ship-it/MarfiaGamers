import { describe, expect, it } from 'vitest';
import {
  createRoom,
  closeRoom,
  joinRoom,
  resignPlayer,
  startRoom
} from '../apps/server/src/session/room-session.js';

const createFourPlayerRoom = () => {
  const room = createRoom({
    code: 'ABCD12',
    inviteToken: '0123456789abcdef0123456789abcdef',
    name: '1학년 2반',
    maxPlayers: 6,
    timerSeconds: 60,
    host: { id: 'host', nickname: '방장' }
  });
  const withSecond = joinRoom(room, { id: 'p2', nickname: '하늘' });
  const withThird = joinRoom(withSecond, { id: 'p3', nickname: '바다' });
  return joinRoom(withThird, { id: 'p4', nickname: '별' });
};

describe('room session', () => {
  it('lets only the host start a four-player room and then blocks new joins', () => {
    const room = createFourPlayerRoom();

    expect(() => startRoom(room, 'p2')).toThrow('Only the host');

    const started = startRoom(room, 'host');

    expect(started.status).toBe('in-game');
    expect(() => joinRoom(started, { id: 'p5', nickname: '숲' })).toThrow('already started');
  });

  it('marks a disconnected player as permanently resigned and excludes them from active players', () => {
    const room = createFourPlayerRoom();

    const resigned = resignPlayer(room, 'p3');

    expect(resigned.players.find((player) => player.id === 'p3')).toMatchObject({
      status: 'resigned'
    });
    expect(resigned.players.filter((player) => player.status === 'active')).toHaveLength(3);
    expect(() => joinRoom(resigned, { id: 'p3', nickname: '바다' })).toThrow('cannot rejoin');
  });

  it('transfers host authority to the first remaining active player when the host disconnects', () => {
    const room = joinRoom(createFourPlayerRoom(), { id: 'p5', nickname: '새벽' });

    const resigned = resignPlayer(room, 'host');

    expect(resigned.players.find((player) => player.id === 'host')).toMatchObject({
      status: 'resigned',
      isHost: false
    });
    expect(resigned.players.find((player) => player.id === 'p2')).toMatchObject({ isHost: true });
    expect(startRoom(resigned, 'p2')).toMatchObject({ status: 'in-game' });
  });

  it('allows only the host to close a room and marks it closed', () => {
    const room = createFourPlayerRoom();

    expect(() => closeRoom(room, 'p2')).toThrow('Only the host');
    expect(closeRoom(room, 'host')).toMatchObject({ status: 'closed' });
  });
});
