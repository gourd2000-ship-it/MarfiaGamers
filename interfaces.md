# 인터페이스 계약: 웹 기반 마피아 게임

이 문서는 [PRD](./prd.md)의 현재 MVP 구현 계약이다. 브라우저는 명령을 제출할 뿐이며, 방·역할·타이머·탈락·승패는 서버가 확정한다. 모든 Socket 입력은 서버에서 Zod 스키마로 검증한다.

## 1. 경계와 식별자

| 항목 | 형식 | 설명 |
| --- | --- | --- |
| `roomCode` | 대문자 8자리 16진 문자열 | 초대 URL과 QR에 들어가는 공개 방 코드 |
| `inviteToken` | 32자리 소문자 16진 문자열 | 서버가 방 생성 때 발급하는 비밀 초대 토큰. URL/QR로만 공유하며 공개 상태에는 넣지 않는다. |
| `sessionId` / `playerId` | 현재 Socket.IO 연결 ID | MVP의 참가자 식별자. 연결 단절 시 자동 기권하며 복귀할 수 없다. |
| `revision` | 1 이상의 정수 | 공개 게임 상태가 바뀔 때 서버가 증가시키는 순서 번호 |

- 초대 URL은 `https://{web-host}/room/{roomCode}?token={inviteToken}` 형식이다. QR에는 이 URL만 담으며 역할·행동·세션 ID를 담지 않는다.
- 게임이 시작되면 `room:join`은 거부한다.
- 서버는 메모리에서만 방과 게임을 보관한다. 서버 재시작 또는 향후 방 종료 시 기록은 남지 않는다.

## 2. HTTP

### `GET /health`

```json
{ "status": "ok" }
```

방 목록, 역할, 행동, 게임 기록은 HTTP로 제공하지 않는다.

## 3. Socket 이벤트

모든 명령은 ack를 받는다. `ok: false`이면 클라이언트는 상태를 임의로 바꾸지 않고 오류만 보여 준다.

### 서버 → 브라우저

| 이벤트 | payload | 수신자 | 설명 |
| --- | --- | --- | --- |
| `connection:state` | `{ status: "connected", sessionId }` | 연결한 브라우저 | 연결 직후 전송 |
| `room:state` | `PublicRoomState` | 방 전체 | 로비 참가·시작·기권 상태 |
| `game:public-state` | `PublicGameState` | 방 전체 | 역할·행동·투표자 없이 진행 상태만 전송 |
| `game:private-role` | `PrivateRole` | 해당 참가자 | 시작 때 한 번 전송 |
| `game:private-investigation` | `PrivateInvestigation` | 조사한 경찰 | 조사 결과를 해당 소켓에만 전송 |

### 브라우저 → 서버

| 이벤트 | payload | 허용 조건 |
| --- | --- | --- |
| `room:create` | `{ name, timerSeconds, nickname }` | 누구나. 방 정원은 서버가 20명으로 고정 |
| `room:join` | `{ roomId, inviteToken, nickname }` | 로비·정원 전, 초대 토큰 일치 |
| `room:start` | `{ roomId }` | 방장, 활성 2명 이상 |
| `room:rematch` | `{ roomId }` | 방장, `result` 단계. 현재 연결된 참가자로 새 역할을 자동 배정 |
| `room:close` | `{ roomId }` | 방장. 메모리 방·게임 상태 삭제 |
| `game:mafia-target` | `{ roomId, targetPlayerId }` | 살아 있는 마피아, `night-mafia` |
| `game:doctor-protect` | `{ roomId, targetPlayerId }` | 살아 있는 의사, `night-doctor` |
| `game:police-investigate` | `{ roomId, targetPlayerId }` | 살아 있는 경찰, `night-police` |
| `game:day-vote` | `{ roomId, targetPlayerId }` | 살아 있는 참가자, `day-vote` 또는 `day-revote` |

현재 MVP에는 `room:update-settings` 및 브라우저의 강제 단계 전환 이벤트가 없다.

## 4. 공개·개인 타입

```ts
type GamePhase =
  | "role-reveal"
  | "night-mafia"
  | "night-doctor"
  | "night-police"
  | "day-briefing"
  | "day-vote"
  | "day-revote"
  | "result";

interface PublicGamePlayer {
  id: string;
  nickname: string;
  status: "alive" | "dead" | "resigned";
  isHost: boolean;
}

interface PublicGameState {
  roomCode: string;
  revision: number;
  phase: GamePhase;
  phaseEndsAt: string | null; // 서버 기준 ISO 8601 마감 시각, 결과 단계면 null
  players: PublicGamePlayer[];
  voteTotals?: Record<string, number>;       // 투표자 정보는 없음
  eliminatedPlayerId?: string | null;
  winner?: "mafia" | "citizens";
}

interface PrivateRole {
  role: "mafia" | "doctor" | "police" | "citizen";
  mafiaPlayerIds?: string[]; // 마피아에게만 함께 행동하는 마피아 참가자 ID 목록
}

interface PrivateInvestigation {
  targetPlayerId: string;
  alignment: "mafia" | "citizen";
}

type GameCommandResponse =
  | { ok: true }
  | { ok: false; code: "invalid-payload" | "game-not-found" | "command-rejected" };
```

## 5. 상태와 보안 규칙

- 서버 타이머가 `role-reveal → 밤 행동 → day-briefing → 투표`를 전환한다. 공개 상태의 `phaseEndsAt`으로 모든 브라우저가 남은 시간을 표시하며, 밤·낮 결과에서 승자가 나오면 `result`에서 멈춘다.
- 마피아의 내부 선택, 마피아 동료 목록, 의사의 보호 대상, 경찰의 조사 결과, 개별 투표자는 공개 상태에 포함하지 않는다. 마피아 동료 목록은 마피아의 `PrivateRole`에만 보낸다.
- 낮 투표는 후보별 득표 수와 탈락자만 공개한다. 첫 동률은 재투표, 재동률은 탈락 없이 다음 밤으로 전환한다.
- 의사의 자기 보호는 게임 전체에서 한 번만 가능하다.
- 연결 단절자는 즉시 `resigned`가 되고 이후 행동·투표·승패 인원에서 제외된다.
- 서버는 시작 후 신규 입장을 거부한다. HTTPS 배포에서는 Socket.IO 연결이 WSS로 동작해야 한다.
- 재경기는 결과 단계에서 방장이 요청할 수 있으며, 기권자를 제외한 현재 연결 참가자에게 역할을 새로 배정한다. 방 종료는 메모리 상태를 즉시 삭제하고 이후 입장을 거부한다.

## 6. 검증 매핑

| 계약 | 자동 검증 |
| --- | --- |
| 프리셋·역할 권한·보호·투표·동률·승패·기권 | `tests/game-engine.test.ts` |
| health, Socket, 방 입장/시작, 개인 역할·조사, 타이머, 기권, 결과 | `tests/realtime-server.test.ts` |
| 연결·QR·역할·단계·대상 선택·투표·결과 화면 | `tests/*.test.tsx` |
| QR 입장 → 4명 역할 배정 → 자동 밤/낮 → 비공개 투표 → 승패 → 재경기 | `e2e/lobby-flow.spec.ts` |
| 실제 HTTPS/QR/WSS 학교 기기 호환 | Phase 0 실기기 테스트 (미완료) |

배포 환경 변수와 학교 기기 검증 절차는 [deployment.md](./deployment.md)를 따른다.
