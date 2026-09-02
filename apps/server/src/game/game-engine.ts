import { randomInt } from 'node:crypto';
import {
  createRolePreset,
  nextGamePhase,
  type GamePhase,
  type RolePreset
} from '@marfia/contracts/game-presets';

export type GameRole = 'mafia' | 'doctor' | 'police' | 'citizen';

export interface GamePlayer {
  id: string;
  name: string;
}

export interface GameState {
  roomId: string;
  players: readonly GamePlayer[];
  preset?: RolePreset;
  phase?: GamePhase;
  roleAssignments: Readonly<Record<string, GameRole>>;
  doctorTargetId?: string;
  doctorHasSelfProtected: boolean;
  policeResult?: { targetId: string; alignment: 'mafia' | 'citizen' };
  mafiaVotes: Readonly<Record<string, string>>;
  nightResult?: { eliminatedPlayerId: string | null };
  dayVotes: Readonly<Record<string, string>>;
  dayVoteResult?: { eliminatedPlayerId: string | null; voteTotals: Record<string, number>; requiresRevote: boolean };
  eliminatedPlayerIds: readonly string[];
  resignedPlayerIds: readonly string[];
  winner?: 'mafia' | 'citizens';
}

export interface CreateGameInput {
  roomId: string;
  players: readonly GamePlayer[];
}

export function createGame(input: CreateGameInput): GameState {
  if (!input.roomId.trim()) {
    throw new Error('Room ID is required.');
  }

  if (new Set(input.players.map((player) => player.id)).size !== input.players.length) {
    throw new Error('Player IDs must be unique.');
  }

  return {
    roomId: input.roomId,
    players: [...input.players],
    roleAssignments: {},
    doctorHasSelfProtected: false,
    mafiaVotes: {},
    dayVotes: {},
    eliminatedPlayerIds: [],
    resignedPlayerIds: []
  };
}

export function resignGamePlayer(game: GameState, playerId: string): GameState {
  if (!game.players.some((player) => player.id === playerId)) {
    throw new Error('Only a player in this game can resign.');
  }
  if (game.resignedPlayerIds.includes(playerId)) {
    return game;
  }

  return {
    ...game,
    resignedPlayerIds: [...game.resignedPlayerIds, playerId],
    mafiaVotes: removePlayerVotes(game.mafiaVotes, playerId),
    dayVotes: removePlayerVotes(game.dayVotes, playerId),
    doctorTargetId: game.roleAssignments[playerId] === 'doctor' || game.doctorTargetId === playerId
      ? undefined
      : game.doctorTargetId
  };
}

export function submitDoctorProtection(
  game: GameState,
  doctorId: string,
  targetId: string
): GameState {
  if (game.phase !== 'night-doctor') {
    throw new Error('Doctor protection is only allowed during the doctor phase.');
  }
  if (game.roleAssignments[doctorId] !== 'doctor') {
    throw new Error('Only the doctor can protect a player.');
  }
  if (!isActivePlayer(game, doctorId) || !isActivePlayer(game, targetId)) {
    throw new Error('Only active players can protect or be protected.');
  }
  if (game.doctorTargetId) {
    throw new Error('The doctor already submitted a protection target.');
  }
  if (targetId === doctorId && game.doctorHasSelfProtected) {
    throw new Error('The doctor can only protect themselves once in the whole game.');
  }

  return {
    ...game,
    doctorTargetId: targetId,
    doctorHasSelfProtected: game.doctorHasSelfProtected || targetId === doctorId
  };
}

