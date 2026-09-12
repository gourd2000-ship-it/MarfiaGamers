# Spec: 게임 중 방 번호 및 60초 재접속

## Objective

게임 화면에서 방 번호를 확인하고, 예상치 못한 연결 종료 또는 페이지 재진입 뒤 60초 안에 같은 기기의 참가자가 기존 역할·게임 상태로 돌아오게 한다. 방 번호만으로 역할을 탈취할 수 없도록 기기별 비공개 재접속 토큰을 검증한다.

## Tech Stack and Commands

- React 19.2.8/Vite 8.2.2, Node.js/TypeScript, Socket.IO 4.8.3, Zod 4.5.4, Vitest 4.1.11
- Focused: `npm test -- tests/realtime-server.test.ts tests/room-session.test.ts`
- Full: `npm test`; lint: `npm run lint`; type: `npm run typecheck`; build: `npm run build`

## Structure and Style

- Contracts: `packages/contracts/src/socket-events.ts`
- Session identity/grace state: `apps/server/src/session/{room-session,room-store}.ts`
- Transport and state resync: `apps/server/src/realtime-server.ts`
- Token storage and game-board room code: `apps/web/src/App.tsx`
- Tests: `tests/room-session.test.ts`, `tests/realtime-server.test.ts`, UI tests

Use the existing Zod validation and discriminated Socket responses:

```ts
const parsed = rejoinRoomSchema.safeParse(payload);
if (!parsed.success) {
  respond({ ok: false, code: 'invalid-payload' });
  return;
}
```

## Testing

- Unit: token validation, reconnect identity binding, 60-second expiry.
- Socket integration: disconnect → valid rejoin → same role and player ID; invalid token → rejected; expiry → resignation.
- UI: room code stays visible during play; token is retained per room session.

## Boundaries

- Always: generate and verify opaque tokens server-side; send private role only to the recovered participant; retain normal game timers.
- Ask first: persistence database, external authentication, dependencies, or CI changes.
- Never: accept room number or nickname alone as proof of player identity; expose reconnect tokens in public state, UI, or logs.

## Success Criteria

- The six-digit room number appears in the game board summary.
- A participant who reconnects with the valid device token in 60 seconds keeps their player ID, role, and submitted actions.
- Invalid/missing tokens cannot recover a role.
- At 60 seconds, the existing resignation path runs; server restarts are out of scope.
