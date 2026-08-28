# Hamza Chat

1:1 chat for slow networks (about 10–15 KB/s). Text, photos, video, and voice. Android 7.0+ (API 24).

Expo React Native client. **Production backend is Firebase** (no Node/PHP). A local Node.js server is included only so two emulators can talk during development.

## Features

- Email/password auth
- Search users by email
- Text, photo, video, voice, files
- Images compressed to ~50 KB JPEG before upload
- Voice recorded as AAC 16 kHz / 24 kbps
- Video captured at low quality, max ~12s
- Tiny thumbnail in the message; full media loads only when tapped
- Local SQLite cache and outbox for offline send
- WebSocket-only (local) or Firestore (Firebase)

## Layout

```
frontend/     Expo app (Android 7+)
server/       Temporary Node test backend (do not deploy)
firebase/     Firestore + Storage security rules
```

## Local emulator testing

Needs Node 22+ and the Android SDK.

```bash
# 1. Test server (binds 0.0.0.0:5101)
cd server
cp ../.env.example ../.env   # optional; JWT_SECRET has a dev default
npm install
npm start

# 2. App
cd ../frontend
cp .env.example .env
# keep EXPO_PUBLIC_BACKEND=local
npm install
npx expo prebuild --platform android
npx expo run:android
```

Emulators reach the host at `10.0.2.2:5101` automatically.

Test accounts (seeded by the local server):

| Email | Password |
|---|---|
| test1@test.com | password123 |
| test2@test.com | password123 |

`EXPO_PUBLIC_TEST_ACCOUNT=0` or `1` auto-logs those accounts.

## Production: Firebase

No server to host. Create a Firebase project, then put the **web app** config in `frontend/.env`:

```
EXPO_PUBLIC_BACKEND=firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

If those Firebase values are set and `EXPO_PUBLIC_BACKEND` is unset, the app uses Firebase. Set `EXPO_PUBLIC_BACKEND=local` to force the test server.

### Console setup (do this once)

1. [Firebase console](https://console.firebase.google.com/) → add a project.
2. Add an app of type **Web**. Copy the config keys above.
3. Authentication → Sign-in method → enable **Email/Password**.
4. Firestore Database → create (start in production mode).
5. Storage → get started.
6. Deploy rules from this repo:

```bash
npm i -g firebase-tools
firebase login
firebase use --add    # pick your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

7. Rebuild the app so the env values are baked in (`npx expo prebuild` / `eas build` / `npx expo run:android`).

Create two users in the app (Register) to chat. Local `test1@test.com` accounts exist only on the Node server, not in Firebase.

## Env vars

### `frontend/.env`

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_BACKEND` | no | `local` or `firebase`. Default: firebase if config present, else local |
| `EXPO_PUBLIC_API_BASE_URL` | local | Full URL, e.g. `http://10.0.2.2:5101`. If empty, host is auto-detected |
| `EXPO_PUBLIC_API_HOST` | local | Host only, used when `API_BASE_URL` is empty |
| `EXPO_PUBLIC_TEST_ACCOUNT` | no | `0` or `1` for auto-login on the local server |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | firebase | From Firebase web config |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | firebase | From Firebase web config |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | firebase | From Firebase web config |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | firebase | From Firebase web config |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | firebase | From Firebase web config |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | firebase | From Firebase web config |

### `server` / repo `.env`

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | dev string | Sign local JWTs |
| `PORT` | `5101` | HTTP + Socket.IO |
| `HOST` | `0.0.0.0` | Bind address |

## APK

```bash
cd frontend
EXPO_PUBLIC_BACKEND=local npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

APK path: `frontend/android/app/build/outputs/apk/release/app-release.apk`

That build talks to the local server at `http://10.0.2.2:5101` (emulator). For a device on Wi-Fi, set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:5101` before prebuild.

For a Firebase APK, set the Firebase env vars and `EXPO_PUBLIC_BACKEND=firebase` before prebuild.

## Low-bandwidth notes

- Chat list and bubbles render from SQLite immediately
- Sends are optimistic; outbox retries when the socket/Firebase reconnects
- Receivers see a ~2 KB thumbnail; tap downloads the full file
- Do not auto-play video or voice
