# Implementation Plan: 웹 기반 마피아 게임

상세 구현 계획은 [roadmap.md](../roadmap.md)에 있다. 이 파일은 계획 진입점이며, 실행 체크리스트는 [todo.md](./todo.md)에서 관리한다.

아키텍처는 React/TypeScript 웹 클라이언트와 Node.js/Socket.IO 권한 서버를 분리한다. 게임 상태는 MVP에서 서버 메모리에만 유지한다. 구현 전 Phase 0의 학교망 HTTPS/WSS 검증과 PRD Open Questions 승인이 필요하다.
