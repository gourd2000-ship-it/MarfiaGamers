// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EliminationNotice } from '../apps/web/src/features/game/elimination-notice.js';

describe('EliminationNotice', () => {
  afterEach(cleanup);

  it('announces the eliminated participant without exposing a role', () => {
    render(<EliminationNotice nickname="하늘" />);

    expect(screen.getByRole('status')).toHaveTextContent('하늘님이 탈락했습니다.');
    expect(screen.getByRole('status')).not.toHaveTextContent('마피아');
    expect(screen.getByRole('status')).toHaveClass('elimination-notice');
  });
});
