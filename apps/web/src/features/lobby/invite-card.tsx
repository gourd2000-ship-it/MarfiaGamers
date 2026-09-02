import { QRCodeSVG } from 'qrcode.react';

export interface InviteCardProps {
  roomCode: string;
  inviteToken: string;
  origin: string;
}

export function InviteCard({ roomCode, inviteToken, origin }: InviteCardProps) {
  const inviteUrl = `${origin.replace(/\/$/, '')}/room/${roomCode}?token=${encodeURIComponent(inviteToken)}`;

  return (
    <section aria-labelledby="invite-heading">
      <h2 id="invite-heading">친구 초대하기</h2>
      <QRCodeSVG
        aria-label="방 입장 QR 코드"
        level="M"
        role="img"
        size={200}
        value={inviteUrl}
      />
      <label>
        초대 링크
        <input aria-label="초대 링크" readOnly value={inviteUrl} />
      </label>
    </section>
  );
}
