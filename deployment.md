# 배포와 학교 기기 검증

Ubuntu 미니 PC를 직접 공개하는 배포는 [deployment/ubuntu/README.md](./deployment/ubuntu/README.md)를 따른다. 이 방식은 같은 HTTPS 도메인에서 정적 웹과 Socket.IO를 제공하며, Node.js 포트는 외부에 열지 않는다.

이 프로젝트는 웹 정적 호스팅과 Node.js 실시간 서버를 따로 배포한다. HTTPS 종료는 선택한 호스팅 서비스 또는 리버스 프록시가 담당하며, 브라우저는 HTTPS 페이지에서 WSS로 Socket.IO 서버에 연결한다.

## 1. 배포 환경 변수

| 배포 대상 | 변수 | 예시 | 의미 |
| --- | --- | --- | --- |
| 웹 빌드 | `VITE_SOCKET_URL` | `https://api.example-school-game.kr` | 공개 Socket.IO 서버의 HTTPS 원본 |
| 서버 실행 | `PORT` | `3000` | 호스팅 플랫폼이 지정한 수신 포트 |
| 서버 실행 | `WEB_ORIGIN` | `https://game.example-school-game.kr` | 허용할 웹 원본. 여러 개면 쉼표로 구분 |

- `WEB_ORIGIN`에는 경로 없이 `https://` 스킴, 도메인, 필요한 경우 포트만 넣는다. 비워 두면 개발 편의를 위해 원본을 반사 허용하므로 프로덕션에서는 반드시 설정한다.
- 정적 웹을 빌드하기 전에 `apps/web/.env.production.example`을 참고해 호스팅 플랫폼의 빌드 환경 변수로 `VITE_SOCKET_URL`을 설정한다. 이 값은 브라우저 번들에 포함되므로 비밀값을 넣으면 안 된다.
- 서버 시작 명령은 `npm run start -w @marfia/server`이다. `/health`는 배포 상태 확인에 사용한다.

## 2. HTTPS/WSS 프록시

정적 웹과 서버를 같은 도메인에서 제공할 수 있으면 `VITE_SOCKET_URL`을 생략해도 된다. 별도 도메인이라면 서버의 `WEB_ORIGIN`과 웹의 `VITE_SOCKET_URL`을 서로 대응시킨다.

Socket.IO 프록시는 `/socket.io/` 경로에서 WebSocket 업그레이드를 전달해야 한다. Nginx 또는 Caddy 등 프록시의 연결 유휴 시간 제한은 Socket.IO 기본 `pingInterval + pingTimeout`(45초)보다 길게 설정한다.

## 3. 학교 기기 Phase 0 기록

배포 주소가 정해진 뒤, 서로 다른 학교 태블릿 두 대에서 아래를 각각 10회 기록한다.

1. HTTPS 웹 주소를 열고 QR 코드가 표시되는지 확인한다.
2. QR을 스캔해 두 번째 브라우저에서 방에 입장한다. 카메라 권한이 막히면 URL 붙여넣기로도 입장한다.
3. `실시간 서버에 연결됨` 상태와 참가 인원 동기화를 확인한다.
4. 4명 게임을 시작해 역할 카드·밤/낮 전환·투표·결과·재경기를 확인한다.
5. 한 기기의 네트워크를 끊어 다른 기기에 `resigned` 상태가 표시되고, 해당 참가자가 이후 행동·투표에서 제외되는지 확인한다.

기록할 항목은 기기/브라우저, 시간, URL·WSS 성공 여부, QR 권한, 오류 메시지다. 실패 시 학교 IT 담당자에게 웹 도메인과 실시간 서버 도메인의 HTTPS/WSS 허용을 요청한다.
