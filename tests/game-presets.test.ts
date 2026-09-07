import { describe, expect, it } from 'vitest';
import {
  createRolePreset,
  nextGamePhase
} from '../packages/contracts/src/game-presets.js';

describe('createRolePreset', () => {
  it('assigns one mafia, two citizens, and one doctor to a four-player game', () => {
    expect(createRolePreset(4)).toEqual({
      playerCount: 4,
      mafia: 1,
      doctor: 1,
      police: 0,
      citizen: 2
    });
  });

  it('assigns one mafia and one citizen to a two-player game', () => {
    expect(createRolePreset(2)).toEqual({
      playerCount: 2,
      mafia: 1,
      doctor: 0,
      police: 0,
      citizen: 1
    });
  });

  it('adds one doctor and one police officer to a five-player game', () => {
    expect(createRolePreset(5)).toEqual({
      playerCount: 5,
      mafia: 1,
      doctor: 1,
      police: 1,
      citizen: 2
    });
  });

  it('uses two mafia for eight players and three mafia for twelve players', () => {
    expect(createRolePreset(8)).toMatchObject({ mafia: 2, doctor: 1, police: 1, citizen: 4 });
    expect(createRolePreset(12)).toMatchObject({ mafia: 3, doctor: 1, police: 1, citizen: 7 });
  });

  it('rejects player counts outside the supported range', () => {
    expect(() => createRolePreset(1)).toThrow('2 to 20');
    expect(() => createRolePreset(21)).toThrow('2 to 20');
  });
});

describe('nextGamePhase', () => {
  it('runs the doctor phase after the mafia phase in a four-player game', () => {
    const preset = createRolePreset(4);

    expect(nextGamePhase('night-mafia', preset)).toBe('night-doctor');
    expect(nextGamePhase('night-doctor', preset)).toBe('day-briefing');
  });

  it('runs doctor and police phases in a five-player game', () => {
    const preset = createRolePreset(5);

    expect(nextGamePhase('night-mafia', preset)).toBe('night-doctor');
    expect(nextGamePhase('night-doctor', preset)).toBe('night-police');
  });
});
