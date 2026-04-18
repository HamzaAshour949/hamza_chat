# WhatsApp Clone — Ultra-Low Bandwidth Messaging App

## Concept

A WhatsApp-style messaging app engineered for extremely constrained networks (5–10 KB/s). Two users can exchange text, images, video, voice messages, and files in real-time over connections most apps would consider unusable. Every byte matters.

## Goal

Build a fully functional 1-to-1 chat application that works reliably on 5–10 KB/s connections. The app must feel responsive even when the network is near-unusable — messages queue locally, media compresses aggressively before upload, and the UI never blocks on network activity.

## Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Expo (React Native), TypeScript |
| **Backend** | PHP (Workerman for HTTP + WebSocket on a single port), MySQL |
| **Real-time** | Socket.io protocol over WebSocket-only transport |
| **Infra** | Docker Compose (app + MySQL), Nginx reverse proxy with TLS |

## Core Features

### Authentication
- Email + password registration and login
- JWT tokens (30-day expiry)
- Token stored securely on device, auto-injected into every request
- Auto-login on app relaunch if token is valid

### Contact Discovery
- Search users by email address
- Opening a search result starts a 1-to-1 chat

### Messaging (all types)
1. **Text** — plain text, sent via WebSocket, near-instant delivery
2. **Image from gallery** — pick from device photos, compress before upload
3. **Image from camera** — capture with device camera, compress before upload
4. **Video from gallery** — pick existing video, compress before upload
5. **Video from camera** — record with device camera, compress before upload
6. **Voice message** — hold-to-record, compressed audio, send on release
7. **File attachment** — pick PDF, DOC, or other documents from device

### Real-time
- WebSocket-only transport (no HTTP long-polling — saves bandwidth)
- Server tracks online users in-memory
- Incoming messages delivered instantly via WebSocket event
- Offline messages stored in DB, fetched on next login

### Offline-First / Low-Bandwidth Design
- **Local-first storage**: all messages cached in local SQLite/async-storage so the chat screen renders instantly from cache
- **Optimistic UI**: sent messages appear immediately in the chat, upload happens in background
- **Aggressive media compression**:
  - Images: JPEG, quality ~50%, max 800×600, target ≤ 50 KB
  - Voice: AAC or Opus, mono, 16 kHz, 24–32 kbps, target ≤ 30 KB for a 10-second clip
  - Video: 240p, 15 fps, H.264 baseline, target ≤ 500 KB for a 15-second clip
- **Thumbnail-first for images/video**: send a tiny thumbnail (≤ 2 KB blur hash or base64 thumbnail) inline with the socket message; full media loads on tap
- **Message pagination**: load only the last 30 messages initially, fetch older on scroll-up
- **Minimal payload sizes**: no unnecessary fields in API responses or socket events

## Architecture Principles

- **Single port backend**: one Workerman process serves both HTTP REST and WebSocket on port 3000. No separate socket server.
- **Simple DB schema**: `users` table + `messages` table. No over-engineering.
- **Media uploads**: multipart form upload to `/media/upload`, files stored on disk with UUID filenames, served statically via `/media/:filename`.
- **MIME whitelist**: only allow image/jpeg, image/png, image/webp, video/mp4, audio/mp4, audio/m4a, audio/aac, audio/opus, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document. Max 20 MB per file.
- **Stateless JWT auth**: no sessions, no refresh tokens, just a signed JWT with userId + expiry.

## UI Design

WhatsApp dark theme:
- Background: `#111B21`
- Cards/surfaces: `#1F2C33`
- Primary accent (buttons, sent bubbles): `#00A884` (teal)
- Sent message bubble: `#005C4B`
- Received message bubble: `#1F2C33`
- Text: white/light gray

### Screens
1. **Login / Register** — email + password form, toggle between login and register
2. **Chat List** — list of recent conversations, search bar to find users by email
3. **Chat Screen** — message list + input bar with: text field, send button, attachment menu (photo, camera, video, record video, file), mic button for voice recording

## Testing Setup

- Two test accounts pre-seeded: `test1@test.com` / `password123` and `test2@test.com` / `password123`
- Environment variable for auto-login: `TEST_ACCOUNT=0` or `TEST_ACCOUNT=1` to skip login screen during development
- Android emulator uses `10.0.2.2:3000` to reach host machine; iOS simulator uses `127.0.0.1:3000`

## Constraints

- Must work on Android 7+ (API 24+)
- Max 20 concurrent users (in-memory online tracking is fine)
- No read receipts, no typing indicators, no group chats — keep it simple
- No third-party cloud services (Firebase, AWS, etc.) — fully self-hosted
