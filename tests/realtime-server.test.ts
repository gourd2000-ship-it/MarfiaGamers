import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient } from 'socket.io-client';
import { createRealtimeServer } from '../apps/server/src/realtime-server.js';
import {
  SOCKET_EVENTS,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type PrivateRole,
  type PublicGameState,
  type PublicRoomState,
  type ReturnToLobbyResponse,
  type StartRoomResponse,
  type CloseRoomResponse,
  type GameCommandResponse
} from '../packages/contracts/src/socket-events.js';

const servers: Awaited<ReturnType<typeof createRealtimeServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('createRealtimeServer', () => {
  it('allows only the configured web origin to establish browser transport requests', async () => {
    const server = await createRealtimeServer({ corsOrigin: 'https://game.school.example' });
    servers.push(server);

    const allowed = await fetch(`${server.url}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: 'https://game.school.example' }
    });
    const rejected = await fetch(`${server.url}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: 'https://untrusted.example' }
    });

    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://game.school.example');
    expect(rejected.status).toBe(403);
  });

  it('serves a health response for deployment monitoring', async () => {
    const server = await createRealtimeServer();
    servers.push(server);

    const response = await fetch(`${server.url}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('accepts a browser Socket connection', async () => {
    const server = await createRealtimeServer();
    servers.push(server);
    const client = createClient(server.url, {
      transports: ['websocket'],
      forceNew: true
    });

    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });

    expect(client.connected).toBe(true);
    client.close();
  });

  it('continues serving when a client omits an acknowledgement callback', async () => {
    const server = await createRealtimeServer();
    servers.push(server);
    const client = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await waitForConnect(client);

    const roomState = onceRoomState(client);
    client.emit(SOCKET_EVENTS.roomCreate, {
      name: 'ACK 없는 방',
      maxPlayers: 4,
      timerSeconds: 60,
      nickname: '방장'
    });

    await expect(roomState).resolves.toMatchObject({ name: 'ACK 없는 방', playerCount: 1 });
    await expect(fetch(`${server.url}/health`)).resolves.toHaveProperty('status', 200);
    client.close();
  });

  it('rejects invalid room join payloads and acknowledges valid joins', async () => {
    const server = await createRealtimeServer();
    servers.push(server);
    const client = createClient(server.url, {
      transports: ['websocket'],
      forceNew: true
    });

    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });

    const invalid = await emitJoin(client, { roomId: '', nickname: '' });
    const invalidCode = await emitJoin(client, { roomId: 'ABC123', nickname: '학생' });
    const created = await emitCreate(client, {
      name: '1학년 2반',
      maxPlayers: 4,
      timerSeconds: 60,
      nickname: '방장'
    });
    const secondClient = createClient(server.url, {
      transports: ['websocket'],
      forceNew: true
    });
    await new Promise<void>((resolve, reject) => {
      secondClient.once('connect', resolve);
      secondClient.once('connect_error', reject);
    });
    const direct = await emitJoin(secondClient, {
      roomId: created.ok ? created.room.code : 'missing-room',
      nickname: '하늘'
    });

    expect(invalid).toEqual({ ok: false, code: 'invalid-payload' });
    expect(invalidCode).toEqual({ ok: false, code: 'invalid-payload' });
    expect(created).toMatchObject({
      ok: true,
      inviteToken: expect.stringMatching(/^[a-f0-9]{32}$/),
      room: { name: '1학년 2반', playerCount: 1, code: expect.stringMatching(/^\d{6}$/) }
    });
    expect(direct).toMatchObject({
      ok: true,
      room: { playerCount: 2 },
      nickname: '하늘'
    });
    client.close();
    secondClient.close();
  });

  it('broadcasts a resigned status to remaining room members after a disconnect', async () => {
    let expireReconnectGrace: () => void = () => { throw new Error('Reconnect expiry was not scheduled.'); };
    let resolveGraceScheduled: () => void = () => undefined;
    const reconnectGraceScheduled = new Promise<void>((resolve) => { resolveGraceScheduled = resolve; });
    const server = await createRealtimeServer({
      scheduleReconnectExpiry: (callback) => {
        expireReconnectGrace = callback;
        resolveGraceScheduled();
      }
    });
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const player = createClient(server.url, { transports: ['websocket'], forceNew: true });

    await Promise.all([waitForConnect(host), waitForConnect(player)]);
    const created = await emitCreate(host, {
      name: '1학년 2반',
      maxPlayers: 4,
      timerSeconds: 60,
      nickname: '방장'
    });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await emitJoin(player, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: '하늘' });

    player.close();
    await reconnectGraceScheduled;
    const resignedState = waitForResignedPlayer(host, '하늘');
    expireReconnectGrace();

    const state = await resignedState;
    expect(state.playerCount).toBe(1);
    expect(state.players).toEqual(
      expect.arrayContaining([expect.objectContaining({ nickname: '하늘', status: 'resigned' })])
    );
    host.close();
  });

  it('lets a participant leave a room from the result controls without disconnecting the browser', async () => {
    const server = await createRealtimeServer();
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const player = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await Promise.all([waitForConnect(host), waitForConnect(player)]);
    const created = await emitCreate(host, { name: '나가기 방', maxPlayers: 2, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await emitJoin(player, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: '학생' });

    const resignedState = waitForResignedPlayer(host, '학생');
    expect(await emitLeave(player, created.room.code)).toEqual({ ok: true });
    await expect(resignedState).resolves.toMatchObject({ playerCount: 1 });
    expect(player.connected).toBe(true);
    host.close();
    player.close();
  });

  it('restores a disconnected participant to their original player identity with a valid reconnect token', async () => {
    const server = await createRealtimeServer();
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const player = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await Promise.all([waitForConnect(host), waitForConnect(player)]);
    const created = await emitCreate(host, { name: '재접속 방', maxPlayers: 2, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    const joined = await emitJoin(player, { roomId: created.room.code, nickname: '하늘' });
    if (!joined.ok) throw new Error('Room join unexpectedly failed.');
    const originalPlayerId = player.id;
    const privateRoles = Promise.all([host, player].map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    await emitStart(host, created.room.code);
    const originalRole = (await privateRoles).find(({ client }) => client === player)?.role;
    if (!originalRole) throw new Error('Player role was not assigned.');

    player.close();
    const reconnectingPlayer = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await waitForConnect(reconnectingPlayer);
    const recoveredRole = oncePrivateRole(reconnectingPlayer);
    const rejoined = await emitRejoin(reconnectingPlayer, {
      roomId: created.room.code,
      reconnectToken: joined.reconnectToken
    });

    expect(rejoined).toMatchObject({ ok: true, playerId: originalPlayerId, room: { playerCount: 2 } });
    await expect(recoveredRole).resolves.toMatchObject({ role: originalRole.role });
    reconnectingPlayer.close();
    host.close();
  });

  it('does not resign a participant when a leave request names a different room', async () => {
    const server = await createRealtimeServer({ schedule: () => undefined, scheduleReconnectExpiry: (callback) => callback() });
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const player = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await Promise.all([waitForConnect(host), waitForConnect(player)]);
    const created = await emitCreate(host, { name: '잘못된 퇴장 요청', maxPlayers: 2, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await emitJoin(player, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: '학생' });

    expect(await emitLeave(player, 'OTHERROOM')).toEqual({ ok: false, code: 'room-not-found' });
    expect(await emitStart(host, created.room.code)).toMatchObject({ ok: true, room: { playerCount: 2 } });
    host.close();
    player.close();
  });

  it('transfers host authority to the first remaining active participant after a disconnect', async () => {
    const server = await createRealtimeServer({
      schedule: () => undefined,
      scheduleReconnectExpiry: (callback) => callback()
    });
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const players = Array.from({ length: 4 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    await Promise.all([waitForConnect(host), ...players.map(waitForConnect)]);
    const created = await emitCreate(host, {
      name: '방장 승계 방',
      maxPlayers: 5,
      timerSeconds: 60,
      nickname: '방장'
    });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) => emitJoin(client, {
      roomId: created.room.code,
      inviteToken: created.inviteToken,
      nickname: `학생${index + 1}`
    })));

    const nextHostState = new Promise<PublicRoomState>((resolve) => {
      players[0].on(SOCKET_EVENTS.roomState, (state: PublicRoomState) => {
        if (state.players.some((player) => player.id === players[0].id && player.isHost && player.status === 'active')) {
          resolve(state);
        }
      });
    });
    host.close();

    await expect(nextHostState).resolves.toMatchObject({ playerCount: 4 });
    expect(await emitStart(players[0], created.room.code)).toMatchObject({ ok: true, room: { status: 'in-game' } });
    players.forEach((client) => client.close());
  });

  it('automatically advances after the final mafia submits a valid target', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const player = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await Promise.all([waitForConnect(host), waitForConnect(player)]);
    const created = await emitCreate(host, { name: '자동 진행 방', maxPlayers: 2, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await emitJoin(player, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: '학생' });

    const roles = Promise.all([host, player].map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    await emitStart(host, created.room.code);
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.();
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });

    const mafia = (await roles).find(({ role }) => role.role === 'mafia');
    if (!mafia?.client.id) throw new Error('Expected a mafia player.');
    const target = mafia.client.id === host.id ? player : host;
    const dayBriefing = onceGameState(host);

    expect(await emitMafiaTarget(mafia.client, created.room.code, target.id!)).toEqual({ ok: true });
    await expect(dayBriefing).resolves.toMatchObject({ phase: 'result', winner: 'mafia' });
    host.close();
    player.close();
  });

  it('automatically advances after each required action in a four-player game', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const clients = Array.from({ length: 4 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: '자동 전환 4인 방', maxPlayers: 4, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await Promise.all(players.map((client, index) => emitJoin(client, {
      roomId: created.room.code,
      inviteToken: created.inviteToken,
      nickname: `학생${index + 1}`
    })));

    const roles = Promise.all(clients.map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    await emitStart(host, created.room.code);
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.();
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });

    const assignedRoles = await roles;
    const mafia = assignedRoles.find(({ role }) => role.role === 'mafia');
    const doctor = assignedRoles.find(({ role }) => role.role === 'doctor');
    const mafiaTarget = assignedRoles.find(({ role }) => role.role === 'citizen');
    if (!mafia?.client.id || !doctor?.client.id || !mafiaTarget?.client.id) {
      throw new Error('The four-player preset must assign mafia, doctor, and citizens.');
    }

    const doctorNight = onceGameState(host);
    await expect(emitMafiaTarget(mafia.client, created.room.code, mafiaTarget.client.id)).resolves.toEqual({ ok: true });
    await expect(doctorNight).resolves.toMatchObject({ phase: 'night-doctor' });

    const dayBriefing = onceGameState(host);
    await expect(emitDoctorProtect(doctor.client, created.room.code, mafiaTarget.client.id)).resolves.toEqual({ ok: true });
    const briefing = await dayBriefing;
    expect(briefing).toMatchObject({ phase: 'day-briefing' });

    const dayVote = onceGameState(host);
    await expect(emitSkip(host, created.room.code, briefing.revision)).resolves.toEqual({ ok: true });
    await expect(dayVote).resolves.toMatchObject({ phase: 'day-vote' });
    const result = onceGameState(host);
    const alternateTargetId = clients.find((client) => client.id !== mafia.client.id)?.id;
    if (!alternateTargetId) throw new Error('Expected a non-mafia vote target.');
    await Promise.all(clients.map((client) => emitDayVote(
      client,
      created.room.code,
      client.id === mafia.client.id ? alternateTargetId : mafia.client.id!
    )));
    await expect(result).resolves.toMatchObject({ phase: 'result', winner: 'citizens' });
    clients.forEach((client) => client.close());
  });

  it('returns all remaining participants to the lobby when the host leaves the result screen', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const player = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await Promise.all([waitForConnect(host), waitForConnect(player)]);
    const created = await emitCreate(host, { name: '로비 복귀 방', maxPlayers: 2, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await emitJoin(player, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: '학생' });

    const roles = Promise.all([host, player].map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    await emitStart(host, created.room.code);
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.();
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });
    const mafia = (await roles).find(({ role }) => role.role === 'mafia');
    if (!mafia?.client.id) throw new Error('Expected a mafia player.');
    const target = mafia.client.id === host.id ? player : host;
    const result = onceGameState(host);
    await emitMafiaTarget(mafia.client, created.room.code, target.id!);
    await expect(result).resolves.toMatchObject({ phase: 'result' });

    const lobby = onceRoomState(player);
    expect(await emitReturnToLobby(host, created.room.code)).toMatchObject({ ok: true, room: { status: 'lobby' } });
    await expect(lobby).resolves.toMatchObject({ status: 'lobby', playerCount: 2 });
    host.close();
    player.close();
  });

  it('lets the host close a room and rejects future joins without retaining its game state', async () => {
    const server = await createRealtimeServer({ scheduleReconnectExpiry: (callback) => callback() });
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const player = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await Promise.all([waitForConnect(host), waitForConnect(player)]);
    const created = await emitCreate(host, {
      name: '종료 방', maxPlayers: 4, timerSeconds: 60, nickname: '방장'
    });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }

    expect(await emitClose(host, created.room.code)).toEqual({ ok: true });
    expect(await emitJoin(player, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: '하늘' })).toEqual({
      ok: false,
      code: 'room-not-found'
    });
    host.close();
    player.close();
  });

  it('allows the host to start at four players and rejects joins afterwards', async () => {
    const server = await createRealtimeServer();
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const players = [
      createClient(server.url, { transports: ['websocket'], forceNew: true }),
      createClient(server.url, { transports: ['websocket'], forceNew: true }),
      createClient(server.url, { transports: ['websocket'], forceNew: true })
    ];
    await Promise.all([waitForConnect(host), ...players.map(waitForConnect)]);
    const created = await emitCreate(host, {
      name: '1학년 2반', maxPlayers: 5, timerSeconds: 60, nickname: '방장'
    });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) =>
      emitJoin(client, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: `학생${index + 1}` })
    ));

    const publicState = onceGameState(host);
    const privateRoles = Promise.all([host, ...players].map(oncePrivateRole));
    const started = await emitStart(host, created.room.code);
    const latePlayer = createClient(server.url, { transports: ['websocket'], forceNew: true });
    await waitForConnect(latePlayer);
    const lateJoin = await emitJoin(latePlayer, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: '늦은학생' });

    expect(started).toMatchObject({ ok: true, room: { status: 'in-game', playerCount: 4 } });
    expect(lateJoin).toEqual({ ok: false, code: 'room-rejected' });
    expect((await privateRoles).filter((role) => role.role === 'mafia')).toHaveLength(1);
    const publicGame = await publicState;
    expect(publicGame).not.toHaveProperty('roleAssignments');
    expect(publicGame.players.every((player) => typeof player.id === 'string')).toBe(true);
    host.close();
    players.forEach((client) => client.close());
    latePlayer.close();
  });

  it('publishes an in-game resignation to the remaining participants', async () => {
    const server = await createRealtimeServer({ scheduleReconnectExpiry: (callback) => callback() });
    servers.push(server);
    const clients = Array.from({ length: 4 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: '기권 방', maxPlayers: 4, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) => emitJoin(client, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: `학생${index + 1}` })));

    const initialState = onceGameState(host);
    await emitStart(host, created.room.code);
    await initialState;
    const afterResignation = onceGameState(host);
    players[0].close();

    await expect(afterResignation).resolves.toMatchObject({
      players: expect.arrayContaining([expect.objectContaining({ nickname: '학생1', status: 'resigned' })])
    });
    host.close();
    players.slice(1).forEach((client) => client.close());
  });

  it('reveals mafia teammates only to mafia clients in a multi-mafia preset', async () => {
    const server = await createRealtimeServer();
    servers.push(server);
    const clients = Array.from({ length: 7 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: '마피아 팀 방', maxPlayers: 7, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) => emitJoin(client, {
      roomId: created.room.code,
      inviteToken: created.inviteToken,
      nickname: `학생${index + 1}`
    })));

    const privateRoles = Promise.all(clients.map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    await emitStart(host, created.room.code);
    const assigned = await privateRoles;
    const mafia = assigned.filter(({ role }) => role.role === 'mafia');
    const mafiaIds = mafia.map(({ client }) => client.id);

    expect(mafia).toHaveLength(2);
    for (const { role } of mafia) {
      expect(role.mafiaPlayerIds).toEqual(expect.arrayContaining(mafiaIds));
    }
    for (const { role } of assigned.filter(({ role }) => role.role !== 'mafia')) {
      expect(role.mafiaPlayerIds).toBeUndefined();
    }
    clients.forEach((client) => client.close());
  });

  it('advances from role reveal to mafia night when the server timer expires', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const host = createClient(server.url, { transports: ['websocket'], forceNew: true });
    const players = [
      createClient(server.url, { transports: ['websocket'], forceNew: true }),
      createClient(server.url, { transports: ['websocket'], forceNew: true }),
      createClient(server.url, { transports: ['websocket'], forceNew: true })
    ];
    await Promise.all([waitForConnect(host), ...players.map(waitForConnect)]);
    const created = await emitCreate(host, {
      name: '타이머 방', maxPlayers: 4, timerSeconds: 10, nickname: '방장'
    });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) =>
      emitJoin(client, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: `학생${index + 1}` })
    ));

    const privateRoles = Promise.all([host, ...players].map(async (client) => ({
      client,
      role: await oncePrivateRole(client)
    })));
    const reveal = onceGameState(host);
    await emitStart(host, created.room.code);
    await expect(reveal).resolves.toMatchObject({
      phase: 'role-reveal',
      phaseEndsAt: expect.any(String)
    });
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.();

    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });
    const roles = await privateRoles;
    const mafia = roles.find(({ role }) => role.role === 'mafia');
    const citizen = roles.find(({ role }) => role.role === 'citizen');
    const doctor = roles.find(({ role }) => role.role === 'doctor');
    if (!mafia || !citizen || !doctor || !citizen.client.id || !doctor.client.id) {
      throw new Error('Expected connected mafia, doctor, and citizen players.');
    }

    expect(await emitMafiaTarget(citizen.client, created.room.code, citizen.client.id)).toEqual({
      ok: false,
      code: 'command-rejected'
    });
    const doctorNight = onceGameState(host);
    expect(await emitMafiaTarget(mafia.client, created.room.code, citizen.client.id)).toMatchObject({ ok: true });

    await expect(doctorNight).resolves.toMatchObject({ phase: 'night-doctor' });
    const dayBriefing = onceGameState(host);
    expect(await emitDoctorProtect(doctor.client, created.room.code, doctor.client.id)).toMatchObject({ ok: true });

    await expect(dayBriefing).resolves.toMatchObject({
      phase: 'day-briefing',
      eliminatedPlayerId: citizen.client.id
    });
    host.close();
    players.forEach((client) => client.close());
  });

  it('starts a three-player game with a daytime briefing before the first mafia night', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const clients = Array.from({ length: 3 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: 'Three player room', maxPlayers: 3, timerSeconds: 60, nickname: 'Host' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await Promise.all(players.map((client, index) => emitJoin(client, {
      roomId: created.room.code, inviteToken: created.inviteToken, nickname: `Player${index + 1}`
    })));

    const reveal = onceGameState(host);
    await emitStart(host, created.room.code);
    await expect(reveal).resolves.toMatchObject({ phase: 'role-reveal' });
    const firstDay = onceGameState(host);
    scheduled.shift()?.();

    await expect(firstDay).resolves.toMatchObject({ phase: 'day-briefing' });
    clients.forEach((client) => client.close());
  });

  it('lets only the host skip a phase and ignores the superseded timer callback', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const clients = Array.from({ length: 4 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: '넘기기 방', maxPlayers: 4, timerSeconds: 60, nickname: '방장' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await Promise.all(players.map((client, index) => emitJoin(client, {
      roomId: created.room.code, inviteToken: created.inviteToken, nickname: `학생${index + 1}`
    })));

    const reveal = onceGameState(host);
    await emitStart(host, created.room.code);
    const roleReveal = await reveal;
    expect(roleReveal).toMatchObject({ phase: 'role-reveal', revision: 1 });
    expect(await emitSkip(players[0], created.room.code, roleReveal.revision)).toEqual({ ok: false, code: 'command-rejected' });

    const mafiaNight = onceGameState(host);
    expect(await emitSkip(host, created.room.code, roleReveal.revision)).toEqual({ ok: true });
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });
    expect(await emitSkip(host, created.room.code, roleReveal.revision)).toEqual({ ok: false, code: 'command-rejected' });
    expect(scheduled).toHaveLength(2);

    scheduled[0]();
    expect(scheduled).toHaveLength(2);
    clients.forEach((client) => client.close());
  });

  it('accepts doctor protection only from the doctor during doctor night', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const clients = Array.from({ length: 6 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: '의사 방', maxPlayers: 6, timerSeconds: 10, nickname: '방장' });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) => emitJoin(client, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: `학생${index + 1}` })));
    const roles = Promise.all(clients.map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    const reveal = onceGameState(host);
    await emitStart(host, created.room.code);
    await expect(reveal).resolves.toMatchObject({ phase: 'role-reveal' });
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.();
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });
    const doctorNight = onceGameState(host);
    scheduled.shift()?.();
    await expect(doctorNight).resolves.toMatchObject({ phase: 'night-doctor' });

    const assigned = await roles;
    const doctor = assigned.find(({ role }) => role.role === 'doctor');
    const citizen = assigned.find(({ role }) => role.role === 'citizen');
    if (!doctor || !citizen || !citizen.client.id) {
      throw new Error('Expected a doctor and citizen.');
    }
    expect(await emitDoctorProtect(citizen.client, created.room.code, citizen.client.id)).toEqual({ ok: false, code: 'command-rejected' });
    expect(await emitDoctorProtect(doctor.client, created.room.code, citizen.client.id)).toEqual({ ok: true });
    clients.forEach((client) => client.close());
  });

  it('uses an inconspicuous 20 to 30 second delay when the doctor or police resigns', async () => {
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
    const server = await createRealtimeServer({
      random: () => 0.5,
      schedule: (callback, delayMs) => { scheduled.push({ callback, delayMs }); },
      scheduleReconnectExpiry: (callback) => callback()
    });
    servers.push(server);
    const clients = Array.from({ length: 5 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: 'Hidden role delay', maxPlayers: 5, timerSeconds: 10, nickname: 'Host' });
    if (!created.ok) throw new Error('Room creation unexpectedly failed.');
    await Promise.all(players.map((client, index) => emitJoin(client, {
      roomId: created.room.code, inviteToken: created.inviteToken, nickname: `Player${index + 1}`
    })));

    const roles = Promise.all(clients.map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    await emitStart(host, created.room.code);
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.callback();
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });
    const doctorNight = onceGameState(host);
    scheduled.shift()?.callback();
    await expect(doctorNight).resolves.toMatchObject({ phase: 'night-doctor' });

    const assigned = await roles;
    const doctor = assigned.find(({ role }) => role.role === 'doctor');
    if (!doctor) throw new Error('Expected a doctor client.');
    const doctorId = doctor.client.id;
    if (!doctorId) throw new Error('Expected the doctor client to have an ID.');
    const observer = clients.find((client) => client !== doctor.client);
    if (!observer) throw new Error('Expected an observer client.');
    const afterResignation = waitForGameState(observer, (state) =>
      state.players.some((player) => player.id === doctorId && player.status === 'resigned')
    );
    doctor.client.close();
    await expect(afterResignation).resolves.toMatchObject({ phase: 'night-doctor' });
    expect(scheduled.at(-1)?.delayMs).toBe(25_000);

    const policePhase = onceGameState(observer);
    scheduled.at(-1)?.callback();
    await expect(policePhase).resolves.toMatchObject({ phase: 'night-police' });
    const police = assigned.find(({ role }) => role.role === 'police');
    if (!police) throw new Error('Expected a police client.');
    const policeId = police.client.id;
    if (!policeId) throw new Error('Expected the police client to have an ID.');
    const policeObserver = clients.find((client) => client !== doctor.client && client !== police.client);
    if (!policeObserver) throw new Error('Expected a police observer client.');
    const afterPoliceResignation = waitForGameState(policeObserver, (state) =>
      state.players.some((player) => player.id === policeId && player.status === 'resigned')
    );
    police.client.close();
    await expect(afterPoliceResignation).resolves.toMatchObject({ phase: 'night-police' });
    expect(scheduled.at(-1)?.delayMs).toBe(25_000);
    clients.filter((client) => client !== doctor.client && client !== police.client).forEach((client) => client.close());
  });

  it('sends a police investigation result only to the investigating police client', async () => {
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
    const server = await createRealtimeServer({ schedule: (callback, delayMs) => { scheduled.push({ callback, delayMs }); } });
    servers.push(server);
    const clients = Array.from({ length: 5 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: '경찰 방', maxPlayers: 5, timerSeconds: 10, nickname: '방장' });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) => emitJoin(client, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: `학생${index + 1}` })));
    const roles = Promise.all(clients.map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    const reveal = onceGameState(host);
    await emitStart(host, created.room.code);
    await reveal;
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.callback();
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });
    const doctorNight = onceGameState(host);
    scheduled.shift()?.callback();
    await expect(doctorNight).resolves.toMatchObject({ phase: 'night-doctor' });
    const policeNight = onceGameState(host);
    scheduled.shift()?.callback();
    await expect(policeNight).resolves.toMatchObject({ phase: 'night-police' });

    const assigned = await roles;
    const police = assigned.find(({ role }) => role.role === 'police');
    const mafia = assigned.find(({ role }) => role.role === 'mafia');
    if (!police || !mafia || !mafia.client.id) {
      throw new Error('Expected police and mafia clients.');
    }
    const result = oncePoliceResult(police.client);
    const resultDisplay = onceGameState(host);
    expect(await emitPoliceInvestigate(police.client, created.room.code, mafia.client.id)).toEqual({ ok: true });
    await expect(result).resolves.toEqual({ targetPlayerId: mafia.client.id, alignment: 'mafia' });
    await expect(resultDisplay).resolves.toMatchObject({ phase: 'night-police' });
    expect(scheduled).toHaveLength(2);
    expect(scheduled.at(-1)?.delayMs).toBe(5_000);
    expect(await emitPoliceInvestigate(police.client, created.room.code, mafia.client.id)).toEqual({ ok: false, code: 'command-rejected' });
    const dayBriefing = onceGameState(host);
    scheduled.at(-1)?.callback();
    await expect(dayBriefing).resolves.toMatchObject({ phase: 'day-briefing' });
    clients.forEach((client) => client.close());
  });

  it('publishes the winning result and stops automatic timers after a decisive day vote', async () => {
    const scheduled: (() => void)[] = [];
    const server = await createRealtimeServer({ schedule: (callback) => { scheduled.push(callback); } });
    servers.push(server);
    const clients = Array.from({ length: 4 }, () => createClient(server.url, { transports: ['websocket'], forceNew: true }));
    const [host, ...players] = clients;
    await Promise.all(clients.map(waitForConnect));
    const created = await emitCreate(host, { name: '결과 방', maxPlayers: 4, timerSeconds: 10, nickname: '방장' });
    if (!created.ok) {
      throw new Error('Room creation unexpectedly failed.');
    }
    await Promise.all(players.map((client, index) => emitJoin(client, { roomId: created.room.code, inviteToken: created.inviteToken, nickname: `학생${index + 1}` })));

    const roles = Promise.all(clients.map(async (client) => ({ client, role: await oncePrivateRole(client) })));
    await emitStart(host, created.room.code);
    const mafiaNight = onceGameState(host);
    scheduled.shift()?.();
    await expect(mafiaNight).resolves.toMatchObject({ phase: 'night-mafia' });
    const doctorNight = onceGameState(host);
    scheduled.shift()?.();
    await expect(doctorNight).resolves.toMatchObject({ phase: 'night-doctor' });
    const dayBriefing = onceGameState(host);
    scheduled.shift()?.();
    await expect(dayBriefing).resolves.toMatchObject({ phase: 'day-briefing' });
    const dayVote = onceGameState(host);
    scheduled.shift()?.();
    await expect(dayVote).resolves.toMatchObject({ phase: 'day-vote' });

    const mafia = (await roles).find(({ role }) => role.role === 'mafia');
    if (!mafia?.client.id) {
      throw new Error('Expected a mafia client.');
    }
    const result = onceGameState(host);
    const alternateTargetId = clients.find((client) => client.id !== mafia.client.id)?.id;
    if (!alternateTargetId) throw new Error('Expected a non-mafia vote target.');
    await Promise.all(clients.map((client) => emitDayVote(
      client,
      created.room.code,
      client.id === mafia.client.id ? alternateTargetId : mafia.client.id!
    )));

    await expect(result).resolves.toMatchObject({
      phase: 'result',
      winner: 'citizens',
      eliminatedPlayerId: mafia.client.id,
      dayElimination: { playerId: mafia.client.id, alignment: 'mafia' },
      voteTotals: { [mafia.client.id]: 3, [alternateTargetId]: 1 }
    });
    expect(scheduled).toHaveLength(1);

    const rematchRole = oncePrivateRole(host);
    const rematchState = onceGameState(host);
    expect(await emitRematch(host, created.room.code)).toMatchObject({ ok: true, room: { status: 'in-game' } });
    await expect(rematchState).resolves.toMatchObject({ phase: 'role-reveal' });
    await expect(rematchRole).resolves.toHaveProperty('role');
    expect(scheduled).toHaveLength(2);
    clients.forEach((client) => client.close());
  });
});

function emitJoin(
  client: ReturnType<typeof createClient>,
  payload: unknown
): Promise<JoinRoomResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomJoin, payload, resolve);
  });
}

function emitRejoin(
  client: ReturnType<typeof createClient>,
  payload: unknown
): Promise<unknown> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomRejoin, payload, resolve);
  });
}

function waitForConnect(client: ReturnType<typeof createClient>): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });
}

function waitForResignedPlayer(
  client: ReturnType<typeof createClient>,
  nickname: string
): Promise<PublicRoomState> {
  return new Promise((resolve) => {
    client.on(SOCKET_EVENTS.roomState, (state: PublicRoomState) => {
      if (state.players.some((player) => player.nickname === nickname && player.status === 'resigned')) {
        resolve(state);
      }
    });
  });
}

function oncePrivateRole(client: ReturnType<typeof createClient>): Promise<PrivateRole> {
  return new Promise((resolve) => client.once(SOCKET_EVENTS.gamePrivateRole, resolve));
}

function onceGameState(client: ReturnType<typeof createClient>): Promise<PublicGameState> {
  return new Promise((resolve) => client.once(SOCKET_EVENTS.gamePublicState, resolve));
}

function waitForGameState(
  client: ReturnType<typeof createClient>,
  matches: (state: PublicGameState) => boolean
): Promise<PublicGameState> {
  return new Promise((resolve) => {
    client.on(SOCKET_EVENTS.gamePublicState, (state: PublicGameState) => {
      if (matches(state)) {
        resolve(state);
      }
    });
  });
}

function onceRoomState(client: ReturnType<typeof createClient>): Promise<PublicRoomState> {
  return new Promise((resolve) => client.once(SOCKET_EVENTS.roomState, resolve));
}

function emitCreate(
  client: ReturnType<typeof createClient>,
  payload: unknown
): Promise<CreateRoomResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomCreate, payload, resolve);
  });
}

function emitStart(
  client: ReturnType<typeof createClient>,
  roomId: string
): Promise<StartRoomResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomStart, { roomId }, resolve);
  });
}

function emitClose(
  client: ReturnType<typeof createClient>,
  roomId: string
): Promise<CloseRoomResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomClose, { roomId }, resolve);
  });
}

function emitRematch(
  client: ReturnType<typeof createClient>,
  roomId: string
): Promise<StartRoomResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomRematch, { roomId }, resolve);
  });
}

function emitMafiaTarget(
  client: ReturnType<typeof createClient>,
  roomId: string,
  targetPlayerId: string
): Promise<GameCommandResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.gameMafiaTarget, { roomId, targetPlayerId }, resolve);
  });
}

function emitDoctorProtect(
  client: ReturnType<typeof createClient>,
  roomId: string,
  targetPlayerId: string
): Promise<GameCommandResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.gameDoctorProtect, { roomId, targetPlayerId }, resolve);
  });
}

function emitPoliceInvestigate(
  client: ReturnType<typeof createClient>,
  roomId: string,
  targetPlayerId: string
): Promise<GameCommandResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.gamePoliceInvestigate, { roomId, targetPlayerId }, resolve);
  });
}

function emitDayVote(
  client: ReturnType<typeof createClient>,
  roomId: string,
  targetPlayerId: string
): Promise<GameCommandResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.gameDayVote, { roomId, targetPlayerId }, resolve);
  });
}

function emitLeave(
  client: ReturnType<typeof createClient>,
  roomId: string
): Promise<CloseRoomResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomLeave, { roomId }, resolve);
  });
}

function emitReturnToLobby(
  client: ReturnType<typeof createClient>,
  roomId: string
): Promise<ReturnToLobbyResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.roomReturnToLobby, { roomId }, resolve);
  });
}

function emitSkip(
  client: ReturnType<typeof createClient>,
  roomId: string,
  expectedRevision = 0
): Promise<GameCommandResponse> {
  return new Promise((resolve) => {
    client.emit(SOCKET_EVENTS.gameSkipPhase, { roomId, expectedRevision }, resolve);
  });
}

function oncePoliceResult(client: ReturnType<typeof createClient>): Promise<{ targetPlayerId: string; alignment: 'mafia' | 'citizen' }> {
  return new Promise((resolve) => client.once(SOCKET_EVENTS.gamePrivateInvestigation, resolve));
}
