export function ResultControls({
  onRematch,
  onClose
}: {
  onRematch: () => void;
  onClose: () => void;
}) {
  return (
    <section aria-label="결과 관리" className="result-controls">
      <button className="button-primary" onClick={onRematch} type="button">재경기 시작</button>
      <button className="button-danger" onClick={onClose} type="button">방 종료</button>
    </section>
  );
}
