// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GamePlayerList } from '../apps/web/src/features/game/game-player-list.js';

describe('GamePlayerList', () => {
  afterEach(cleanup);

  it('shows public survival and resignation states without exposing roles', () => {
    render(<GamePlayerList players={[
      { id: 'p1', nickname: '하늘', status: 'alive', isHost: true },
      { id: 'p2', nickname: '바다', status: 'dead', isHost: false },
      { id: 'p3', nickname: '별', status: 'resigned', isHost: false }
    ]} />);

    expect(screen.getByRole('heading', { name: '참가자 현황' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: '하늘 · 생존 · 방장' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: '바다 · 탈락' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: '별 · 자동 기권' })).toBeInTheDocument();
    expect(screen.queryByText('마피아')).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveClass('player-grid');
    expect(screen.getByText('생존')).toHaveClass('status-badge', 'is-alive');
  });
});
