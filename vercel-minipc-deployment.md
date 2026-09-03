# Vercel 웹 + 미니PC Socket.IO 서버 배포

이 프로젝트의 React/Vite 웹은 Vercel에 배포하고, 실시간 게임 서버는 미니PC에서 실행한다. 브라우저는 Vercel의 HTTPS 페이지에서 미니PC 터널의 HTTPS/WSS 주소로 Socket.IO에 연결한다.

```text
사용자 브라우저
  ├─ https://<project>.vercel.app          → Vercel: React 정적 웹
  └─ https://<mini-pc-tunnel-hostname>     → 미니PC: Node.js + Socket.IO
```

## 1. 필요한 것

- 개발 PC와 미니PC에서 사용할 GitHub 계정
- 미니PC(Windows 10/11, 절전 모드 해제, 안정적인 인터넷 연결)
- 미니PC의 Node.js 22 LTS와 Git
- Vercel 계정
- 미니PC를 인터넷에 공개할 Cloudflare Tunnel 또는 Tailscale Funnel 계정

Vercel에는 `vercel.json`이 포함되어 있다. 루트에서 웹만 빌드하고 `apps/web/dist`를 배포하며, QR 초대 URL(`/room/...`)를 새로고침해도 SPA가 열리도록 `index.html`로 재작성한다.

## 2. 미니PC 최초 설정

미니PC에서 PowerShell을 열고 레포를 내려받는다.

```powershell
git clone https://github.com/gourd2000-ship-it/MarfiaGamers.git D:\MarfiaGamers
cd D:\MarfiaGamers
npm ci
Copy-Item apps\server\.env.production.example apps\server\.env.production
notepad apps\server\.env.production
```

처음에는 Vercel 주소를 아직 모르므로 `.env.production`의 `WEB_ORIGIN`을 비워 두고 서버와 터널을 먼저 확인할 수 있다. 단, 비워 둔 상태는 개발 편의를 위해 모든 원본을 허용하므로 공개 운영 전에 반드시 Vercel의 실제 HTTPS 주소로 바꾼다.

```dotenv
PORT=3000
WEB_ORIGIN=https://your-project.vercel.app
```

서버 시작:

```powershell
npm run start:minipc
```

정상 여부는 미니PC에서 확인한다.

```powershell
Invoke-WebRequest http://127.0.0.1:3000/health
```

`200`과 `{\"status\":\"ok\"}` 응답이면 정상이다.

## 3. 미니PC 서버 공개

### 선택 A: Tailscale Funnel (고정 무료 URL, 테스트/소규모 운영)

Tailscale을 설치해 로그인하고 MagicDNS, HTTPS, Funnel을 켠다. 그 뒤 아래 명령을 관리자 PowerShell에서 실행한다.

```powershell
tailscale funnel --bg 3000
tailscale funnel status
```

출력된 `https://<machine>.<tailnet>.ts.net` 주소가 서버 주소다. Tailscale URL은 무료로 고정되지만 `*.ts.net`이 기관망에서 차단될 수 있다.

### 선택 B: Cloudflare Tunnel (기관 도메인 사용 시 권장)

Cloudflare Named Tunnel을 만들고 공용 호스트 이름을 `http://localhost:3000`으로 연결한다. 터널을 Windows 서비스로 설치한다.

```powershell
cloudflared.exe service install <TUNNEL_TOKEN>
```

Cloudflare Quick Tunnel(`trycloudflare.com`)은 주소가 매번 바뀌므로 실제 수업·행사에는 사용하지 않는다.

어느 방식을 쓰든, 발급된 서버 HTTPS 주소를 기록한다. 예:

```text
https://mafia-server.example.ts.net
```

## 4. Vercel 웹 배포

1. Vercel에서 **Add New → Project**를 선택하고 GitHub 레포를 가져온다.
2. **Root Directory**는 저장소 루트(`.`)로 둔다.
3. `vercel.json`의 명령을 그대로 사용한다. Vercel 화면에서 별도로 변경하지 않는다.
4. Environment Variables에 아래 값을 Production과 Preview 모두에 추가한다.

```text
VITE_SOCKET_URL=https://<mini-pc-tunnel-hostname>
```

5. Deploy를 실행한다.
6. 배포가 끝나면 Production URL을 복사한다. 예:

