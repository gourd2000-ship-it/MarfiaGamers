import { describe, expect, it } from 'vitest';
import {
  createRolePreset,
  nextGamePhase
} from '../packages/contracts/src/game-presets.js';

describe('createRolePreset', () => {
  it('assigns one mafia and three citizens to a four-player game', () => {
    expect(createRolePreset(4)).toEqual({
      playerCount: 4,
      mafia: 1,
      doctor: 0,
      police: 0,
      citizen: 3
    });
  });

  it('adds one police officer but no doctor to a five-player game', () => {
    expect(createRolePreset(5)).toEqual({
      playerCount: 5,
      mafia: 1,
      doctor: 0,
      police: 1,
      citizen: 3
    });
  });

  it('uses two mafia for eight players and three mafia for twelve players', () => {
    expect(createRolePreset(8)).toMatchObject({ mafia: 2, doctor: 1, police: 1, citizen: 4 });
    expect(createRolePreset(12)).toMatchObject({ mafia: 3, doctor: 1, police: 1, citizen: 7 });
  });

  it('rejects player counts outside the supported range', () => {
    expect(() => createRolePreset(3)).toThrow('4 to 20');
    expect(() => createRolePreset(21)).toThrow('4 to 20');
  });
});

describe('nextGamePhase', () => {
  it('skips doctor and police phases when a four-player preset has neither role', () => {
    const preset = createRolePreset(4);

    expect(nextGamePhase('night-mafia', preset)).toBe('day-briefing');
  });

  it('skips the doctor phase but keeps the police phase in a five-player game', () => {
    const preset = createRolePreset(5);

    expect(nextGamePhase('night-mafia', preset)).toBe('night-police');
  });
});
