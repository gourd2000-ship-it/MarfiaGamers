import { describe, expect, it } from 'vitest';
import {
  advanceGamePhase,
  createGame,
  startGame,
  submitDoctorProtection,
  submitPoliceInvestigation,
  submitMafiaVote,
  resolveNight,
  beginDayVote,
  submitDayVote,
  resolveDayVote,
  getWinner,
  resignGamePlayer
} from '../apps/server/src/game/game-engine.js';

const fourPlayers = [
  { id: 'p1', name: '하늘' },
  { id: 'p2', name: '바다' },
  { id: 'p3', name: '별' },
  { id: 'p4', name: '숲' }
];

describe('automatic game setup', () => {
  it('automatically assigns the four-player preset without accepting host-selected roles', () => {
    const lobby = createGame({ roomId: 'room-1', players: fourPlayers });

    const started = startGame(lobby, () => 0);

    expect(started.phase).toBe('role-reveal');
    expect(started.preset).toMatchObject({ mafia: 1, doctor: 0, police: 0, citizen: 3 });
    expect(Object.values(started.roleAssignments).filter((role) => role === 'mafia')).toHaveLength(1);
    expect(Object.values(started.roleAssignments).filter((role) => role === 'citizen')).toHaveLength(3);
  });

  it('moves a four-player game from the mafia night directly to the day briefing', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);

    const night = advanceGamePhase(started);
    const dayBriefing = advanceGamePhase(night);

    expect(night.phase).toBe('night-mafia');
    expect(dayBriefing.phase).toBe('day-briefing');
  });
});

describe('doctor protection', () => {
  it('allows the doctor to protect themselves only once in the whole game', () => {
    const players = Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}`, name: `학생${index + 1}` }));
    const started = startGame(createGame({ roomId: 'room-1', players }), () => 0);
    const doctorId = Object.entries(started.roleAssignments).find(([, role]) => role === 'doctor')?.[0];
    if (!doctorId) {
      throw new Error('The six-player preset must include a doctor.');
    }

    const doctorPhase = advanceGamePhase(advanceGamePhase(started));
    const afterFirstSelfProtection = submitDoctorProtection(doctorPhase, doctorId, doctorId);

    const nextDoctorPhase = {
      ...afterFirstSelfProtection,
      phase: 'night-doctor' as const,
      doctorTargetId: undefined
    };

    expect(() => submitDoctorProtection(nextDoctorPhase, doctorId, doctorId)).toThrow('only protect themselves once');
  });

  it('accepts only one protection submission in a doctor phase', () => {
    const players = Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}`, name: `학생${index + 1}` }));
    const started = startGame(createGame({ roomId: 'room-1', players }), () => 0);
    const doctorId = Object.entries(started.roleAssignments).find(([, role]) => role === 'doctor')?.[0];
    if (!doctorId) {
      throw new Error('The six-player preset must include a doctor.');
    }
    const doctorPhase = advanceGamePhase(advanceGamePhase(started));
    const submitted = submitDoctorProtection(doctorPhase, doctorId, 'p1');

    expect(() => submitDoctorProtection(submitted, doctorId, 'p2')).toThrow('already submitted');
  });
});

describe('police investigation', () => {
  it('returns the target alignment only for a police investigation command', () => {
    const players = Array.from({ length: 5 }, (_, index) => ({ id: `p${index + 1}`, name: `학생${index + 1}` }));
    const started = startGame(createGame({ roomId: 'room-1', players }), () => 0);
    const policeId = Object.entries(started.roleAssignments).find(([, role]) => role === 'police')?.[0];
    const mafiaId = Object.entries(started.roleAssignments).find(([, role]) => role === 'mafia')?.[0];
    if (!policeId || !mafiaId) {
      throw new Error('The five-player preset must include police and mafia.');
    }

    const policePhase = advanceGamePhase(advanceGamePhase(started));
    const investigated = submitPoliceInvestigation(policePhase, policeId, mafiaId);

    expect(investigated.policeResult).toEqual({ targetId: mafiaId, alignment: 'mafia' });
  });
});

describe('mafia action', () => {
  it('accepts one mafia target vote only from a mafia player during mafia night', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const mafiaId = Object.entries(started.roleAssignments).find(([, role]) => role === 'mafia')?.[0];
    const targetId = Object.entries(started.roleAssignments).find(([, role]) => role === 'citizen')?.[0];
    if (!mafiaId || !targetId) {
      throw new Error('The four-player preset must include mafia and citizens.');
    }

    const night = advanceGamePhase(started);
    const voted = submitMafiaVote(night, mafiaId, targetId);

    expect(voted.mafiaVotes).toEqual({ [mafiaId]: targetId });
    expect(() => submitMafiaVote(voted, mafiaId, targetId)).toThrow('already submitted');
  });
});

