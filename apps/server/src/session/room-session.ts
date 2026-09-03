export type RoomStatus = 'lobby' | 'in-game' | 'closed';
export type ParticipantStatus = 'active' | 'resigned';

export interface RoomParticipant {
  id: string;
  nickname: string;
  status: ParticipantStatus;
  isHost: boolean;
}

export interface RoomSession {
  code: string;
  inviteToken: string;
  name: string;
  maxPlayers: number;
  timerSeconds: number;
  status: RoomStatus;
  players: readonly RoomParticipant[];
}

export interface CreateRoomInput {
  code: string;
  inviteToken: string;
  name: string;
  timerSeconds: number;
  host: { id: string; nickname: string };
}

export function createRoom(input: CreateRoomInput): RoomSession {
  if (!input.code.trim()) {
    throw new Error('Room code is required.');
  }
  if (!/^[a-f0-9]{32}$/.test(input.inviteToken)) {
    throw new Error('Room invite token must be a 32-character hexadecimal string.');
  }
  if (!input.name.trim()) {
    throw new Error('Room name is required.');
  }
  if (!Number.isInteger(input.timerSeconds) || input.timerSeconds < 10) {
    throw new Error('Timer must be at least 10 seconds.');
  }

  return {
    code: input.code,
    inviteToken: input.inviteToken,
    name: input.name.trim(),
    maxPlayers: MAX_GAME_PLAYERS,
    timerSeconds: input.timerSeconds,
    status: 'lobby',
    players: [{ ...input.host, nickname: normalizeNickname(input.host.nickname), status: 'active', isHost: true }]
  };
}

export function joinRoom(
  room: RoomSession,
  participant: { id: string; nickname: string }
): RoomSession {
  if (room.status !== 'lobby') {
    throw new Error('The game has already started.');
  }

  const existing = room.players.find((player) => player.id === participant.id);
  if (existing?.status === 'resigned') {
    throw new Error('A resigned player cannot rejoin.');
  }
  if (existing) {
    throw new Error('This player already joined the room.');
  }
  if (room.players.filter((player) => player.status === 'active').length >= room.maxPlayers) {
    throw new Error('The room is full.');
  }

  return {
    ...room,
    players: [
      ...room.players,
      { id: participant.id, nickname: normalizeNickname(participant.nickname), status: 'active', isHost: false }
    ]
  };
}

export function resignPlayer(room: RoomSession, playerId: string): RoomSession {
  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error('Player is not in this room.');
  }

  const nextHostId = player.isHost
    ? room.players.find((candidate) => candidate.id !== playerId && candidate.status === 'active')?.id
    : undefined;

  return {
    ...room,
    players: room.players.map((candidate) =>
      candidate.id === playerId
        ? { ...candidate, status: 'resigned', isHost: false }
        : candidate.id === nextHostId
          ? { ...candidate, isHost: true }
          : candidate
    )
  };
}

export function startRoom(room: RoomSession, playerId: string): RoomSession {
  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player?.isHost || player.status !== 'active') {
    throw new Error('Only the host can start the game.');
  }
  if (room.status !== 'lobby') {
    throw new Error('The game has already started.');
  }
  if (room.players.filter((candidate) => candidate.status === 'active').length < MIN_GAME_PLAYERS) {
    throw new Error(`At least ${MIN_GAME_PLAYERS} active players are required.`);
  }

  return { ...room, status: 'in-game' };
}

export function closeRoom(room: RoomSession, playerId: string): RoomSession {
  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player?.isHost || player.status !== 'active') {
    throw new Error('Only the host can close the room.');
  }

  return { ...room, status: 'closed' };
}

function normalizeNickname(nickname: string): string {
  const normalized = nickname.trim();
  if (normalized.length < 1 || normalized.length > 12) {
    throw new Error('Nickname must be from 1 to 12 characters.');
  }
  return normalized;
}
import { MAX_GAME_PLAYERS, MIN_GAME_PLAYERS } from '@marfia/contracts/game-presets';