```text
https://marfia-gamers.vercel.app
```

## 5. CORS 잠금 및 재시작

미니PC의 `apps/server/.env.production` 파일을 실제 Vercel Production URL로 변경한다.

```dotenv
PORT=3000
WEB_ORIGIN=https://marfia-gamers.vercel.app
```

서버를 다시 시작한다. 서버가 실행 중인 PowerShell에서 `Ctrl+C`를 누른 뒤 아래를 실행한다.

```powershell
npm run start:minipc
```

Vercel Preview 배포에서도 게임을 시험하려면 Preview 주소도 쉼표로 추가한다. Preview URL은 배포마다 달라질 수 있으므로 수업 운영 중에는 Production URL만 사용한다.

```dotenv
WEB_ORIGIN=https://marfia-gamers.vercel.app,https://preview-url.vercel.app
```

## 6. 미니PC 자동 시작

Windows 작업 스케줄러에서 **작업 만들기**를 선택한다.

- 트리거: 컴퓨터 시작 시
- 프로그램: `powershell.exe`
- 인수: `-ExecutionPolicy Bypass -File D:\MarfiaGamers\scripts\start-minipc-server.ps1`
- 시작 위치: `D:\MarfiaGamers`
- 조건: AC 전원에서만 실행 조건 해제
- 설정: 실패 시 다시 시작 활성화

미니PC의 절전 모드를 해제하고, Windows Update 자동 재시작 시간도 수업 시간과 겹치지 않게 설정한다.

## 7. 코드 배포 절차

개발 PC에서 테스트 후 GitHub에 올린다.

```powershell
npm run typecheck
npm run lint
npm test
git add .
git commit -m "Describe the change"
git push
```

Vercel은 GitHub push를 감지해 웹을 자동 재배포한다. 미니PC에서는 서버를 업데이트하고 재시작한다.

```powershell
cd D:\MarfiaGamers
git pull
npm ci
npm run start:minipc
```

작업 스케줄러로 서버를 실행 중이면 해당 작업을 종료 후 다시 실행하거나, 재부팅한다.

## 8. 운영 전 확인

1. Vercel URL을 기관망 기기에서 연다.
2. 방을 만들고 QR/초대 URL로 다른 기기에서 입장한다.
3. 화면에 실시간 연결 상태가 표시되는지 확인한다.
4. 게임 시작, 역할 배정, 밤/낮 전환, 투표, 재경기를 확인한다.
5. 미니PC에서 `http://127.0.0.1:3000/health`를 확인한다.

## 막힐 수 있는 부분과 대응

| 증상 | 원인 | 대응 |
| --- | --- | --- |
| Vercel 페이지 자체가 기관망에서 열리지 않음 | 기관의 도메인 분류/방화벽 정책 | 전산 담당자에게 실제 `*.vercel.app` 또는 연결한 기관 도메인의 HTTPS 허용을 요청한다. 코드로 우회할 수 없다. |
| 웹은 열리지만 `실시간 서버 연결 실패`가 표시됨 | 터널 주소 차단, `VITE_SOCKET_URL` 누락, `WEB_ORIGIN` 불일치 | Vercel 환경 변수와 미니PC `.env.production`을 HTTPS 원본 기준으로 다시 비교하고, 터널 호스트의 HTTPS/WSS 허용을 요청한다. |
| 새 Vercel Preview에서는 연결되지 않음 | 서버 CORS가 Production URL만 허용 | Preview URL을 `WEB_ORIGIN`에 임시로 추가하거나 Production 배포에서만 시험한다. |
| 미니PC 재시작 후 방이 사라짐 | 현재 방/게임 상태가 서버 메모리에만 있음 | 정상 동작이다. 수업 전 서버를 재시작하고 새 방을 만든다. 영구 복구가 필요하면 Redis/DB 도입이 별도 개발 과제다. |
| 터널 URL이 바뀜 | Cloudflare Quick Tunnel 사용 | Named Tunnel 또는 Tailscale Funnel로 바꾼다. |

현재 레포에는 외부 서비스의 로그인 정보나 터널 토큰이 없으므로, 실제 Vercel 프로젝트 생성·터널 생성·기관 방화벽 허용은 운영자가 위 절차대로 수행해야 한다.