export function submitPoliceInvestigation(
  game: GameState,
  policeId: string,
  targetId: string
): GameState {
  if (game.phase !== 'night-police') {
    throw new Error('Police investigation is only allowed during the police phase.');
  }
  if (game.roleAssignments[policeId] !== 'police') {
    throw new Error('Only the police can investigate a player.');
  }
  if (!isActivePlayer(game, policeId) || !isActivePlayer(game, targetId)) {
    throw new Error('Only active players can investigate or be investigated.');
  }
  if (game.policeResult) {
    throw new Error('The police already submitted an investigation.');
  }

  return {
    ...game,
    policeResult: {
      targetId,
      alignment: game.roleAssignments[targetId] === 'mafia' ? 'mafia' : 'citizen'
    }
  };
}

export function submitMafiaVote(
  game: GameState,
  mafiaId: string,
  targetId: string
): GameState {
  if (game.phase !== 'night-mafia') {
    throw new Error('Mafia voting is only allowed during the mafia phase.');
  }
  if (game.roleAssignments[mafiaId] !== 'mafia') {
    throw new Error('Only mafia players can select a target.');
  }
  if (!isActivePlayer(game, mafiaId)) {
    throw new Error('This player is no longer active.');
  }
  if (game.mafiaVotes[mafiaId]) {
    throw new Error('This mafia player already submitted a target.');
  }
  if (!isActivePlayer(game, targetId)) {
    throw new Error('The mafia target must be an active player in this game.');
  }
  if (game.roleAssignments[targetId] === 'mafia') {
    throw new Error('Mafia cannot select another mafia player.');
  }

  return {
    ...game,
    mafiaVotes: { ...game.mafiaVotes, [mafiaId]: targetId }
  };
}

export function resolveNight(game: GameState): GameState {
  if (!game.phase?.startsWith('night-')) {
    throw new Error('Night actions can only be resolved during a night phase.');
  }

  const activeMafiaVotes = Object.entries(game.mafiaVotes)
    .filter(([mafiaId, targetId]) => game.roleAssignments[mafiaId] === 'mafia' && isActivePlayer(game, mafiaId) && isActivePlayer(game, targetId))
    .map(([, targetId]) => targetId);
  const mafiaTargetId = uniqueHighestTarget(activeMafiaVotes);
  const doctorTargetId = game.doctorTargetId && isActivePlayer(game, game.doctorTargetId)
    ? game.doctorTargetId
    : undefined;
  const eliminatedPlayerId = mafiaTargetId && mafiaTargetId !== doctorTargetId
    ? mafiaTargetId
    : null;

  const resolved = {
    ...game,
    nightResult: { eliminatedPlayerId },
    eliminatedPlayerIds: addEliminatedPlayer(game.eliminatedPlayerIds, eliminatedPlayerId)
  };
  const winner = getWinner(resolved);

  return {
    ...resolved,
    phase: winner ? 'result' : 'day-briefing',
    winner: winner ?? undefined
  };
}

export function beginDayVote(game: GameState): GameState {
  if (game.phase !== 'day-briefing') {
    throw new Error('Day voting can only begin after the day briefing.');
  }

  return { ...game, phase: 'day-vote', dayVotes: {} };
}

export function submitDayVote(game: GameState, voterId: string, targetId: string): GameState {
  if (game.phase !== 'day-vote' && game.phase !== 'day-revote') {
    throw new Error('Day voting is not active.');
  }
  if (!isActivePlayer(game, voterId) || !isActivePlayer(game, targetId)) {
    throw new Error('This player is no longer active and cannot vote or receive votes.');
  }
  if (game.dayVotes[voterId]) {
    throw new Error('This player already submitted a vote.');
  }

  return { ...game, dayVotes: { ...game.dayVotes, [voterId]: targetId } };
}

