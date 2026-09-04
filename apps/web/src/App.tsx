import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type CreateRoomResponse,
  type CloseRoomResponse,
  type GameCommandResponse,
  type JoinRoomResponse,
  type PrivateRole,
  type PublicGameState,
  type PublicGamePlayer,
  type PublicRoomState,
  type RoomSummary,
  type ServerToClientEvents,
  type StartRoomResponse
} from '@marfia/contracts/socket-events';
import { ConnectionStatus, type ConnectionState } from './components/connection-status.js';
import { CreateRoomForm, type CreateRoomValues } from './features/lobby/create-room-form.js';
import { InviteCard } from './features/lobby/invite-card.js';
import { JoinRoomForm, type JoinRoomValues } from './features/lobby/join-room-form.js';
import { MafiaTeamNotice } from './features/game/mafia-team-notice.js';
import { GamePlayerList } from './features/game/game-player-list.js';
import { GameStatusBar } from './features/game/game-status-bar.js';
import { PhaseWorkspace } from './features/game/phase-workspace.js';
import { PhaseStatus } from './features/game/phase-status.js';

export function App() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const latestRevisionRef = useRef(0);
  const hadRoomRef = useRef(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [privateRole, setPrivateRole] = useState<PrivateRole['role'] | null>(null);
  const [mafiaPlayerIds, setMafiaPlayerIds] = useState<readonly string[]>([]);
  const [gamePhase, setGamePhase] = useState<PublicGameState['phase'] | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<PublicGameState['phaseEndsAt']>(null);
  const [gamePlayers, setGamePlayers] = useState<readonly PublicGamePlayer[]>([]);
  const [policeResult, setPoliceResult] = useState<{ targetPlayerId: string; alignment: 'mafia' | 'citizen' } | null>(null);
  const [winner, setWinner] = useState<PublicGameState['winner'] | null>(null);
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<string | null>(null);
  const [voteTotals, setVoteTotals] = useState<Readonly<Record<string, number>> | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inviteRoomCode = roomCodeFromPath(window.location.pathname);
  const inviteTokenFromUrl = new URLSearchParams(window.location.search).get('token');

  function resetRoomState(message: string) {
    hadRoomRef.current = false;
    latestRevisionRef.current = 0;
    setRoom(null);
    setInviteToken(null);
    setIsHost(false);
    setPrivateRole(null);
    setMafiaPlayerIds([]);
    setGamePhase(null);
    setPhaseEndsAt(null);
    setGamePlayers([]);
    setPoliceResult(null);
    setWinner(null);
    setEliminatedPlayerId(null);
    setVoteTotals(null);
    setIsSkipping(false);
    setError(message);
    window.history.replaceState({}, '', '/');
  }

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl);
    socketRef.current = socket;
    const onConnect = () => setConnectionState('connected');
    const onDisconnect = () => {
      setConnectionState('reconnecting');
      if (hadRoomRef.current) {
        resetRoomState('연결이 끊어져 자동 기권 처리되었습니다. 새 방에 참여해 주세요.');
      }
    };
    const onConnectError = () => setConnectionState('error');
    const onRoomState = (nextRoom: PublicRoomState) => {
      if (nextRoom.status === 'closed') {
        resetRoomState('방이 종료되었습니다. 새 방을 만들어 주세요.');
        return;
      }

      hadRoomRef.current = true;
      setRoom(nextRoom);
      setIsHost(nextRoom.players.some((player) =>
        player.id === socket.id && player.status === 'active' && player.isHost
      ));
    };
    const onPrivateRole = ({ role, mafiaPlayerIds: nextMafiaPlayerIds }: PrivateRole) => {
      setPrivateRole(role);
      setMafiaPlayerIds(nextMafiaPlayerIds ?? []);
    };
    const onPublicGameState = ({
      revision,
      phase,
      phaseEndsAt: nextPhaseEndsAt,
      players,
      winner: nextWinner,
      eliminatedPlayerId: nextEliminatedPlayerId,
      voteTotals: nextVoteTotals
    }: PublicGameState) => {
      if (revision < latestRevisionRef.current) {
        return;
      }

      latestRevisionRef.current = revision;
      if (phase === 'role-reveal') {
        setPrivateRole(null);
        setMafiaPlayerIds([]);
        setPoliceResult(null);
      }
      setGamePhase(phase);
      setPhaseEndsAt(nextPhaseEndsAt);
      setGamePlayers(players);
      setWinner(nextWinner ?? null);
      setEliminatedPlayerId(nextEliminatedPlayerId ?? null);
      setVoteTotals(nextVoteTotals ?? null);
    };
    const onPrivateInvestigation = (result: { targetPlayerId: string; alignment: 'mafia' | 'citizen' }) => {
      setPoliceResult(result);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(SOCKET_EVENTS.roomState, onRoomState);
    socket.on(SOCKET_EVENTS.gamePrivateRole, onPrivateRole);
    socket.on(SOCKET_EVENTS.gamePublicState, onPublicGameState);
    socket.on(SOCKET_EVENTS.gamePrivateInvestigation, onPrivateInvestigation);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(SOCKET_EVENTS.roomState, onRoomState);
      socket.off(SOCKET_EVENTS.gamePrivateRole, onPrivateRole);
      socket.off(SOCKET_EVENTS.gamePublicState, onPublicGameState);
      socket.off(SOCKET_EVENTS.gamePrivateInvestigation, onPrivateInvestigation);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [socketUrl]);

  function createRoom(values: CreateRoomValues) {
    setError(null);
    if (!socketRef.current?.connected) {
      setError('실시간 서버에 연결된 뒤 다시 시도해 주세요.');
      return;
    }

    socketRef.current.emit(SOCKET_EVENTS.roomCreate, values, (response: CreateRoomResponse) => {
      if (!response.ok) {
        setError('방을 만들지 못했습니다. 입력값과 연결 상태를 확인해 주세요.');
        return;
      }

      setRoom(response.room);
      setInviteToken(response.inviteToken);
      setIsHost(true);
      hadRoomRef.current = true;
    });
  }

  function startRoom() {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(SOCKET_EVENTS.roomStart, { roomId: room.code }, (response: StartRoomResponse) => {
      if (!response.ok) {
        setError('게임을 시작할 수 없습니다. 2명 이상인지 확인해 주세요.');
        return;
      }

      setRoom(response.room);
    });
  }

  function joinRoom(values: JoinRoomValues) {
    setError(null);
    if (!socketRef.current?.connected) {
      setError('실시간 서버에 연결된 뒤 다시 시도해 주세요.');
      return;
    }

    socketRef.current.emit(SOCKET_EVENTS.roomJoin, values, (response: JoinRoomResponse) => {
      if (!response.ok) {
        setError('방에 입장할 수 없습니다. 방 코드와 게임 상태를 확인해 주세요.');
        return;
      }

      setIsHost(false);
      setRoom(response.room);
      setInviteToken(values.inviteToken);
      hadRoomRef.current = true;
    });
  }

  function submitMafiaTarget(targetPlayerId: string): Promise<boolean> {
    if (!room || !socketRef.current?.connected) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => socketRef.current!.emit(
      SOCKET_EVENTS.gameMafiaTarget,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) setError('대상을 선택할 수 없습니다. 현재 단계와 권한을 확인해 주세요.');
        resolve(response.ok);
      }
    ));
  }

  function skipPhase(): Promise<boolean> {
    if (!room || !socketRef.current?.connected || isSkipping) {
      return Promise.resolve(false);
    }

    setIsSkipping(true);
    return new Promise((resolve) => socketRef.current!.emit(
      SOCKET_EVENTS.gameSkipPhase,
      { roomId: room.code, expectedRevision: latestRevisionRef.current },
      (response: GameCommandResponse) => {
        setIsSkipping(false);
        if (!response.ok) setError('시간을 넘길 수 없습니다. 방장 권한과 현재 게임 상태를 확인해 주세요.');
        resolve(response.ok);
      }
    ));
  }

  const eliminatedNickname = eliminatedPlayerId
    ? gamePlayers.find((player) => player.id === eliminatedPlayerId)?.nickname
    : null;

  function submitDayVote(targetPlayerId: string): Promise<boolean> {
    if (!room || !socketRef.current?.connected) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => socketRef.current!.emit(
      SOCKET_EVENTS.gameDayVote,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) setError('투표를 제출할 수 없습니다. 이미 투표했거나 현재 단계가 아닐 수 있습니다.');
        resolve(response.ok);
      }
    ));
  }

  function submitDoctorProtection(targetPlayerId: string): Promise<boolean> {
    if (!room || !socketRef.current?.connected) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => socketRef.current!.emit(
      SOCKET_EVENTS.gameDoctorProtect,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) setError('보호 대상을 선택할 수 없습니다. 현재 단계와 권한을 확인해 주세요.');
        resolve(response.ok);
      }
    ));
  }

  function submitPoliceInvestigation(targetPlayerId: string): Promise<boolean> {
    if (!room || !socketRef.current?.connected) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => socketRef.current!.emit(
      SOCKET_EVENTS.gamePoliceInvestigate,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) setError('조사 대상을 선택할 수 없습니다. 현재 단계와 권한을 확인해 주세요.');
        resolve(response.ok);
      }
    ));
  }

  function rematch() {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    setError(null);
    setPrivateRole(null);
    setMafiaPlayerIds([]);
    setPoliceResult(null);
    socketRef.current.emit(SOCKET_EVENTS.roomRematch, { roomId: room.code }, (response: StartRoomResponse) => {
      if (!response.ok) {
        setError('재경기를 시작할 수 없습니다. 결과 화면과 방장 권한을 확인해 주세요.');
      }
    });
  }

  function closeRoom() {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(SOCKET_EVENTS.roomClose, { roomId: room.code }, (response: CloseRoomResponse) => {
      if (!response.ok) {
        setError('방을 종료할 수 없습니다. 방장 권한을 확인해 주세요.');
      }
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span aria-hidden="true" className="brand-mark">◐</span>
          <div>
            <p className="eyebrow">실시간 추리 게임</p>
            <h1>마피아 게이머즈</h1>
          </div>
        </div>
        {gamePhase ? <GameStatusBar endsAt={phaseEndsAt} isSkipping={isSkipping} onSkip={isHost && gamePhase !== 'result' ? () => { void skipPhase(); } : undefined} phase={gamePhase} /> : null}
        <ConnectionStatus state={connectionState} />
      </header>
      <div className={room ? 'app-content has-room' : 'app-content'}>
        {room ? (
          <section className="room-board" aria-label={`${room.name} 게임 보드`}>
            <div className="room-summary">
              {gamePhase ? <PhaseStatus phase={gamePhase} /> : <p>{room.name} 방이 만들어졌습니다. 친구가 2명 이상 모이면 게임을 시작할 수 있습니다.</p>}
              <p>현재 입장 인원: <strong>{room.playerCount}명</strong></p>
            </div>
          {gamePhase ? (
            <div className={`game-board-layout ${gamePhase === 'role-reveal' ? 'is-role-reveal' : ''}`}>
              {gamePhase !== 'role-reveal' ? <aside className="game-players-panel">{gamePlayers.length > 0 ? <GamePlayerList players={gamePlayers} /> : null}</aside> : null}
              <PhaseWorkspace
                eliminatedNickname={eliminatedNickname ?? null}
                canAct={gamePlayers.some((player) => player.id === socketRef.current?.id && player.status === 'alive')}
                isHost={isHost}
                mafiaPlayerIds={mafiaPlayerIds}
                onClose={closeRoom}
                onDayVote={submitDayVote}
                onDoctorProtect={submitDoctorProtection}
                onMafiaTarget={submitMafiaTarget}
                onPoliceInvestigate={submitPoliceInvestigation}
                onRematch={rematch}
                phase={gamePhase}
                players={gamePlayers}
                policeResult={policeResult}
                role={privateRole}
                voteTotals={voteTotals}
                winner={winner ?? null}
              />
              {gamePhase !== 'role-reveal' ? (
                <aside className="game-support-panel">
                  {privateRole === 'mafia' && gamePhase === 'night-mafia' ? <MafiaTeamNotice mafiaPlayerIds={mafiaPlayerIds} players={gamePlayers} /> : null}
                </aside>
              ) : null}
            </div>
          ) : (
            <div className="lobby-board-layout">
              {inviteToken ? <InviteCard inviteToken={inviteToken} origin={window.location.origin} roomCode={room.code} /> : null}
              {isHost && room.status === 'lobby' ? (
                <div className="start-game-control">
                  <button className="button-primary" disabled={room.playerCount < 2} onClick={startRoom} type="button">
                    게임 시작
                  </button>
                  {room.playerCount < 2 ? <p>게임을 시작하려면 2명 이상이 필요합니다.</p> : null}
                </div>
              ) : null}
            </div>
          )}
          </section>
      ) : inviteRoomCode && inviteTokenFromUrl ? (
        <JoinRoomForm inviteToken={inviteTokenFromUrl} onJoin={joinRoom} roomCode={inviteRoomCode} />
      ) : (
        <CreateRoomForm onCreate={createRoom} />
      )}
        {error ? <p className="error-message" role="alert">{error}</p> : null}
      </div>
    </main>
  );
}

function roomCodeFromPath(pathname: string): string | null {
  const match = /^\/room\/([A-Za-z0-9-]+)$/.exec(pathname);
  return match?.[1] ?? null;
}
