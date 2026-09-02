import { z } from 'zod';
import type { GamePhase } from './game-presets.js';

export const SOCKET_EVENTS = {
  connectionState: 'connection:state',
  gamePrivateRole: 'game:private-role',
  gamePublicState: 'game:public-state',
  gameMafiaTarget: 'game:mafia-target',
  gameDoctorProtect: 'game:doctor-protect',
  gamePoliceInvestigate: 'game:police-investigate',
  gamePrivateInvestigation: 'game:private-investigation',
  gameDayVote: 'game:day-vote',
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  roomClose: 'room:close',
  roomRematch: 'room:rematch',
  roomStart: 'room:start',
  roomState: 'room:state'
} as const;

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(60),
  maxPlayers: z.number().int().min(4).max(20),
  timerSeconds: z.number().int().min(10).max(600),
  nickname: z.string().trim().min(1).max(12)
});

export const joinRoomSchema = z.object({
  roomId: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/),
  inviteToken: z.string().trim().length(32).regex(/^[a-f0-9]+$/),
  nickname: z.string().trim().min(1).max(20)
});

export const startRoomSchema = z.object({
  roomId: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/)
});

export const closeRoomSchema = startRoomSchema;
export const rematchRoomSchema = startRoomSchema;

export const mafiaTargetSchema = z.object({
  roomId: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/),
  targetPlayerId: z.string().trim().min(1).max(128)
});

export const doctorProtectSchema = z.object({
  roomId: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/),
  targetPlayerId: z.string().trim().min(1).max(128)
});

export const policeInvestigateSchema = z.object({
  roomId: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/),
  targetPlayerId: z.string().trim().min(1).max(128)
});

export const dayVoteSchema = z.object({
  roomId: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/),
  targetPlayerId: z.string().trim().min(1).max(128)
});

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export interface RoomSummary {
  code: string;
  name: string;
  maxPlayers: number;
  timerSeconds: number;
  status: 'lobby' | 'in-game' | 'closed';
  playerCount: number;
}

export interface PublicRoomPlayer {
  id: string;
  nickname: string;
  status: 'active' | 'resigned';
  isHost: boolean;
}

export interface PublicRoomState extends RoomSummary {
  players: readonly PublicRoomPlayer[];
}

export interface PublicGamePlayer {
  id: string;
  nickname: string;
  status: 'alive' | 'dead' | 'resigned';
  isHost: boolean;
}

export interface PublicGameState {
  roomCode: string;
  revision: number;
  phase: GamePhase;
  phaseEndsAt: string | null;
  players: readonly PublicGamePlayer[];
  voteTotals?: Record<string, number>;
  eliminatedPlayerId?: string | null;
  winner?: 'mafia' | 'citizens';
}

export interface PrivateRole {
  role: 'mafia' | 'doctor' | 'police' | 'citizen';
  mafiaPlayerIds?: readonly string[];
}

export type CreateRoomResponse =
  | { ok: true; room: RoomSummary; inviteToken: string }
  | { ok: false; code: 'invalid-payload' | 'room-unavailable' };

export type JoinRoomResponse =
  | {
      ok: true;
      room: RoomSummary;
      nickname: string;
      sessionId: string;
    }
  | {
      ok: false;
      code: 'invalid-payload' | 'room-not-found' | 'room-rejected';
    };

export type StartRoomResponse =
  | { ok: true; room: RoomSummary }
  | { ok: false; code: 'invalid-payload' | 'room-not-found' | 'room-rejected' };

export type CloseRoomResponse =
  | { ok: true }
  | { ok: false; code: 'invalid-payload' | 'room-not-found' | 'room-rejected' };

export type GameCommandResponse =
  | { ok: true }
  | { ok: false; code: 'invalid-payload' | 'game-not-found' | 'command-rejected' };

export interface ClientToServerEvents {
  'room:create': (
    payload: unknown,
    acknowledge: (response: CreateRoomResponse) => void
  ) => void;
  'room:join': (
    payload: unknown,
    acknowledge: (response: JoinRoomResponse) => void
  ) => void;
  'room:start': (
    payload: unknown,
    acknowledge: (response: StartRoomResponse) => void
  ) => void;
  'room:close': (
    payload: unknown,
    acknowledge: (response: CloseRoomResponse) => void
  ) => void;
  'room:rematch': (
    payload: unknown,
    acknowledge: (response: StartRoomResponse) => void
  ) => void;
  'game:mafia-target': (
    payload: unknown,
    acknowledge: (response: GameCommandResponse) => void
  ) => void;
  'game:doctor-protect': (
    payload: unknown,
    acknowledge: (response: GameCommandResponse) => void
  ) => void;
  'game:police-investigate': (
    payload: unknown,
    acknowledge: (response: GameCommandResponse) => void
  ) => void;
  'game:day-vote': (
    payload: unknown,
    acknowledge: (response: GameCommandResponse) => void
  ) => void;
}

export interface ServerToClientEvents {
  'connection:state': (payload: { status: 'connected'; sessionId: string }) => void;
  'room:state': (payload: PublicRoomState) => void;
  'game:public-state': (payload: PublicGameState) => void;
  'game:private-role': (payload: PrivateRole) => void;
  'game:private-investigation': (payload: { targetPlayerId: string; alignment: 'mafia' | 'citizen' }) => void;
}
