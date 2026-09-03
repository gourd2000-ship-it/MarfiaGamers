# Ubuntu 직접 배포

이 구성은 Caddy만 인터넷에 공개하고 Node.js/Socket.IO 서버는 `127.0.0.1:3100`에서만 실행한다. 공유기에는 TCP 80과 443만 미니 PC로 전달한다.

## 1. 서버 준비

Ubuntu에 Node.js 22 LTS, Git, Caddy를 설치한다. Caddy는 공식 Ubuntu 패키지를 사용한다.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl git rsync
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

`node --version`이 22 LTS인지 확인한다. 서비스 파일의 npm 위치도 `command -v npm`으로 확인하고, `/usr/bin/npm`과 다르면 `marfia-server.service`의 `ExecStart` 경로를 바꾼다.

## 2. 앱 설치와 빌드

```bash
sudo adduser --system --group --home /opt/marfia marfia
sudo install -d -o marfia -g marfia /opt/marfia
sudo -u marfia git clone https://github.com/gourd2000-ship-it/MarfiaGamers.git /opt/marfia/app
cd /opt/marfia/app
sudo -u marfia npm ci
sudo -u marfia npm run build
sudo install -d -o root -g caddy /srv/marfia/web
sudo rsync -a --delete apps/web/dist/ /srv/marfia/web/
```

## 3. 서비스와 HTTPS 프록시

이미 다른 Caddy 사이트가 운영 중이면 `/etc/caddy/Caddyfile`을 덮어쓰면 안 된다. 사이트별 설정을 별도 파일로 두고 기존 Caddyfile에서 한 번만 import한다.

```bash
sudo install -d -m 750 -o root -g marfia /etc/marfia
sudo install -m 640 -o root -g marfia deployment/ubuntu/server.env /etc/marfia/server.env
sudo install -m 644 deployment/ubuntu/marfia-server.service /etc/systemd/system/marfia-server.service
sudo install -d -m 755 -o root -g root /etc/caddy/sites-enabled
sudo install -m 644 deployment/ubuntu/Caddyfile /etc/caddy/sites-enabled/marfia.caddy
sudoedit /etc/caddy/Caddyfile
```

`sudoedit`로 연 기존 Caddyfile의 마지막에 아래 줄을 추가한다. 이미 같은 줄이 있으면 추가하지 않는다.

```caddyfile
import /etc/caddy/sites-enabled/*
```

그 뒤 설정을 검증한 후 Caddy를 reload한다.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now marfia-server
sudo systemctl reload caddy
```

`WEB_ORIGIN`은 `https://marfia-class.duckdns.org`와 정확히 일치해야 한다. 공개 전에 `curl http://127.0.0.1:3100/health`와 `systemctl status marfia-server caddy`로 확인한다.

## 4. 방화벽과 공유기

직접 콘솔에 접근할 수 있거나 SSH 허용 규칙을 먼저 만든 상태에서만 UFW를 활성화한다.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

공유기에는 TCP 80→미니 PC 80, TCP 443→미니 PC 443만 포트포워딩한다. 3000, SSH, RDP는 외부에 열지 않는다. DuckDNS가 공인 IP를 가리키고 두 포트가 열리면 Caddy가 인증서를 자동 발급한다.

## 5. 외부 검증과 업데이트

Wi-Fi가 아닌 휴대폰 데이터망에서 `https://marfia-class.duckdns.org`를 열어 방 생성·초대·WSS 연결을 확인한다. 이후 학교 태블릿 두 대에서 동일 검증을 10회 이상 기록한다.

업데이트할 때는 테스트 후 다음을 실행한다.

```bash
cd /opt/marfia/app
sudo -u marfia git pull
sudo -u marfia npm ci
sudo -u marfia npm run build
sudo rsync -a --delete apps/web/dist/ /srv/marfia/web/
sudo systemctl restart marfia-server
```
