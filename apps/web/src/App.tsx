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
import { RoleCard } from './features/game/role-card.js';
import { PhaseStatus } from './features/game/phase-status.js';
import { MafiaTargetPicker } from './features/game/mafia-target-picker.js';
import { DayVotePicker } from './features/game/day-vote-picker.js';
import { RoleActionPicker } from './features/game/role-action-picker.js';
import { GameResultPanel } from './features/game/game-result-panel.js';
import { EliminationNotice } from './features/game/elimination-notice.js';
import { ResultControls } from './features/game/result-controls.js';
import { PhaseCountdown } from './features/game/phase-countdown.js';
import { MafiaTeamNotice } from './features/game/mafia-team-notice.js';
import { GamePlayerList } from './features/game/game-player-list.js';

export function App() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
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
  const [error, setError] = useState<string | null>(null);
  const inviteRoomCode = roomCodeFromPath(window.location.pathname);
  const inviteTokenFromUrl = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl);
    socketRef.current = socket;
    const onConnect = () => setConnectionState('connected');
    const onDisconnect = () => setConnectionState('reconnecting');
    const onConnectError = () => setConnectionState('error');
    const onRoomState = (nextRoom: PublicRoomState) => {
      if (nextRoom.status === 'closed') {
        setRoom(null);
        setInviteToken(null);
        setIsHost(false);
        setPrivateRole(null);
        setMafiaPlayerIds([]);
        setGamePhase(null);
        setPhaseEndsAt(null);
        setGamePlayers([]);
        setWinner(null);
        setEliminatedPlayerId(null);
        setError('방이 종료되었습니다. 새 방을 만들어 주세요.');
        window.history.replaceState({}, '', '/');
        return;
      }

      setRoom(nextRoom);
    };
    const onPrivateRole = ({ role, mafiaPlayerIds: nextMafiaPlayerIds }: PrivateRole) => {
      setPrivateRole(role);
      setMafiaPlayerIds(nextMafiaPlayerIds ?? []);
    };
    const onPublicGameState = ({ phase, phaseEndsAt: nextPhaseEndsAt, players, winner: nextWinner, eliminatedPlayerId: nextEliminatedPlayerId }: PublicGameState) => {
      setGamePhase(phase);
      setPhaseEndsAt(nextPhaseEndsAt);
      setGamePlayers(players);
      setWinner(nextWinner ?? null);
      setEliminatedPlayerId(nextEliminatedPlayerId ?? null);
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
    });
  }

  function startRoom() {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(SOCKET_EVENTS.roomStart, { roomId: room.code }, (response: StartRoomResponse) => {
      if (!response.ok) {
        setError('게임을 시작할 수 없습니다. 4명 이상인지 확인해 주세요.');
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
    });
  }

  function submitMafiaTarget(targetPlayerId: string) {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(
      SOCKET_EVENTS.gameMafiaTarget,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) {
          setError('대상을 선택할 수 없습니다. 현재 단계와 권한을 확인해 주세요.');
        }
      }
    );
  }

  const eliminatedNickname = eliminatedPlayerId
    ? gamePlayers.find((player) => player.id === eliminatedPlayerId)?.nickname
    : null;

  function submitDayVote(targetPlayerId: string) {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(
      SOCKET_EVENTS.gameDayVote,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) {
          setError('투표를 제출할 수 없습니다. 이미 투표했거나 현재 단계가 아닐 수 있습니다.');
        }
      }
    );
  }

  function submitDoctorProtection(targetPlayerId: string) {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(
      SOCKET_EVENTS.gameDoctorProtect,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) {
          setError('보호 대상을 선택할 수 없습니다. 현재 단계와 권한을 확인해 주세요.');
        }
      }
    );
  }

  function submitPoliceInvestigation(targetPlayerId: string) {
    if (!room || !socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(
      SOCKET_EVENTS.gamePoliceInvestigate,
      { roomId: room.code, targetPlayerId },
      (response: GameCommandResponse) => {
        if (!response.ok) {
          setError('조사 대상을 선택할 수 없습니다. 현재 단계와 권한을 확인해 주세요.');
        }
      }
    );
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
    <main>
      <h1>마피아 게이머즈</h1>
      <ConnectionStatus state={connectionState} />
      {room ? (
        <>
          <p>{room.name} 방이 만들어졌습니다. 친구가 4명 이상 모이면 게임을 시작할 수 있습니다.</p>
          <p>현재 입장 인원: {room.playerCount}명</p>
          {privateRole ? <RoleCard role={privateRole} /> : null}
          {gamePhase ? <PhaseStatus phase={gamePhase} /> : null}
          <PhaseCountdown endsAt={phaseEndsAt} />
          {gamePlayers.length > 0 ? <GamePlayerList players={gamePlayers} /> : null}
          {winner ? <GameResultPanel winner={winner} /> : null}
          {isHost && gamePhase === 'result' ? <ResultControls onClose={closeRoom} onRematch={rematch} /> : null}
          {eliminatedNickname ? <EliminationNotice nickname={eliminatedNickname} /> : null}
          {privateRole === 'mafia' ? <MafiaTeamNotice mafiaPlayerIds={mafiaPlayerIds} players={gamePlayers} /> : null}
          {privateRole === 'mafia' && gamePhase === 'night-mafia' ? (
            <MafiaTargetPicker excludedPlayerIds={mafiaPlayerIds} onSelect={submitMafiaTarget} players={gamePlayers} />
          ) : null}
          {privateRole === 'doctor' && gamePhase === 'night-doctor' ? (
            <RoleActionPicker
              actionLabel="보호"
              description="보호할 한 명을 선택하세요. 자기 보호는 전체 게임에서 한 번만 가능합니다."
              heading="의사 행동"
              onSelect={submitDoctorProtection}
              players={gamePlayers}
            />
          ) : null}
          {privateRole === 'police' && gamePhase === 'night-police' ? (
            <RoleActionPicker
              actionLabel="조사"
              description="조사할 한 명을 선택하세요. 결과는 나에게만 표시됩니다."
              heading="경찰 행동"
              onSelect={submitPoliceInvestigation}
              players={gamePlayers}
            />
          ) : null}
          {gamePhase === 'day-vote' || gamePhase === 'day-revote' ? (
            <DayVotePicker onVote={submitDayVote} players={gamePlayers} />
          ) : null}
          {policeResult ? (
            <p role="status">최근 조사 결과: 선택한 참가자는 {policeResult.alignment === 'mafia' ? '마피아' : '시민'}입니다.</p>
          ) : null}
          {inviteToken ? <InviteCard inviteToken={inviteToken} origin={window.location.origin} roomCode={room.code} /> : null}
          {isHost && room.status === 'lobby' ? (
            <button disabled={room.playerCount < 4} onClick={startRoom} type="button">
              게임 시작
            </button>
          ) : null}
        </>
      ) : inviteRoomCode && inviteTokenFromUrl ? (
        <JoinRoomForm inviteToken={inviteTokenFromUrl} onJoin={joinRoom} roomCode={inviteRoomCode} />
      ) : (
        <CreateRoomForm onCreate={createRoom} />
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}

function roomCodeFromPath(pathname: string): string | null {
  const match = /^\/room\/([A-Za-z0-9-]+)$/.exec(pathname);
  return match?.[1] ?? null;
}
