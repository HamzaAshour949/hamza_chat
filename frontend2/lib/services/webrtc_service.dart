import 'package:flutter_webrtc/flutter_webrtc.dart';

/// WebRTC helpers — mirrors `frontend/src/services/webrtc.ts`.
class WebRTCService {
  static const Map<String, dynamic> iceConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ],
    'sdpSemantics': 'unified-plan',
  };

  static Future<RTCPeerConnection> createPeer() {
    return createPeerConnection(iceConfig);
  }

  /// Low-bandwidth constraints: 240×320, 15 fps, front camera.
  static Future<MediaStream> getLocalStream({required bool video}) async {
    final constraints = <String, dynamic>{
      'audio': true,
      'video': video
          ? {
              'facingMode': 'user',
              'width': {'ideal': 240},
              'height': {'ideal': 320},
              'frameRate': {'ideal': 15, 'max': 15},
            }
          : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }
}
