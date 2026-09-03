export type GamePhase =
  | 'role-reveal'
  | 'night-mafia'
  | 'night-doctor'
  | 'night-police'
  | 'day-briefing'
  | 'day-vote'
  | 'day-revote'
  | 'result';

export interface RolePreset {
  playerCount: number;
  mafia: number;
  doctor: number;
  police: number;
  citizen: number;
}

export const MIN_GAME_PLAYERS = 2;
export const MAX_GAME_PLAYERS = 20;

export function createRolePreset(playerCount: number): RolePreset {
  if (!Number.isInteger(playerCount) || playerCount < MIN_GAME_PLAYERS || playerCount > MAX_GAME_PLAYERS) {
    throw new Error(`Player count must be from ${MIN_GAME_PLAYERS} to ${MAX_GAME_PLAYERS}.`);
  }

  const mafia =
    playerCount <= 6 ? 1 :
    playerCount <= 9 ? 2 :
    playerCount <= 13 ? 3 :
    playerCount <= 17 ? 4 : 5;
  const doctor = playerCount >= 6 ? 1 : 0;
  const police = playerCount >= 5 ? 1 : 0;

  return {
    playerCount,
    mafia,
    doctor,
    police,
    citizen: playerCount - mafia - doctor - police
  };
}

export function nextGamePhase(
  currentPhase: GamePhase,
  preset: RolePreset
): GamePhase {
  if (currentPhase === 'role-reveal') {
    return 'night-mafia';
  }

  if (currentPhase === 'night-mafia') {
    return preset.doctor > 0
      ? 'night-doctor'
      : preset.police > 0
        ? 'night-police'
        : 'day-briefing';
  }

  if (currentPhase === 'night-doctor') {
    return preset.police > 0 ? 'night-police' : 'day-briefing';
  }

  return currentPhase === 'result' ? 'result' : 'day-briefing';
}
