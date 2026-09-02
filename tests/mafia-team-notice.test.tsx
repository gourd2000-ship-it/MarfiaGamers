// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MafiaTeamNotice } from '../apps/web/src/features/game/mafia-team-notice.js';

describe('MafiaTeamNotice', () => {
  afterEach(cleanup);

  it('shows the names of only the mafia teammates on the private mafia screen', () => {
    render(<MafiaTeamNotice mafiaPlayerIds={['p1', 'p3']} players={[
      { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
      { id: 'p2', nickname: '바다', status: 'alive', isHost: false },
      { id: 'p3', nickname: '별', status: 'alive', isHost: false }
    ]} />);

    expect(screen.getByRole('status')).toHaveTextContent('함께 행동하는 마피아: 하늘, 별');
    expect(screen.getByRole('status')).not.toHaveTextContent('바다');
  });
});
