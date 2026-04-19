/**
 * Safe wrapper around `react-native-webrtc`.
 *
 * On some Android emulators (API < 26) the native WebRTC module is excluded at
 * build/runtime (see MainApplication.kt) because its initialization deadlocks
 * the RN bridge. Importing `react-native-webrtc` then throws during module
 * evaluation as soon as any class is referenced. We load it defensively and
 * expose stubs when it is unavailable so the rest of the app (chat, login,
 * etc.) can still start.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { View } from 'react-native';

let webrtc: any = null;
let webrtcLoadError: Error | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  webrtc = require('react-native-webrtc');
  if (webrtc && typeof webrtc.RTCPeerConnection !== 'function') {
    throw new Error('react-native-webrtc loaded but RTCPeerConnection missing');
  }
} catch (e: any) {
  webrtcLoadError = e instanceof Error ? e : new Error(String(e));
  // eslint-disable-next-line no-console
  console.warn(
    '[webrtc] native module unavailable — calls disabled:',
    webrtcLoadError.message
  );
  webrtc = null;
}

export const isWebRTCAvailable = (): boolean => webrtc !== null;

function unavailable(name: string): never {
  throw new Error(
    `WebRTC is unavailable on this device (${
      webrtcLoadError?.message ?? 'native module missing'
    }); cannot use ${name}.`
  );
}

class StubRTCPeerConnection {
  constructor(_config?: any) {
    unavailable('RTCPeerConnection');
  }
}
class StubRTCSessionDescription {
  constructor(_init?: any) {
    unavailable('RTCSessionDescription');
  }
}
class StubRTCIceCandidate {
  constructor(_init?: any) {
    unavailable('RTCIceCandidate');
  }
}
class StubMediaStream {
  constructor(_tracks?: any) {
    unavailable('MediaStream');
  }
}
const stubMediaDevices = {
  getUserMedia: async () => unavailable('mediaDevices.getUserMedia'),
  enumerateDevices: async () => [],
};

const StubRTCView: React.FC<any> = () => React.createElement(View);

export const RTCPeerConnection: any =
  webrtc?.RTCPeerConnection ?? StubRTCPeerConnection;
export const RTCSessionDescription: any =
  webrtc?.RTCSessionDescription ?? StubRTCSessionDescription;
export const RTCIceCandidate: any =
  webrtc?.RTCIceCandidate ?? StubRTCIceCandidate;
export const MediaStream: any = webrtc?.MediaStream ?? StubMediaStream;
export const mediaDevices: any = webrtc?.mediaDevices ?? stubMediaDevices;
export const RTCView: any = webrtc?.RTCView ?? StubRTCView;

const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function createPeerConnection(): any {
  if (!webrtc) unavailable('createPeerConnection');
  return new webrtc.RTCPeerConnection(iceConfig);
}

export async function getLocalStream(video: boolean): Promise<any> {
  if (!webrtc) unavailable('getLocalStream');
  return await webrtc.mediaDevices.getUserMedia({
    audio: true,
    video: video
      ? { facingMode: 'user', width: 240, height: 320, frameRate: 15 }
      : false,
  });
}
