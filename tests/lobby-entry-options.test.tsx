// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LobbyEntryOptions } from '../apps/web/src/features/lobby/lobby-entry-options.js';

describe('LobbyEntryOptions', () => {
  afterEach(cleanup);

  it('places room entry before new game creation', () => {
    render(<LobbyEntryOptions onCreate={vi.fn()} onJoin={vi.fn()} />);

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      '방 입장',
      '새 게임 만들기'
    ]);
  });
});
