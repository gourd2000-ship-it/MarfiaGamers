import type { GamePhase } from '@marfia/contracts/game-presets';
import type { PrivateRole, PublicGamePlayer } from '@marfia/contracts/socket-events';
import { DayVotePicker } from './day-vote-picker.js';
import { DayEliminationNotice } from './day-elimination-notice.js';
import { GameResultPanel } from './game-result-panel.js';
import { MafiaTargetPicker } from './mafia-target-picker.js';
import { NightResultNotice } from './night-result-notice.js';
import { ResultControls } from './result-controls.js';
import { RoleActionPicker } from './role-action-picker.js';
import { RoleCard } from './role-card.js';
import { VoteResultNotice } from './vote-result-notice.js';

export interface PhaseWorkspaceProps {
  phase: GamePhase;
  role: PrivateRole['role'] | null;
  players: readonly PublicGamePlayer[];
  mafiaPlayerIds: readonly string[];
  policeResult: { targetPlayerId: string; alignment: 'mafia' | 'citizen' } | null;
  winner: 'mafia' | 'citizens' | null;
  eliminatedNickname: string | null;
  dayElimination: { playerId: string; alignment: 'mafia' | 'citizen' } | null;
  nightResult: {
    mafiaTargetPlayerId: string | null;
    doctorTargetPlayerId: string | null;
    eliminatedPlayerId: string | null;
  } | null;
  voteTotals: Readonly<Record<string, number>> | null;
  isHost: boolean;
  canAct: boolean;
  currentPlayerId: string | null;
  onMafiaTarget: (targetPlayerId: string) => boolean | Promise<boolean>;
  onDayVote: (targetPlayerId: string) => boolean | Promise<boolean>;
  onDoctorProtect: (targetPlayerId: string) => boolean | Promise<boolean>;
  onPoliceInvestigate: (targetPlayerId: string) => boolean | Promise<boolean>;
  onRematch: () => void;
  onReturnToLobby: () => void;
  onClose: () => void;
  onLeave: () => void;
}

export function PhaseWorkspace(props: PhaseWorkspaceProps) {
  const { phase } = props;
  return (
    <section aria-labelledby="phase-workspace-heading" className={`phase-workspace phase-${phase}`}>
      <h2 id="phase-workspace-heading" className="sr-only">현재 게임 행동</h2>
      {phase === 'role-reveal' && props.role ? <RoleCard role={props.role} /> : null}
      {phase === 'night-mafia' && props.canAct && props.role === 'mafia' ? (
        <MafiaTargetPicker excludedPlayerIds={props.mafiaPlayerIds} onSelect={props.onMafiaTarget} players={props.players} />
      ) : null}
      {(phase === 'night-mafia' || phase === 'result') && props.dayElimination ? <DayEliminationNotice players={props.players} result={props.dayElimination} /> : null}
      {phase === 'night-doctor' && props.canAct && props.role === 'doctor' ? (
        <RoleActionPicker actionLabel="보호" description="보호할 한 명을 선택하세요. 자기 보호는 전체 게임에서 한 번만 가능합니다." heading="의사 행동" onSelect={props.onDoctorProtect} players={props.players} />
      ) : null}
      {phase === 'night-police' && props.canAct && props.role === 'police' ? (
        <RoleActionPicker actionLabel="조사" description="조사할 한 명을 선택하세요. 결과는 나에게만 표시됩니다." heading="경찰 행동" onSelect={props.onPoliceInvestigate} players={props.players} />
      ) : null}
      {(phase === 'day-vote' || phase === 'day-revote') && props.canAct ? <DayVotePicker currentPlayerId={props.currentPlayerId} isRevote={phase === 'day-revote'} onVote={props.onDayVote} players={props.players} /> : null}
      {(phase === 'day-briefing' || phase === 'result') && props.nightResult ? <NightResultNotice players={props.players} result={props.nightResult} /> : null}
      {phase === 'day-briefing' ? <p className="phase-instruction">밤 결과를 확인하고 낮 투표를 준비하세요.</p> : null}
      {props.voteTotals && (phase === 'day-briefing' || phase === 'day-revote') ? <VoteResultNotice players={props.players} voteTotals={props.voteTotals} /> : null}
      {phase === 'result' && props.winner ? <GameResultPanel winner={props.winner} /> : null}
      {phase === 'result' && props.isHost ? <ResultControls onClose={props.onClose} onRematch={props.onRematch} onReturnToLobby={props.onReturnToLobby} /> : null}
      {phase === 'result' ? <button className="button-secondary" onClick={props.onLeave} type="button">게임 나가기</button> : null}
      {phase === 'night-police' && props.policeResult ? <PoliceResultNotice players={props.players} result={props.policeResult} /> : null}
      {shouldWait(props) ? <p className="waiting-notice" role="status">다른 참가자의 행동을 기다리고 있습니다.</p> : null}
    </section>
  );
}

function PoliceResultNotice({
  players,
  result
}: {
  players: readonly PublicGamePlayer[];
  result: { targetPlayerId: string; alignment: 'mafia' | 'citizen' };
}) {
  const nickname = players.find((player) => player.id === result.targetPlayerId)?.nickname ?? '선택한 참가자';
  const conclusion = result.alignment === 'mafia' ? '맞습니다.' : '아닙니다.';

  return <p className="police-result-notice" role="status"><strong>{nickname}님은 마피아가 {conclusion}</strong></p>;
}

function shouldWait({ phase, role, winner, canAct }: PhaseWorkspaceProps): boolean {
  if (!canAct && phase !== 'role-reveal' && phase !== 'result') return true;
  if (phase === 'result') return !winner;
  if (phase === 'role-reveal') return !role;
  if (phase === 'night-mafia') return role !== 'mafia';
  if (phase === 'night-doctor') return role !== 'doctor';
  if (phase === 'night-police') return role !== 'police';
  return false;
}
