// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ConnectionStatus,
  type ConnectionState
} from '../apps/web/src/components/connection-status.js';

describe('ConnectionStatus', () => {
  afterEach(cleanup);

  it.each<[ConnectionState, string]>([
    ['connecting', '실시간 서버에 연결 중'],
    ['connected', '실시간 서버에 연결됨'],
    ['reconnecting', '다시 연결하는 중'],
    ['error', '실시간 서버 연결 오류']
  ])('shows a clear %s state', (state, label) => {
    render(<ConnectionStatus state={state} />);

    expect(screen.getByRole('status')).toHaveTextContent(label);
  });
});
