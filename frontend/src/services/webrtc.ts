import {
  RTCPeerConnection,
  mediaDevices,
} from 'react-native-webrtc';

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(config);
}

export async function getLocalStream(video: boolean) {
  return await mediaDevices.getUserMedia({
    audio: true,
    video: video
      ? { facingMode: 'user', width: 240, height: 320, frameRate: 15 }
      : false,
  });
}
