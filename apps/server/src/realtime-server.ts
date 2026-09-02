import { createServer } from 'node:http';
import { once } from 'node:events';
import { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  closeRoomSchema,
  createRoomSchema,
  dayVoteSchema,
  doctorProtectSchema,
  joinRoomSchema,
  mafiaTargetSchema,
  policeInvestigateSchema,
  rematchRoomSchema,
  startRoomSchema,
  type ClientToServerEvents,
  type PublicGameState,
  type PrivateRole,
  type PublicRoomState,
  type RoomSummary,
  type ServerToClientEvents
} from '@marfia/contracts/socket-events';
import { RoomStore } from './session/room-store.js';
import type { RoomSession } from './session/room-session.js';
import { advanceGamePhase, beginDayVote, createGame, resignGamePlayer, resolveDayVote, resolveNight, startGame, submitDayVote, submitDoctorProtection, submitMafiaVote, submitPoliceInvestigation, type GameState } from './game/game-engine.js';

export interface RealtimeServer {
  url: string;
  close(): Promise<void>;
}

export interface RealtimeServerOptions {
  host?: string;
  port?: number;
  corsOrigin?: string | readonly string[];
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => void;
}

export async function createRealtimeServer(
  options: RealtimeServerOptions = {}
): Promise<RealtimeServer> {
  const httpServer = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    response.writeHead(404);
    response.end();
  });
  const allowedOrigins = toAllowedOrigins(options.corsOrigin);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: options.corsOrigin === undefined
        ? true
        : typeof options.corsOrigin === 'string'
          ? options.corsOrigin
          : [...options.corsOrigin]
    },
    allowRequest: allowedOrigins
      ? (request, callback) => callback(null, request.headers.origin === undefined || allowedOrigins.has(request.headers.origin))
      : undefined
  });
  const rooms = new RoomStore();
  const games = new Map<string, GameState>();
  const revisions = new Map<string, number>();
  const phaseEndsAt = new Map<string, number | null>();
  const schedule = options.schedule ?? ((callback, delayMs) => { setTimeout(callback, delayMs); });
  const now = options.now ?? Date.now;

  const scheduleNextPhase = (room: RoomSession, revision: number) => {
    schedule(() => {
      const current = games.get(room.code);
      if (!current) {
        return;
      }

      const next = shouldResolveNight(current)
        ? resolveNight(current)
        : current.phase === 'day-briefing'
          ? beginDayVote(current)
          : current.phase === 'day-vote' || current.phase === 'day-revote'
            ? resolveDayVote(current)
            : advanceGamePhase(current);
      games.set(room.code, next);
      const nextRevision = (revisions.get(room.code) ?? revision) + 1;
      revisions.set(room.code, nextRevision);
      const nextPhaseEndsAt = next.phase === 'result' ? null : now() + room.timerSeconds * 1000;
      phaseEndsAt.set(room.code, nextPhaseEndsAt);
      io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, next, nextRevision, nextPhaseEndsAt));

      if (next.phase !== 'result') {
        scheduleNextPhase(room, nextRevision);
      }
    }, room.timerSeconds * 1000);
  };

  const sendPrivateRoles = (room: RoomSession, game: GameState) => {
    const mafiaPlayerIds = Object.entries(game.roleAssignments)
      .filter(([, role]) => role === 'mafia')
      .map(([playerId]) => playerId);

    for (const player of room.players) {
      const role = game.roleAssignments[player.id];
      if (player.status !== 'active' || !role) {
        continue;
      }

      const payload: PrivateRole = role === 'mafia'
        ? { role, mafiaPlayerIds }
        : { role };
      io.to(player.id).emit(SOCKET_EVENTS.gamePrivateRole, payload);
    }
  };

  io.on('connection', (socket) => {
    socket.emit(SOCKET_EVENTS.connectionState, {
      status: 'connected',
      sessionId: socket.id
    });

    socket.on(SOCKET_EVENTS.roomCreate, (payload, acknowledge) => {
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const room = rooms.create({ ...parsed.data, host: { id: socket.id, nickname: parsed.data.nickname } });
        socket.join(room.code);
        acknowledge({ ok: true, room: toRoomSummary(room), inviteToken: room.inviteToken });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
      } catch {
        acknowledge({ ok: false, code: 'room-unavailable' });
      }
    });

    socket.on(SOCKET_EVENTS.roomJoin, (payload, acknowledge) => {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const room = rooms.join(parsed.data.roomId, {
          id: socket.id,
          nickname: parsed.data.nickname,
          inviteToken: parsed.data.inviteToken
        });
        if (!room) {
          acknowledge({ ok: false, code: 'room-not-found' });
          return;
        }

        socket.join(room.code);
        acknowledge({
          ok: true,
          room: toRoomSummary(room),
          nickname: parsed.data.nickname.trim(),
          sessionId: socket.id
        });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
      } catch {
        acknowledge({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.roomStart, (payload, acknowledge) => {
      const parsed = startRoomSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const room = rooms.start(parsed.data.roomId, socket.id);
        if (!room) {
          acknowledge({ ok: false, code: 'room-not-found' });
          return;
        }

        const game = startGame(createGame({
          roomId: room.code,
          players: room.players
            .filter((player) => player.status === 'active')
            .map((player) => ({ id: player.id, name: player.nickname }))
        }));
        games.set(room.code, game);
        revisions.set(room.code, 1);
        const initialPhaseEndsAt = now() + room.timerSeconds * 1000;
        phaseEndsAt.set(room.code, initialPhaseEndsAt);
        acknowledge({ ok: true, room: toRoomSummary(room) });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
        io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, game, 1, initialPhaseEndsAt));
        sendPrivateRoles(room, game);
        scheduleNextPhase(room, 1);
      } catch {
        acknowledge({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.roomClose, (payload, acknowledge) => {
      const parsed = closeRoomSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const room = rooms.close(parsed.data.roomId, socket.id);
        if (!room) {
          acknowledge({ ok: false, code: 'room-not-found' });
          return;
        }

        games.delete(room.code);
        revisions.delete(room.code);
        phaseEndsAt.delete(room.code);
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
        acknowledge({ ok: true });
      } catch {
        acknowledge({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.roomRematch, (payload, acknowledge) => {
      const parsed = rematchRoomSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      const room = rooms.get(parsed.data.roomId);
      const previousGame = games.get(parsed.data.roomId);
      const requester = room?.players.find((player) => player.id === socket.id);
      if (!room || !previousGame) {
        acknowledge({ ok: false, code: 'room-not-found' });
        return;
      }
      if (!requester?.isHost || previousGame.phase !== 'result') {
        acknowledge({ ok: false, code: 'room-rejected' });
        return;
      }

      try {
        const game = startGame(createGame({
          roomId: room.code,
          players: room.players
            .filter((player) => player.status === 'active')
            .map((player) => ({ id: player.id, name: player.nickname }))
        }));
        const revision = (revisions.get(room.code) ?? 0) + 1;
        games.set(room.code, game);
        revisions.set(room.code, revision);
        const initialPhaseEndsAt = now() + room.timerSeconds * 1000;
        phaseEndsAt.set(room.code, initialPhaseEndsAt);
        acknowledge({ ok: true, room: toRoomSummary(room) });
        io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, game, revision, initialPhaseEndsAt));
        sendPrivateRoles(room, game);
        scheduleNextPhase(room, revision);
      } catch {
        acknowledge({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gameMafiaTarget, (payload, acknowledge) => {
      const parsed = mafiaTargetSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      const game = games.get(parsed.data.roomId);
      if (!game) {
        acknowledge({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        games.set(parsed.data.roomId, submitMafiaVote(game, socket.id, parsed.data.targetPlayerId));
        acknowledge({ ok: true });
      } catch {
        acknowledge({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gameDoctorProtect, (payload, acknowledge) => {
      const parsed = doctorProtectSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      const game = games.get(parsed.data.roomId);
      if (!game) {
        acknowledge({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        games.set(parsed.data.roomId, submitDoctorProtection(game, socket.id, parsed.data.targetPlayerId));
        acknowledge({ ok: true });
      } catch {
        acknowledge({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gamePoliceInvestigate, (payload, acknowledge) => {
      const parsed = policeInvestigateSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      const game = games.get(parsed.data.roomId);
      if (!game) {
        acknowledge({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        const updated = submitPoliceInvestigation(game, socket.id, parsed.data.targetPlayerId);
        games.set(parsed.data.roomId, updated);
        const result = updated.policeResult;
        if (!result) {
          throw new Error('Police investigation did not produce a result.');
        }
        socket.emit(SOCKET_EVENTS.gamePrivateInvestigation, {
          targetPlayerId: result.targetId,
          alignment: result.alignment
        });
        acknowledge({ ok: true });
      } catch {
        acknowledge({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gameDayVote, (payload, acknowledge) => {
      const parsed = dayVoteSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'invalid-payload' });
        return;
      }

      const game = games.get(parsed.data.roomId);
      if (!game) {
        acknowledge({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        games.set(parsed.data.roomId, submitDayVote(game, socket.id, parsed.data.targetPlayerId));
        acknowledge({ ok: true });
      } catch {
        acknowledge({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on('disconnect', () => {
      const room = rooms.resign(socket.id);
      if (room) {
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
        const game = games.get(room.code);
        if (game) {
          const resignedGame = resignGamePlayer(game, socket.id);
          games.set(room.code, resignedGame);
          const revision = (revisions.get(room.code) ?? 0) + 1;
          revisions.set(room.code, revision);
          io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(
            room,
            resignedGame,
            revision,
            phaseEndsAt.get(room.code) ?? null
          ));
        }
      }
    });
  });

  httpServer.listen(options.port ?? 0, options.host ?? '127.0.0.1');
  await once(httpServer, 'listening');

  const address = httpServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Realtime server did not expose a TCP address.');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        io.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}

function shouldResolveNight(game: GameState): boolean {
  if (game.phase === 'night-police') {
    return true;
  }

  if (game.phase === 'night-doctor') {
    return game.preset?.police === 0;
  }

  return game.phase === 'night-mafia'
    && game.preset?.doctor === 0
    && game.preset?.police === 0;
}

function toAllowedOrigins(origin: string | readonly string[] | undefined): Set<string> | undefined {
  if (!origin) {
    return undefined;
  }

  return new Set(typeof origin === 'string' ? [origin] : origin);
}

function toPublicGameState(
  room: RoomSession,
  game: GameState,
  revision: number,
  phaseEndTime: number | null
): PublicGameState {
  if (!game.phase) {
    throw new Error('A public game state requires a started game.');
  }

  const publicState: PublicGameState = {
    roomCode: room.code,
    revision,
    phase: game.phase,
    phaseEndsAt: phaseEndTime === null ? null : new Date(phaseEndTime).toISOString(),
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      status: game.resignedPlayerIds.includes(player.id)
        ? 'resigned'
        : game.eliminatedPlayerIds.includes(player.id)
          ? 'dead'
          : 'alive',
      isHost: player.isHost
    }))
  };
  if (game.dayVoteResult && (game.phase === 'night-mafia' || (game.phase === 'result' && !game.nightResult))) {
    publicState.voteTotals = game.dayVoteResult.voteTotals;
    publicState.eliminatedPlayerId = game.dayVoteResult.eliminatedPlayerId;
  }
  if (game.nightResult && (game.phase === 'day-briefing' || game.phase === 'result')) {
    publicState.eliminatedPlayerId = game.nightResult.eliminatedPlayerId;
  }
  if (game.winner) {
    publicState.winner = game.winner;
  }
  return publicState;
}

function toRoomSummary(room: RoomSession): RoomSummary {
  return {
    code: room.code,
    name: room.name,
    maxPlayers: room.maxPlayers,
    timerSeconds: room.timerSeconds,
    status: room.status,
    playerCount: room.players.filter((player) => player.status === 'active').length
  };
}

function toPublicRoomState(room: RoomSession): PublicRoomState {
  return {
    ...toRoomSummary(room),
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      status: player.status,
      isHost: player.isHost
    }))
  };
}
