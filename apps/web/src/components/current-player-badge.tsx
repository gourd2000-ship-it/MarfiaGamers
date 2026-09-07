export function CurrentPlayerBadge({ nickname }: { nickname: string | null }) {
  if (!nickname) {
    return null;
  }

  return <p aria-label="현재 내 이름" className="current-player-badge">내 이름: <strong>{nickname}</strong></p>;
}
