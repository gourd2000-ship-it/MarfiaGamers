// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VoteResultNotice } from '../apps/web/src/features/game/vote-result-notice.js';

describe('VoteResultNotice', () => {
  afterEach(cleanup);

  it('shows only public candidate totals', () => {
    render(<VoteResultNotice
      players={[
        { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
        { id: 'p2', nickname: '바다', status: 'dead', isHost: false }
      ]}
      voteTotals={{ p1: 3, p2: 1 }}
    />);

    expect(screen.getByRole('heading', { name: '투표 결과' })).toBeInTheDocument();
    expect(screen.getByText('하늘: 3표')).toBeInTheDocument();
    expect(screen.getByText('바다: 1표')).toBeInTheDocument();
  });
});
