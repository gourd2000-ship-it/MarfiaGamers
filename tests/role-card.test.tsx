// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoleCard } from '../apps/web/src/features/game/role-card.js';

describe('RoleCard', () => {
  afterEach(cleanup);

  it('shows only the current participant role with an accessible label', () => {
    render(<RoleCard role="doctor" />);

    expect(screen.getByRole('status')).toHaveTextContent('나의 역할: 의사');
    expect(screen.queryByText('마피아')).not.toBeInTheDocument();
  });
});
