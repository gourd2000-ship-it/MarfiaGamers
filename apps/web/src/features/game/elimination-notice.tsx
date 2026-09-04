export function EliminationNotice({ nickname }: { nickname: string }) {
  return <p className="elimination-notice" role="status">{nickname}님이 탈락했습니다.</p>;
}
