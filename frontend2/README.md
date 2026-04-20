# ChatApp — Flutter frontend (frontend2)

Flutter port of the Expo/React Native `frontend/` app. Talks to the **exact
same** PHP Workerman backend (`backend/`) over REST (port 3001) and
Socket.IO v2 / Engine.IO 3 WebSocket (port 3000). No backend changes are
required.

## Requirements

- Flutter SDK 3.19+ (Dart 3.3+)
- Android SDK / NDK (minSdk 24)
- Xcode 15+ (for iOS)
- Running `backend/` service (see top-level `docker-compose.yml`)

## First-time bootstrap

The tree ships hand-written `android/` + iOS entry files (`ios/Runner/Info.plist`,
`AppDelegate.swift`, `Podfile`), but the iOS Xcode project scaffold
(`ios/Runner.xcodeproj`, `ios/Runner/Base.lproj/*.storyboard`, ...) is **not**
vendored — generating a correct `project.pbxproj` by hand is risky. Run the
one-time command below inside `frontend2/` to let Flutter fill in the missing
platform scaffolding **without touching `lib/` or the customized
`AndroidManifest.xml` / `Info.plist`**:

```bash
cd frontend2
flutter create . --project-name chatapp --org com.chatapp --platforms=android,ios
# Re-apply our customized Info.plist / AndroidManifest if prompted (choose 'n'
# when flutter create asks to overwrite files that already exist).
flutter pub get
```

On pure Android-only development this step is optional — the existing
`android/` folder is complete.

## Run

```bash
# Auto-login as test account 0 (test1@test.com / password123):
flutter run --dart-define=TEST_ACCOUNT=0

# Auto-login as test account 1 (test2@test.com / password123):
flutter run --dart-define=TEST_ACCOUNT=1

# Point at a remote backend (defaults otherwise: Android emulator → 10.0.2.2,
# other platforms → 127.0.0.1):
flutter run --dart-define=API_HOST=chat.example.com
```

`API_HOST` drives both REST (`http://$HOST:3001`) and WebSocket
(`http://$HOST:3000`). To talk to a public HTTPS backend, prefix with the full
scheme by editing `lib/config/env.dart` (left intentionally simple to mirror
the RN app).

## Build a release APK

```bash
flutter build apk --release --dart-define=API_HOST=myserver.com
```

The APK lands in `build/app/outputs/flutter-apk/app-release.apk`.

## Test accounts (pre-seeded by the backend)

- `test1@test.com` / `password123` (`TEST_ACCOUNT=0`)
- `test2@test.com` / `password123` (`TEST_ACCOUNT=1`)

## Feature parity

| Feature                                                    | Status |
|------------------------------------------------------------|--------|
| Login / Register / email verification / resend             | ✅     |
| Auto-login via `TEST_ACCOUNT` dart-define                  | ✅     |
| JWT auto-login (local `exp` check)                         | ✅     |
| Conversation list + user search (≥2 chars, 300ms debounce) | ✅     |
| Inverted message list with scroll-up pagination            | ✅     |
| Local SQLite cache + optimistic UI + offline queue         | ✅     |
| Image compression (JPEG q=50, max-w 800)                   | ✅     |
| Inline base64 thumbnails (≈120 px wide, q=30)              | ✅     |
| Video compression (low quality preset, ~240p)              | ✅     |
| Voice recording (AAC mono 16 kHz 32 kbps .m4a)             | ✅     |
| File attachments (whitelist enforced server-side)          | ✅     |
| Network banner (socket disconnect)                         | ✅     |
| WebRTC voice / video calls (offer/answer/ICE, mute, end)   | ✅     |
| STUN `stun:stun.l.google.com:19302`                        | ✅     |

## Known caveats

- **WebRTC requires a real device.** The Android emulator's fake camera
  sometimes fails to enumerate; run `flutter run` against a physical Android
  device (or an iOS device) to test calls.
- Voice-message playback in received bubbles currently shows a static
  progress bar; tap-to-play could be wired up with `just_audio` later.
- Online presence (`user_online` / `user_offline`) is received by the socket
  service but not yet surfaced in the conversation list avatar. The events
  are exposed so the UI can be added without backend changes.
- iOS needs `flutter create .` once (see bootstrap section) to generate the
  Xcode project shell before `flutter build ios` will work.

## Layout

```
lib/
  main.dart
  app.dart
  theme.dart
  config/env.dart
  models/   user.dart, message.dart, conversation.dart
  services/ api_client.dart, auth_storage.dart, socket_service.dart,
            message_store.dart, media_upload.dart, media_compress.dart,
            webrtc_service.dart
  providers/ auth_provider.dart, chat_list_provider.dart,
             messages_provider.dart, call_provider.dart,
             network_provider.dart
  screens/  login_screen.dart, register_screen.dart,
            verify_email_screen.dart, chat_list_screen.dart,
            chat_screen.dart, call_screen.dart, _auth_widgets.dart
  widgets/  message_bubble.dart, media_placeholder.dart, voice_bubble.dart,
            file_bubble.dart, attachment_sheet.dart, voice_recorder_bar.dart,
            network_banner.dart, avatar.dart, conversation_tile.dart
  utils/    format.dart, jwt.dart
```
