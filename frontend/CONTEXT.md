# Hamza Chat — Project Context

This document gives the next AI/developer the full context needed to work on
this repository without having to re-derive the architecture.

## Overview

`hamza_chat` is a WhatsApp-style mobile chat client built with **Expo
(React Native, TypeScript)**. It talks to a backend over REST + Socket.IO and
supports text messaging, voice notes, file sharing, image / video sharing
(with thumbnails), in-app camera capture (photo and video), and 1:1 audio /
video calls via WebRTC.

- Entry point: `index.ts` → `App.tsx` → `src/navigation/AppNavigator.tsx`
- Expo config: `app.config.ts`
- Strict TypeScript (`tsconfig.json` extends `expo/tsconfig.base`)
- No test runner is configured. Validation is done with `npx tsc --noEmit`.

## Authentication

`AuthContext` exposes `login`, `register`, `verifyEmail`,
`resendVerification`, `cancelVerification`, and `logout`. Registration is a
two-step flow:

1. `POST /auth/register` with `{ email, password }`. The backend (configured
   with a BREVO API key) emails a 6-digit confirmation code and responds with
   `{ pendingVerification: true, email }` — no token is issued yet. For
   backwards compatibility, if the response contains `{ token, user }` the
   user is logged in directly.
2. The user is taken to `VerifyEmailScreen` and submits the code. The
   frontend calls `POST /auth/verify-email` with `{ email, code }` and
   receives `{ token, user }`, completing the login. `POST
   /auth/resend-verification` with `{ email }` re-sends the code.

There are 3 pre-existing TypeScript errors in `src/context/CallContext.tsx`
related to `react-native-webrtc` typings (`onicecandidate`, `ontrack`,
`oniceconnectionstatechange`). They are unrelated to messaging/media work.

## Directory Layout

```
src/
  components/        Presentational UI (AttachmentMenu, VoiceRecorder, …)
  context/           React Context providers (AuthContext, CallContext)
  hooks/             Data + logic hooks (useMessages, useMediaSend, …)
  navigation/        AppNavigator (auth + main stacks, wires everything up)
  screens/           Full-screen views (ChatList, Chat, Login, Register, Call)
  services/          Side-effectful modules (api, socket, messageStore,
                     upload, compress, thumbnail, offlineQueue, webrtc, config)
```

## Message Model

A message (in-memory and in SQLite, see `src/services/messageStore.ts`):

```ts
interface Message {
  id: string;                 // local id ("local_…") or server id (stringified)
  serverId: number | null;
  from: number;               // user id
  to: number;
  type: 'text' | 'image' | 'video' | 'voice' | 'file';
  content: string | null;     // text body
  mediaUrl: string | null;    // remote URL after upload
  thumbnail: string | null;   // small inline `data:image/jpeg;base64,…` preview
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;          // ISO
  status?: 'sent' | 'pending' | 'failed';
}
```

## Send Flow

All sends go through `src/hooks/useMediaSend.ts` → `sendMedia()`:

1. Build an optimistic `pending` message and persist it locally.
2. Upload the binary via `services/upload.ts` (`POST /media/upload`).
3. Enqueue a `send_message` socket event via `services/offlineQueue.ts`.
4. Server `message_sent` ack updates `serverId`, `createdAt`, `status: 'sent'`.

Text messages skip steps 1–2 and go straight from `useMessages.sendText` to
`enqueueMessage('send_message', …)`.

## Feature Map

| Requirement                | Implementation                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Text messages              | `useMessages.sendText` + `ChatScreen` input bar                                                   |
| Voice messages             | `useMediaSend.startRecording / stopRecording` (expo-audio) + `VoiceRecorder` overlay              |
| Share files (any type)     | `useMediaSend.pickFile` (expo-document-picker, `type: '*/*'`) — auto-routes images / videos       |
| Image thumbnail in bubble  | `services/thumbnail.generateThumbnail` (≈2 KB base64) → rendered by `MediaPlaceholder` in chat    |
| Video thumbnail in bubble  | `services/thumbnail.generateVideoThumbnail` (expo-video-thumbnails) → rendered with ▶ overlay     |
| Camera photo capture       | `useMediaSend.takePhoto` → `ImagePicker.launchCameraAsync({ mediaTypes: ['images'] })`            |
| Camera video capture       | `useMediaSend.recordVideo` → `ImagePicker.launchCameraAsync({ mediaTypes: ['videos'] })`          |
| Audio / video calls        | `CallContext` + `services/webrtc.ts` + `CallScreen`                                               |

The `AttachmentMenu` (bottom sheet) exposes Gallery, Camera, Video,
Record Video, File. It is opened from the `+` button in `ChatScreen`'s
input bar and wired in `AppNavigator.ChatWrapper`.

## Thumbnail Rendering Rules (`ChatScreen.MediaPlaceholder`)

- If `message.thumbnail` is a non-empty data URI, render it via `<Image>`.
- Else, for `type === 'image'`, fall back to `mediaUrl` (post-upload).
- Else show the gray placeholder with the type icon.
- For videos, overlay a centered ▶ icon on the thumbnail.

## Backend Contract (assumed, lives in a separate repo)

- `POST /media/upload` → multipart `file`, returns
  `{ url, filename, mimeType, size }` with HTTP 201.
- `GET /messages?userId=<id>&limit=30[&before=<id>]` → `{ messages: [...] }`.
- Socket events: `send_message` (client→server), `message_sent` (ack),
  `new_message` (server→client). See `services/socket.ts`.
- `API_BASE_URL` is read from `app.config.ts` → `extra.apiBaseUrl`.

## Conventions

- WhatsApp dark theme: bg `#111B21`, surface `#1F2C33`, accent `#00A884`,
  sent bubble `#005C4B`, received bubble `#1F2C33`, danger `#F15C6D`,
  primary text `#E9EDEF`, secondary text `#8696A0`.
- Touch targets ≥ 44×44 dp.
- All new code must keep `npx tsc --noEmit` clean (apart from the
  pre-existing CallContext WebRTC errors noted above).

## Useful Commands

```bash
npm install
npm run start          # expo start (Metro bundler)
npm run android        # expo run:android
npm run ios            # expo run:ios
npx tsc --noEmit       # type-check
```
