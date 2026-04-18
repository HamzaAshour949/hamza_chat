# Project Guidelines

## Overview

WhatsApp-style 1-to-1 messaging app engineered for ultra-low bandwidth (5–10 KB/s). Every byte matters. See [prompt.md](../prompt.md) for the full product specification.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Expo (React Native), TypeScript |
| Backend | PHP (Workerman — HTTP + WebSocket on single port 3000) |
| Database | MySQL |
| Real-time | Socket.io protocol, WebSocket-only transport (no long-polling) |
| Infra | Docker Compose (app + MySQL), Nginx reverse proxy with TLS |

## Architecture

- **Single port backend**: One Workerman process serves REST API and WebSocket on port 3000. No separate socket server.
- **Simple DB schema**: `users` + `messages` tables only. No over-engineering.
- **Stateless JWT auth**: Signed JWT with `userId` + expiry (30-day). No sessions, no refresh tokens.
- **Media uploads**: Multipart form to `/media/upload`, UUID filenames on disk, served via `/media/:filename`.
- **Online tracking**: In-memory map of connected users (max 20 concurrent).
- **Offline messages**: Stored in DB, fetched on next login.

## Code Style

- Frontend: TypeScript strict mode. Functional components with hooks.
- Backend: PHP 8+. Single-file entrypoint for Workerman.
- Use descriptive variable names. Keep functions short and focused.

## Low-Bandwidth Conventions

These are critical — never skip compression or send oversized payloads:

- **Images**: JPEG, quality ~50%, max 800×600, target ≤ 50 KB
- **Voice**: AAC/Opus, mono, 16 kHz, 24–32 kbps, target ≤ 30 KB per 10s
- **Video**: 240p, 15 fps, H.264 baseline, target ≤ 500 KB per 15s
- **Thumbnails**: ≤ 2 KB blur hash or base64 inline with socket message; full media loads on tap
- **Pagination**: Load last 30 messages initially, fetch older on scroll-up
- **Optimistic UI**: Messages appear instantly in chat; upload runs in background
- **Local-first**: All messages cached locally (SQLite/AsyncStorage). Chat screen renders from cache.
- **MIME whitelist**: image/jpeg, image/png, image/webp, video/mp4, audio/mp4, audio/m4a, audio/aac, audio/opus, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document. Max 20 MB per file.

## UI Theme (WhatsApp Dark)

| Element | Color |
|---------|-------|
| Background | `#111B21` |
| Cards/surfaces | `#1F2C33` |
| Accent (buttons) | `#00A884` |
| Sent bubble | `#005C4B` |
| Received bubble | `#1F2C33` |
| Text | white / light gray |

## Build and Test

```bash
# Backend
docker compose up          # Starts PHP app + MySQL

# Frontend
cd frontend && npx expo start

# Test accounts (pre-seeded)
# test1@test.com / password123
# test2@test.com / password123
# Set TEST_ACCOUNT=0 or TEST_ACCOUNT=1 to auto-login during development
```

- Android emulator: `10.0.2.2:3000` to reach host
- iOS simulator: `127.0.0.1:3000`

## Constraints

- Android 7+ (API 24+)
- Max 20 concurrent users
- No read receipts, typing indicators, or group chats
- No third-party cloud services — fully self-hosted
- No HTTP long-polling — WebSocket only
