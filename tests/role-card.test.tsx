// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoleCard } from '../apps/web/src/features/game/role-card.js';

describe('RoleCard', () => {
  afterEach(cleanup);

  it('keeps the role hidden until its owner deliberately opens the card', () => {
    render(<RoleCard role="doctor" />);

    expect(screen.getByRole('button', { name: '내 역할 확인' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '내 역할 확인' }));
    expect(screen.getByRole('status')).toHaveTextContent('나의 역할: 의사');
    expect(screen.queryByText('마피아')).not.toBeInTheDocument();
  });
});