export function resolveDayVote(game: GameState): GameState {
  if (game.phase !== 'day-vote' && game.phase !== 'day-revote') {
    throw new Error('Day voting is not active.');
  }

  const activeVotes = Object.entries(game.dayVotes)
    .filter(([voterId, targetId]) => isActivePlayer(game, voterId) && isActivePlayer(game, targetId))
    .map(([, targetId]) => targetId);
  const voteTotals = countTargets(activeVotes);
  const eliminatedPlayerId = uniqueHighestTarget(activeVotes);
  const requiresRevote = game.phase === 'day-vote' && eliminatedPlayerId === null && Object.keys(voteTotals).length > 0;

  const resolved = {
    ...game,
    dayVoteResult: { eliminatedPlayerId, voteTotals, requiresRevote },
    eliminatedPlayerIds: addEliminatedPlayer(game.eliminatedPlayerIds, eliminatedPlayerId)
  };
  if (requiresRevote) {
    return { ...resolved, phase: 'day-revote' };
  }

  const winner = getWinner(resolved);
  if (winner) {
    return { ...resolved, phase: 'result', winner };
  }

  return {
    ...resolved,
    phase: 'night-mafia',
    mafiaVotes: {},
    doctorTargetId: undefined,
    policeResult: undefined,
    nightResult: undefined,
    winner: undefined
  };
}

export function getWinner(game: GameState): 'mafia' | 'citizens' | null {
  const aliveRoles = game.players
    .filter((player) => isActivePlayer(game, player.id))
    .map((player) => game.roleAssignments[player.id]);
  const mafiaCount = aliveRoles.filter((role) => role === 'mafia').length;
  const citizenCount = aliveRoles.length - mafiaCount;

  if (mafiaCount === 0) {
    return 'citizens';
  }
  return mafiaCount >= citizenCount ? 'mafia' : null;
}

export function startGame(
  game: GameState,
  random: () => number = secureRandom
): GameState {
  const preset = createRolePreset(game.players.length);
  const roles = shuffle(buildRoleList(preset), random);
  const roleAssignments = Object.fromEntries(
    game.players.map((player, index) => [player.id, roles[index]])
  ) as Record<string, GameRole>;

  return {
    ...game,
    preset,
    phase: 'role-reveal',
    roleAssignments
  };
}

export function advanceGamePhase(game: GameState): GameState {
  if (!game.preset || !game.phase) {
    throw new Error('The game has not started.');
  }

  return {
    ...game,
    phase: nextGamePhase(game.phase, game.preset)
  };
}

function buildRoleList(preset: RolePreset): GameRole[] {
  return [
    ...Array<GameRole>(preset.mafia).fill('mafia'),
    ...Array<GameRole>(preset.doctor).fill('doctor'),
    ...Array<GameRole>(preset.police).fill('police'),
    ...Array<GameRole>(preset.citizen).fill('citizen')
  ];
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function secureRandom(): number {
  return randomInt(0, 2 ** 32) / 2 ** 32;
}

function uniqueHighestTarget(targetIds: readonly string[]): string | null {
  const totals = new Map(Object.entries(countTargets(targetIds)));

  let winner: string | null = null;
  let highest = 0;
  let tied = false;
  for (const [targetId, total] of totals) {
    if (total > highest) {
      winner = targetId;
      highest = total;
      tied = false;
    } else if (total === highest) {
      tied = true;
    }
  }

  return tied ? null : winner;
}

function countTargets(targetIds: readonly string[]): Record<string, number> {
  return targetIds.reduce<Record<string, number>>((totals, targetId) => {
    totals[targetId] = (totals[targetId] ?? 0) + 1;
    return totals;
  }, {});
}

function addEliminatedPlayer(playerIds: readonly string[], playerId: string | null): readonly string[] {
  if (!playerId || playerIds.includes(playerId)) {
    return playerIds;
  }
  return [...playerIds, playerId];
}

function isActivePlayer(game: GameState, playerId: string): boolean {
  return game.players.some((player) => player.id === playerId)
    && !game.eliminatedPlayerIds.includes(playerId)
    && !game.resignedPlayerIds.includes(playerId);
}

function removePlayerVotes(votes: Readonly<Record<string, string>>, playerId: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(votes).filter(([voterId, targetId]) => voterId !== playerId && targetId !== playerId)
  );
}
