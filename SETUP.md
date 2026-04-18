# WhatsApp Clone — Setup & Development Guide

## Overview

This is a fully functional ultra-low-bandwidth WhatsApp-style messaging app built with:
- **Backend**: PHP 8.2 + Workerman + Socket.io + MySQL
- **Frontend**: Expo (React Native) + TypeScript
- **Infra**: Docker Compose + Nginx

## Prerequisites

### Backend
- **Docker Desktop** (macOS, Windows, or Linux)
  - Download: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
  - After install, Docker must be running in the background

### Frontend
- **Node.js 18+** (for Expo CLI)
- **Expo Go app** on your phone OR an emulator (Android/iOS)

## Quick Start

### Step 1: Start the Backend (Docker)

```bash
cd /Users/hamzaashour/Documents/mywork/chatapp
docker compose up --build
```

**Expected output:**
- MySQL initializes and becomes healthy (check logs for `Health check passed`)
- PHP Workerman starts and logs `Listen on http://0.0.0.0:3000 transport tcp`
- Nginx reverse proxy starts on port 80
- No errors in logs

If Docker Desktop is not installed, download and install it first from [docker.com](https://docker.com/products/docker-desktop).

**Verify backend is running:**
```bash
curl http://localhost:3000/health
# Should respond: {"status":"ok"}
```

**Test auth endpoint:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@test.com","password":"password123"}'

# Should respond with a JWT token
```

### Step 2: Start the Frontend (Expo)

In a **new terminal**:

```bash
cd /Users/hamzaashour/Documents/mywork/chatapp/frontend
npx expo start
```

**Expected output:**
- Metro bundler starts
- Shows a QR code and launch options

**Run on simulator/emulator:**
- Press `i` for iOS simulator (macOS only)
- Press `a` for Android emulator (requires Android Studio)

**Or run on physical device:**
- Download **Expo Go** from App Store (iOS) or Play Store (Android)
- Scan the QR code from the terminal

### Step 3: Log In

Use one of the pre-seeded test accounts:

| Email | Password | Purpose |
|-------|----------|---------|
| test1@test.com | password123 | Test user 1 |
| test2@test.com | password123 | Test user 2 |

**Auto-login during development:**
```bash
TEST_ACCOUNT=0 npx expo start   # Logs in as test1
TEST_ACCOUNT=1 npx expo start   # Logs in as test2
```

## Architecture

### Backend Routes

**Authentication:**
- `POST /auth/register` — Register a new user
- `POST /auth/login` — Login and get JWT token

**Messaging:**
- `GET /users/search?email=<query>` — Search users by email
- `GET /conversations` — List recent conversations
- `GET /messages?userId=<id>&before=<msgId>&limit=30` — Paginated message history
- `POST /media/upload` — Upload media (image, video, voice, file)
- `GET /media/<filename>` — Serve media files

**WebSocket Events (Socket.io):**
- `authenticate` → authenticate on connect
- `send_message` → send a message (text or media)
- `new_message` ← incoming message
- `message_sent` ← confirmation with server ID
- `user_online` / `user_offline` ← presence updates

### Frontend Structure

```
frontend/
├── src/
│   ├── screens/           # UI screens (4 total)
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── ChatListScreen.tsx
│   │   └── ChatScreen.tsx
│   ├── components/        # Reusable UI components (6 total)
│   │   ├── AttachmentMenu.tsx
│   │   ├── VoiceRecorder.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   ├── ErrorToast.tsx
│   │   └── NetworkBanner.tsx
│   ├── services/          # HTTP, WebSocket, storage, compression (8 total)
│   │   ├── api.ts
│   │   ├── socket.ts
│   │   ├── messageStore.ts (SQLite)
│   │   ├── compress.ts
│   │   ├── upload.ts
│   │   ├── thumbnail.ts
│   │   ├── offlineQueue.ts
│   │   └── config.ts
│   ├── hooks/             # Custom hooks (4 total)
│   │   ├── useMessages.ts
│   │   ├── useChatList.ts
│   │   ├── useMediaSend.ts
│   │   └── useNetworkStatus.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   └── navigation/
│       └── AppNavigator.tsx
├── App.tsx
└── app.config.ts
```

## Features

### Phase 1: Authentication ✅
- Email/password login & registration
- JWT tokens (30-day expiry)
- Secure token storage
- Auto-login on app restart

### Phase 2: Chat List & User Search ✅
- Search users by email
- List recent conversations
- Last message preview with timestamp

### Phase 3: Real-time Messaging ✅
- WebSocket-only (no HTTP polling)
- Text message support
- Local SQLite cache (offline-first)
- Optimistic UI (messages appear instantly)
- Message pagination (scroll-up to load older)
- Online/offline user tracking

### Phase 4: Media Messaging ✅
- Image upload (gallery/camera) — JPEG, ≤50KB
- Video upload (gallery/camera) — ≤500KB/15s
- Voice messages — AAC, mono, 16kHz, ≤30KB/10s
- File attachments (PDF, DOC, DOCX)
- Thumbnail-first streaming (inline blur hash)
- MIME type whitelist + 20MB size limit

### Phase 5: Polish & Offline ✅
- Offline message queue (sends on reconnect)
- Network status banner ("Connecting...")
- Loading skeletons
- Empty states
- Error toasts
- Nginx reverse proxy with rate limiting

## Testing

### Manual Testing Flow

1. **Open two emulator/device instances** with the backend running
2. **Instance 1:** Login as test1@test.com
3. **Instance 2:** Login as test2@test.com
4. **Instance 1:** Search for test2 in Chat List
5. **Instance 1:** Tap to open a chat with test2
6. **Instance 1:** Send a text message
7. **Instance 2:** Should receive the message in real-time
8. **Instance 2:** Tap the attachment button
9. **Instance 2:** Pick an image from gallery
10. **Instance 2 → Instance 1:** Image should appear with thumbnail

### Network Testing

**Test offline resilience:**
1. Turn off WiFi/cellular on Instance 1
2. Send messages from Instance 2 to Instance 1
3. Turn WiFi back on for Instance 1
4. Messages should appear (fetched from server on reconnect)

**Test low bandwidth:**
- Use Chrome DevTools / Expo Inspector to throttle network
- Verify media compression targets are met (image ≤50KB, voice ≤30KB)

## Troubleshooting

### "Docker: command not found"
- Docker Desktop is not installed
- **Solution**: Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)

### "Cannot connect to http://localhost:3000"
- Backend is not running
- **Solution**: Ensure `docker compose up --build` is running and MySQL is healthy (`Health check passed` in logs)

### "Metro bundler hangs"
- Node.js version mismatch
- **Solution**: Use Node 18+: `node --version`

### "Emulator can't reach backend"
- Android emulator uses `10.0.2.2` to reach host; iOS uses `127.0.0.1`
- This is handled automatically in `frontend/src/services/config.ts`
- If still failing, check Nginx is listening on port 80: `lsof -i :80`

### Messages not syncing
- WebSocket lost connection
- **Solution**: Check network status banner in app (should say "Connected")
- Restart the app if needed

## Customization

### Change API Base URL
Edit `frontend/src/services/config.ts`:
```typescript
const DEV_HOST = 'your-server-ip-or-domain';
```

### Add more test accounts
Edit `backend/init.sql` and re-run migrations:
```sql
INSERT INTO users (email, password) VALUES
('user3@test.com', '<bcrypt hash of password>');
```

### Disable rate limiting
Edit `nginx/nginx.conf`, set `limit_req` to very high values or comment out `limit_req` directives.

### Enable TLS
Create cert/key files and uncomment the HTTPS server block in `nginx/nginx.conf`.

## Performance Tips

- **Images**: Compressed to JPEG 50% quality, max 800×600 (≤50KB)
- **Video**: 240p, 15fps, H.264 baseline (≤500KB/15s)
- **Voice**: AAC mono, 16kHz, 32kbps (≤30KB/10s)
- **Thumbnails**: Inline base64, ≤2KB
- **Message pagination**: Load last 30, fetch older on scroll
- **Local cache**: All messages stored in SQLite for instant chat open

## Development Workflow

### Make a Backend Change
1. Edit `/backend/start.php`
2. Restart: `docker compose restart app`
3. Test with: `curl http://localhost:3000/health`

### Make a Frontend Change
1. Edit files in `/frontend/src/`
2. Hot reload happens automatically (Expo Metro)
3. Full rebuild: Stop `npx expo start`, run again

### Database Schema Change
1. Edit `backend/init.sql`
2. Delete MySQL volume: `docker compose down -v`
3. Restart: `docker compose up --build` (re-initializes DB)

## Files

| Layer | Key Files |
|-------|-----------|
| **Backend** | `backend/start.php` (650 lines, all HTTP + WebSocket) |
| **Frontend** | 4 screens, 6 components, 8 services, 4 hooks |
| **Infra** | `docker-compose.yml`, `nginx/nginx.conf` |
| **Database** | `backend/init.sql` |

## Dependencies

### Backend
- workerman/workerman (^4.1)
- workerman/phpsocket.io (^1.1)
- firebase/php-jwt (^6.10)

### Frontend
- expo (latest with Routing)
- react-native
- @react-navigation/native
- expo-secure-store
- expo-sqlite
- socket.io-client
- expo-image-picker, expo-image-manipulator
- expo-av (audio/video)
- expo-document-picker
- expo-file-system

## License

MIT

## Support

For issues:
1. Check the troubleshooting section above
2. Review logs: `docker compose logs app` (backend) or Expo Metro output (frontend)
3. Verify test account credentials: test1@test.com / password123
