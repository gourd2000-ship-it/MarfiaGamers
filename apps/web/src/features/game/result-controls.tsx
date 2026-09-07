export function ResultControls({
  onRematch,
  onClose,
  onReturnToLobby
}: {
  onRematch: () => void;
  onClose: () => void;
  onReturnToLobby: () => void;
}) {
  return (
    <section aria-label="결과 관리" className="result-controls">
      <button className="button-secondary" onClick={onReturnToLobby} type="button">로비로 돌아가기</button>
      <button className="button-primary" onClick={onRematch} type="button">재경기 시작</button>
      <button className="button-danger" onClick={onClose} type="button">방 종료</button>
    </section>
  );
}
