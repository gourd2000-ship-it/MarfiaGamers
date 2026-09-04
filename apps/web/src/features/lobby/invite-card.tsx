import { QRCodeSVG } from 'qrcode.react';
import { useRef, useState } from 'react';

export interface InviteCardProps {
  roomCode: string;
  inviteToken: string;
  origin: string;
}

export function InviteCard({ roomCode, inviteToken, origin }: InviteCardProps) {
  const inviteUrl = `${origin.replace(/\/$/, '')}/room/${roomCode}?token=${encodeURIComponent(inviteToken)}`;
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  function selectInviteUrl() {
    inviteInputRef.current?.focus();
    inviteInputRef.current?.select();
  }

  async function copyInviteUrl() {
    if (!navigator.clipboard?.writeText) {
      selectInviteUrl();
      setCopyMessage('링크를 선택해 복사해 주세요.');
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyMessage('초대 링크를 복사했습니다.');
    } catch {
      selectInviteUrl();
      setCopyMessage('링크를 선택해 복사해 주세요.');
    }
  }

  return (
    <section aria-labelledby="invite-heading" className="invite-card">
      <h2 id="invite-heading">친구 초대하기</h2>
      <p className="card-description">QR 코드를 스캔하거나 링크를 공유해 참여할 수 있어요.</p>
      <div className="invite-content">
        <QRCodeSVG
          aria-label="방 입장 QR 코드"
          className="invite-qr"
          level="M"
          role="img"
          size={200}
          value={inviteUrl}
        />
        <div className="invite-link-group">
          <label className="form-field">
            <span>초대 링크</span>
            <input aria-label="초대 링크" className="form-input" readOnly ref={inviteInputRef} value={inviteUrl} />
          </label>
          <button className="button-secondary" onClick={copyInviteUrl} type="button">초대 링크 복사</button>
          {copyMessage ? <p className="copy-message" role="status">{copyMessage}</p> : null}
        </div>
      </div>
    </section>
  );
}
