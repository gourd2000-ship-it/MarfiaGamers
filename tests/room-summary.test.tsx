// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomSummary } from '../apps/web/src/features/lobby/room-summary.js';

describe('RoomSummary', () => {
  afterEach(cleanup);

  it('keeps the room number visible while a game is in progress', () => {
    render(<RoomSummary room={{ code: '123456', name: '1학년 2반', maxPlayers: 20, playerCount: 4, status: 'in-game', timerSeconds: 60 }} phase="night-mafia" />);

    expect(screen.getByText(/방 번호:/)).toHaveTextContent('방 번호: 123456');
  });
});