describe('night resolution', () => {
  it('prevents a mafia target from being eliminated when the doctor protected them', () => {
    const players = Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}`, name: `학생${index + 1}` }));
    const started = startGame(createGame({ roomId: 'room-1', players }), () => 0);
    const mafiaId = Object.entries(started.roleAssignments).find(([, role]) => role === 'mafia')?.[0];
    const doctorId = Object.entries(started.roleAssignments).find(([, role]) => role === 'doctor')?.[0];
    const targetId = Object.entries(started.roleAssignments).find(([, role]) => role === 'citizen')?.[0];
    if (!mafiaId || !doctorId || !targetId) {
      throw new Error('The six-player preset must include mafia, doctor and citizen.');
    }

    const mafiaNight = advanceGamePhase(started);
    const withMafiaVote = submitMafiaVote(mafiaNight, mafiaId, targetId);
    const doctorNight = advanceGamePhase(withMafiaVote);
    const protectedGame = submitDoctorProtection(doctorNight, doctorId, targetId);

    expect(resolveNight(protectedGame).nightResult).toEqual({ eliminatedPlayerId: null });
  });

  it('ends the game immediately when the mafia reaches parity after a night elimination', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const mafiaId = Object.entries(started.roleAssignments).find(([, role]) => role === 'mafia')?.[0];
    const citizenIds = Object.entries(started.roleAssignments)
      .filter(([, role]) => role === 'citizen')
      .map(([playerId]) => playerId);
    if (!mafiaId || citizenIds.length !== 3) {
      throw new Error('The four-player preset must include one mafia and three citizens.');
    }

    const nearParityNight = {
      ...started,
      phase: 'night-mafia' as const,
      eliminatedPlayerIds: [citizenIds[0]]
    };
    const finalNight = resolveNight(submitMafiaVote(nearParityNight, mafiaId, citizenIds[1]));

    expect(finalNight).toMatchObject({ phase: 'result', winner: 'mafia' });
  });
});

describe('day vote', () => {
  it('reveals only candidate totals and the eliminated player after a private vote', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const voting = beginDayVote({ ...started, phase: 'day-briefing' });
    const submitted = fourPlayers.reduce(
      (game, player) => submitDayVote(game, player.id, 'p1'),
      voting
    );

    expect(resolveDayVote(submitted).dayVoteResult).toEqual({
      eliminatedPlayerId: 'p1',
      voteTotals: { p1: 4 },
      requiresRevote: false
    });
  });

  it('allows exactly one revote after a tie and eliminates nobody after a second tie', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const voting = beginDayVote({ ...started, phase: 'day-briefing' });
    const tied = ['p1', 'p1', 'p2', 'p2'].reduce(
      (game, targetId, index) => submitDayVote(game, fourPlayers[index].id, targetId),
      voting
    );
    const revote = resolveDayVote(tied);
    const tiedAgain = ['p1', 'p1', 'p2', 'p2'].reduce(
      (game, targetId, index) => submitDayVote(game, fourPlayers[index].id, targetId),
      { ...revote, dayVotes: {} }
    );

    expect(revote).toMatchObject({ phase: 'day-revote', dayVoteResult: { requiresRevote: true } });
    expect(resolveDayVote(tiedAgain).dayVoteResult).toMatchObject({
      eliminatedPlayerId: null,
      requiresRevote: false
    });
  });

  it('declares citizens the winner when every mafia player is eliminated', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const mafiaId = Object.entries(started.roleAssignments).find(([, role]) => role === 'mafia')?.[0];
    if (!mafiaId) {
      throw new Error('The four-player preset must include mafia.');
    }
    const voting = beginDayVote({ ...started, phase: 'day-briefing' });
    const withVotes = fourPlayers.reduce(
      (game, player) => submitDayVote(game, player.id, mafiaId),
      voting
    );

    const resolved = resolveDayVote(withVotes);

    expect(resolved).toMatchObject({ phase: 'result', winner: 'citizens' });
    expect(getWinner(resolved)).toBe('citizens');
  });

  it('starts the next mafia night when the day vote does not end the game', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const citizenId = Object.entries(started.roleAssignments).find(([, role]) => role === 'citizen')?.[0];
    if (!citizenId) {
      throw new Error('The four-player preset must include citizens.');
    }

    const voting = beginDayVote({ ...started, phase: 'day-briefing' });
    const resolved = resolveDayVote(fourPlayers.reduce(
      (game, player) => submitDayVote(game, player.id, citizenId),
      voting
    ));

    expect(resolved).toMatchObject({ phase: 'night-mafia', winner: undefined });
  });
});

describe('automatic resignation', () => {
  it('immediately forfeits a disconnected player and excludes them from the win count', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const mafiaId = Object.entries(started.roleAssignments).find(([, role]) => role === 'mafia')?.[0];
    if (!mafiaId) {
      throw new Error('The four-player preset must include mafia.');
    }

    const resigned = resignGamePlayer({ ...started, phase: 'night-mafia' }, mafiaId);

    expect(resigned.resignedPlayerIds).toEqual([mafiaId]);
    expect(getWinner(resigned)).toBe('citizens');
    expect(() => submitMafiaVote(resigned, mafiaId, 'p2')).toThrow('no longer active');
  });

  it('does not count a disconnected player\'s ballot during day vote resolution', () => {
    const started = startGame(createGame({ roomId: 'room-1', players: fourPlayers }), () => 0);
    const voting = beginDayVote({ ...started, phase: 'day-briefing' });
    const resigned = resignGamePlayer(voting, 'p4');
    const submitted = submitDayVote(
      submitDayVote(submitDayVote(resigned, 'p1', 'p2'), 'p2', 'p2'),
      'p3',
      'p2'
    );

    expect(() => submitDayVote(submitted, 'p4', 'p2')).toThrow('no longer active');
    expect(resolveDayVote(submitted).dayVoteResult?.voteTotals).toEqual({ p2: 3 });
  });
});
