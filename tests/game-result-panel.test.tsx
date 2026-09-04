// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameResultPanel } from '../apps/web/src/features/game/game-result-panel.js';

describe('GameResultPanel', () => {
  afterEach(cleanup);

  it('announces the citizen team as the winner', () => {
    render(<GameResultPanel winner="citizens" />);

    expect(screen.getByRole('status')).toHaveTextContent('시민 팀 승리');
    expect(screen.getByRole('region', { name: '게임 결과' })).toHaveClass('game-result-panel', 'winner-citizens');
  });
});
