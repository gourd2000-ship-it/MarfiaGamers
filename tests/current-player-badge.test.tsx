// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CurrentPlayerBadge } from '../apps/web/src/components/current-player-badge.js';

describe('CurrentPlayerBadge', () => {
  afterEach(cleanup);

  it('shows the current player nickname in the header', () => {
    render(<CurrentPlayerBadge nickname="하늘" />);

    expect(screen.getByLabelText('현재 내 이름')).toHaveTextContent('내 이름: 하늘');
  });

  it('renders nothing before the player joins a room', () => {
    const { container } = render(<CurrentPlayerBadge nickname={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
