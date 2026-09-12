import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Server, type Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  closeRoomSchema,
  createRoomSchema,
  dayVoteSchema,
  doctorProtectSchema,
  joinRoomSchema,
  leaveRoomSchema,
  mafiaTargetSchema,
  policeInvestigateSchema,
  rejoinRoomSchema,
  rematchRoomSchema,
  returnToLobbySchema,
  skipPhaseSchema,
  startRoomSchema,
  type ClientToServerEvents,
  type PublicGameState,
  type PrivateRole,
  type PublicRoomState,
  type RoomSummary,
  type RejoinRoomResponse,
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
  random?: () => number;
  scheduleReconnectExpiry?: (callback: () => void, delayMs: number) => void;
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
    connectionStateRecovery: {
      maxDisconnectionDuration: 60_000,
      skipMiddlewares: false
    },
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
  const random = options.random ?? Math.random;
  const pendingReconnects = new Map<string, true>();
  const scheduleReconnectExpiry = options.scheduleReconnectExpiry
    ?? ((callback: () => void, delayMs: number) => {
      const timer = setTimeout(callback, delayMs);
      timer.unref();
      return timer;
    });

  const clearReconnectExpiry = (playerId: string) => {
    pendingReconnects.delete(playerId);
  };

  const deferResignation = (playerId: string) => {
    clearReconnectExpiry(playerId);
    pendingReconnects.set(playerId, true);
    const expire = () => {
      if (!pendingReconnects.has(playerId)) {
        return;
      }
      pendingReconnects.delete(playerId);
      const room = rooms.resign(playerId);
      if (room) {
        publishResignation(room, playerId);
      }
    };
    scheduleReconnectExpiry(expire, 60_000);
  };

  const playerIdForRoom = (socketId: string, roomId: string): string | undefined => {
    const participant = rooms.findParticipantBySocketId(socketId);
    return participant?.room.code === roomId ? participant.playerId : undefined;
  };

  const advanceRoomPhase = (room: RoomSession, current: GameState, revision: number) => {
    const next = shouldResolveNight(current)
      ? resolveNight(current)
      : current.phase === 'day-briefing'
        ? beginDayVote(current)
        : current.phase === 'day-vote' || current.phase === 'day-revote'
          ? resolveDayVote(current)
          : advanceGamePhase(current);
    games.set(room.code, next);
    const nextRevision = revision + 1;
    revisions.set(room.code, nextRevision);
    const nextPhaseDelayMs = next.phase === 'result' ? null : phaseDelayMs(room, next, random);
    const nextPhaseEndsAt = nextPhaseDelayMs === null ? null : now() + nextPhaseDelayMs;
    phaseEndsAt.set(room.code, nextPhaseEndsAt);
    io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, next, nextRevision, nextPhaseEndsAt));

    if (next.phase !== 'result') {
      scheduleNextPhase(room, nextRevision, nextPhaseDelayMs ?? undefined);
    }
  };

  const scheduleNextPhase = (room: RoomSession, revision: number, delayMs = room.timerSeconds * 1000) => {
    schedule(() => {
      if (revisions.get(room.code) !== revision) {
        return;
      }

      const current = games.get(room.code);
      if (!current) {
        return;
      }

      advanceRoomPhase(room, current, revision);
    }, delayMs);
  };

  const advanceAfterAllRequiredSubmissions = (room: RoomSession, game: GameState) => {
    if (!hasAllRequiredSubmissions(game)) {
      return;
    }

    const revision = revisions.get(room.code);
    if (revision === undefined) {
      return;
    }
    advanceRoomPhase(room, game, revision);
  };

  const publishResignation = (room: RoomSession, playerId: string) => {
    io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
    const game = games.get(room.code);
    if (!game) {
      return;
    }

    const resignedGame = resignGamePlayer(game, playerId);
    games.set(room.code, resignedGame);
    const revision = (revisions.get(room.code) ?? 0) + 1;
    revisions.set(room.code, revision);
    const nextDelayMs = phaseDelayMs(room, resignedGame, random);
    const nextPhaseEndsAt = resignedGame.phase === 'result' ? null : now() + nextDelayMs;
    phaseEndsAt.set(room.code, nextPhaseEndsAt);
    io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(
      room,
      resignedGame,
      revision,
      nextPhaseEndsAt
    ));
    if (resignedGame.phase !== 'result') {
      scheduleNextPhase(room, revision, nextDelayMs);
    }
  };

  const beginPoliceResultDisplay = (room: RoomSession, game: GameState) => {
    const revision = (revisions.get(room.code) ?? 0) + 1;
    const resultDisplayDelayMs = 5_000;
    const endsAt = now() + resultDisplayDelayMs;
    revisions.set(room.code, revision);
    phaseEndsAt.set(room.code, endsAt);
    io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, game, revision, endsAt));
    scheduleNextPhase(room, revision, resultDisplayDelayMs);
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
      if (player.socketId) {
        io.to(player.socketId).emit(SOCKET_EVENTS.gamePrivateRole, payload);
      }
    }
  };

  const synchronizeParticipant = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    room: RoomSession,
    playerId: string
  ) => {
    socket.emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
    const game = games.get(room.code);
    const revision = revisions.get(room.code);
    if (!game || revision === undefined) {
      return;
    }
    socket.emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, game, revision, phaseEndsAt.get(room.code) ?? null));
    const role = game.roleAssignments[playerId];
    if (!role) {
      return;
    }
    const mafiaPlayerIds = Object.entries(game.roleAssignments)
      .filter(([, assignedRole]) => assignedRole === 'mafia')
      .map(([assignedPlayerId]) => assignedPlayerId);
    socket.emit(SOCKET_EVENTS.gamePrivateRole, role === 'mafia' ? { role, mafiaPlayerIds } : { role });
  };

  io.on('connection', (socket) => {
    socket.emit(SOCKET_EVENTS.connectionState, {
      status: 'connected',
      sessionId: socket.id
    });
    if (socket.recovered) {
      const participant = rooms.findParticipantBySocketId(socket.id);
      if (participant) {
        clearReconnectExpiry(participant.playerId);
        synchronizeParticipant(socket, participant.room, participant.playerId);
      }
    }

    socket.on(SOCKET_EVENTS.roomCreate, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const roomInput = {
          name: parsed.data.name,
          nickname: parsed.data.nickname,
          timerSeconds: parsed.data.timerSeconds
        };
        const reconnectToken = randomBytes(16).toString('hex');
        const room = rooms.create({
          ...roomInput,
          host: { id: socket.id, socketId: socket.id, reconnectToken, nickname: roomInput.nickname }
        });
        socket.join(room.code);
        respond({ ok: true, room: toRoomSummary(room), inviteToken: room.inviteToken, reconnectToken, playerId: socket.id });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
      } catch {
        respond({ ok: false, code: 'room-unavailable' });
      }
    });

    socket.on(SOCKET_EVENTS.roomJoin, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const reconnectToken = randomBytes(16).toString('hex');
        const room = rooms.join(parsed.data.roomId, {
          id: socket.id,
          socketId: socket.id,
          reconnectToken,
          nickname: parsed.data.nickname
        });
        if (!room) {
          respond({ ok: false, code: 'room-not-found' });
          return;
        }

        socket.join(room.code);
        respond({
          ok: true,
          room: toRoomSummary(room),
          nickname: parsed.data.nickname.trim(),
          sessionId: socket.id,
          reconnectToken,
          playerId: socket.id
        });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
      } catch {
        respond({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.roomRejoin, (payload, acknowledge) => {
      const respond = safelyAcknowledge<RejoinRoomResponse>(acknowledge);
      const parsed = rejoinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const current = rooms.get(parsed.data.roomId);
      const player = current?.players.find((candidate) => candidate.reconnectToken === parsed.data.reconnectToken);
      if (!current || !player) {
        respond({ ok: false, code: 'room-not-found' });
        return;
      }
      if (!pendingReconnects.has(player.id)) {
        respond({ ok: false, code: 'room-rejected' });
        return;
      }

      try {
        const room = rooms.rejoin(parsed.data.roomId, { reconnectToken: parsed.data.reconnectToken, socketId: socket.id });
        if (!room) {
          respond({ ok: false, code: 'room-not-found' });
          return;
        }
        clearReconnectExpiry(player.id);
        socket.join(room.code);
        respond({ ok: true, room: toRoomSummary(room), nickname: player.nickname, playerId: player.id });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
        synchronizeParticipant(socket, room, player.id);
      } catch {
        respond({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.roomStart, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = startRoomSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const room = rooms.start(parsed.data.roomId, playerIdForRoom(socket.id, parsed.data.roomId) ?? '');
        if (!room) {
          respond({ ok: false, code: 'room-not-found' });
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
        respond({ ok: true, room: toRoomSummary(room) });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
        io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, game, 1, initialPhaseEndsAt));
        sendPrivateRoles(room, game);
        scheduleNextPhase(room, 1);
      } catch {
        respond({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gameSkipPhase, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = skipPhaseSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const room = rooms.get(parsed.data.roomId);
      const game = games.get(parsed.data.roomId);
      const revision = revisions.get(parsed.data.roomId);
      const requester = room?.players.find((player) => player.id === playerIdForRoom(socket.id, parsed.data.roomId));
      if (!room || !game || revision === undefined) {
        respond({ ok: false, code: 'game-not-found' });
        return;
      }
      if (!requester?.isHost || requester.status !== 'active' || game.phase === 'result') {
        respond({ ok: false, code: 'command-rejected' });
        return;
      }
      if (revision !== parsed.data.expectedRevision) {
        respond({ ok: false, code: 'command-rejected' });
        return;
      }

      advanceRoomPhase(room, game, revision);
      respond({ ok: true });
    });

    socket.on(SOCKET_EVENTS.roomClose, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = closeRoomSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      try {
        const room = rooms.close(parsed.data.roomId, playerIdForRoom(socket.id, parsed.data.roomId) ?? '');
        if (!room) {
          respond({ ok: false, code: 'room-not-found' });
          return;
        }

        games.delete(room.code);
        revisions.delete(room.code);
        phaseEndsAt.delete(room.code);
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
        respond({ ok: true });
      } catch {
        respond({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.roomReturnToLobby, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = returnToLobbySchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const game = games.get(parsed.data.roomId);
      if (!game) {
        respond({ ok: false, code: 'room-not-found' });
        return;
      }
      if (game.phase !== 'result') {
        respond({ ok: false, code: 'room-rejected' });
        return;
      }

      try {
        const room = rooms.returnToLobby(parsed.data.roomId, playerIdForRoom(socket.id, parsed.data.roomId) ?? '');
        if (!room) {
          respond({ ok: false, code: 'room-not-found' });
          return;
        }
        games.delete(room.code);
        revisions.delete(room.code);
        phaseEndsAt.delete(room.code);
        respond({ ok: true, room: toRoomSummary(room) });
        io.to(room.code).emit(SOCKET_EVENTS.roomState, toPublicRoomState(room));
      } catch {
        respond({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.roomLeave, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = leaveRoomSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const requestedRoom = rooms.get(parsed.data.roomId);
      const playerId = playerIdForRoom(socket.id, parsed.data.roomId);
      if (!requestedRoom || !playerId) {
        respond({ ok: false, code: 'room-not-found' });
        return;
      }
      const room = rooms.resign(playerId);
      if (!room) {
        respond({ ok: false, code: 'room-not-found' });
        return;
      }
      socket.leave(room.code);
      publishResignation(room, playerId);
      respond({ ok: true });
    });

    socket.on(SOCKET_EVENTS.roomRematch, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = rematchRoomSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const room = rooms.get(parsed.data.roomId);
      const previousGame = games.get(parsed.data.roomId);
      const requester = room?.players.find((player) => player.id === playerIdForRoom(socket.id, parsed.data.roomId));
      if (!room || !previousGame) {
        respond({ ok: false, code: 'room-not-found' });
        return;
      }
      if (!requester?.isHost || requester.status !== 'active' || previousGame.phase !== 'result') {
        respond({ ok: false, code: 'room-rejected' });
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
        respond({ ok: true, room: toRoomSummary(room) });
        io.to(room.code).emit(SOCKET_EVENTS.gamePublicState, toPublicGameState(room, game, revision, initialPhaseEndsAt));
        sendPrivateRoles(room, game);
        scheduleNextPhase(room, revision);
      } catch {
        respond({ ok: false, code: 'room-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gameMafiaTarget, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = mafiaTargetSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const room = rooms.get(parsed.data.roomId);
      const game = games.get(parsed.data.roomId);
      if (!room || !game) {
        respond({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        const playerId = playerIdForRoom(socket.id, parsed.data.roomId);
        if (!playerId) throw new Error('Player is not connected to this room.');
        const updated = submitMafiaVote(game, playerId, parsed.data.targetPlayerId);
        games.set(parsed.data.roomId, updated);
        advanceAfterAllRequiredSubmissions(room, updated);
        respond({ ok: true });
      } catch {
        respond({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gameDoctorProtect, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = doctorProtectSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const room = rooms.get(parsed.data.roomId);
      const game = games.get(parsed.data.roomId);
      if (!room || !game) {
        respond({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        const playerId = playerIdForRoom(socket.id, parsed.data.roomId);
        if (!playerId) throw new Error('Player is not connected to this room.');
        const updated = submitDoctorProtection(game, playerId, parsed.data.targetPlayerId);
        games.set(parsed.data.roomId, updated);
        advanceAfterAllRequiredSubmissions(room, updated);
        respond({ ok: true });
      } catch {
        respond({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gamePoliceInvestigate, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = policeInvestigateSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const room = rooms.get(parsed.data.roomId);
      const game = games.get(parsed.data.roomId);
      if (!room || !game) {
        respond({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        const playerId = playerIdForRoom(socket.id, parsed.data.roomId);
        if (!playerId) throw new Error('Player is not connected to this room.');
        const updated = submitPoliceInvestigation(game, playerId, parsed.data.targetPlayerId);
        games.set(parsed.data.roomId, updated);
        const result = updated.policeResult;
        if (!result) {
          throw new Error('Police investigation did not produce a result.');
        }
        socket.emit(SOCKET_EVENTS.gamePrivateInvestigation, {
          targetPlayerId: result.targetId,
          alignment: result.alignment
        });
        beginPoliceResultDisplay(room, updated);
        respond({ ok: true });
      } catch {
        respond({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on(SOCKET_EVENTS.gameDayVote, (payload, acknowledge) => {
      const respond = safelyAcknowledge(acknowledge);
      const parsed = dayVoteSchema.safeParse(payload);
      if (!parsed.success) {
        respond({ ok: false, code: 'invalid-payload' });
        return;
      }

      const room = rooms.get(parsed.data.roomId);
      const game = games.get(parsed.data.roomId);
      if (!room || !game) {
        respond({ ok: false, code: 'game-not-found' });
        return;
      }

      try {
        const playerId = playerIdForRoom(socket.id, parsed.data.roomId);
        if (!playerId) throw new Error('Player is not connected to this room.');
        const updated = submitDayVote(game, playerId, parsed.data.targetPlayerId);
        games.set(parsed.data.roomId, updated);
        advanceAfterAllRequiredSubmissions(room, updated);
        respond({ ok: true });
      } catch {
        respond({ ok: false, code: 'command-rejected' });
      }
    });

    socket.on('disconnect', () => {
      const participant = rooms.findParticipantBySocketId(socket.id);
      if (participant) {
        deferResignation(participant.playerId);
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

function hasAllRequiredSubmissions(game: GameState): boolean {
  const activePlayerIds = game.players
    .map((player) => player.id)
    .filter((playerId) => !game.eliminatedPlayerIds.includes(playerId) && !game.resignedPlayerIds.includes(playerId));

  if (game.phase === 'night-mafia') {
    const activeMafiaIds = activePlayerIds.filter((playerId) => game.roleAssignments[playerId] === 'mafia');
    return activeMafiaIds.length > 0 && activeMafiaIds.every((playerId) => Boolean(game.mafiaVotes[playerId]));
  }
  if (game.phase === 'night-doctor') {
    return activePlayerIds.some((playerId) => game.roleAssignments[playerId] === 'doctor')
      && Boolean(game.doctorTargetId);
  }
  if (game.phase === 'night-police') {
    return activePlayerIds.some((playerId) => game.roleAssignments[playerId] === 'police')
      && Boolean(game.policeResult);
  }
  if (game.phase === 'day-vote' || game.phase === 'day-revote') {
    return activePlayerIds.length > 0 && activePlayerIds.every((playerId) => Boolean(game.dayVotes[playerId]));
  }

  return false;
}

function phaseDelayMs(room: RoomSession, game: GameState, random: () => number): number {
  if ((game.phase === 'night-doctor' && !hasActiveRole(game, 'doctor'))
    || (game.phase === 'night-police' && !hasActiveRole(game, 'police'))) {
    return (20 + Math.floor(random() * 11)) * 1_000;
  }

  return room.timerSeconds * 1_000;
}

function hasActiveRole(game: GameState, role: 'doctor' | 'police'): boolean {
  return game.players.some((player) =>
    game.roleAssignments[player.id] === role
    && !game.eliminatedPlayerIds.includes(player.id)
    && !game.resignedPlayerIds.includes(player.id)
  );
}

function safelyAcknowledge<T>(
  acknowledge: ((response: T) => void) | undefined
): (response: T) => void {
  return typeof acknowledge === 'function' ? acknowledge : () => undefined;
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
  if (game.dayVoteResult && (
    game.phase === 'day-revote'
    || game.phase === 'night-mafia'
    || (game.phase === 'result' && !game.nightResult)
  )) {
    publicState.voteTotals = game.dayVoteResult.voteTotals;
    publicState.eliminatedPlayerId = game.dayVoteResult.eliminatedPlayerId;
  }
  if (game.dayElimination && (game.phase === 'night-mafia' || (game.phase === 'result' && !game.nightResult))) {
    publicState.dayElimination = game.dayElimination;
  }
  if (game.nightResult && (game.phase === 'day-briefing' || game.phase === 'result')) {
    publicState.eliminatedPlayerId = game.nightResult.eliminatedPlayerId;
    publicState.nightResult = {
      mafiaTargetPlayerId: game.nightResult.mafiaTargetId,
      doctorTargetPlayerId: game.nightResult.doctorTargetId,
      eliminatedPlayerId: game.nightResult.eliminatedPlayerId
    };
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
