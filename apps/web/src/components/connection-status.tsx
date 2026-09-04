export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

const labels: Record<ConnectionState, string> = {
  connecting: '실시간 서버에 연결 중',
  connected: '실시간 서버에 연결됨',
  reconnecting: '다시 연결하는 중',
  error: '실시간 서버 연결 오류'
};

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  return <p className={`connection-status is-${state}`} role="status">{labels[state]}</p>;
}
