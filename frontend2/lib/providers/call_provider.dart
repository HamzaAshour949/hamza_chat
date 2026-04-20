import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../services/socket_service.dart';
import '../services/webrtc_service.dart';

enum CallState { idle, outgoing, incoming, connected }

enum CallType { voice, video }

String _callTypeToString(CallType t) => t == CallType.video ? 'video' : 'voice';
CallType _callTypeFromString(String? s) =>
    s == 'video' ? CallType.video : CallType.voice;

class CallProvider extends ChangeNotifier {
  final SocketService _socket;

  CallState _state = CallState.idle;
  CallType _type = CallType.voice;
  int? _remoteUserId;
  String _remoteEmail = '';
  int _duration = 0;
  bool _muted = false;

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  MediaStream? _remoteStream;
  final RTCVideoRenderer localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer remoteRenderer = RTCVideoRenderer();

  Timer? _durationTimer;
  Map<String, dynamic>? _pendingOffer;
  final List<Map<String, dynamic>> _pendingCandidates = [];

  final List<void Function()> _offs = [];

  CallState get state => _state;
  CallType get type => _type;
  int? get remoteUserId => _remoteUserId;
  String get remoteEmail => _remoteEmail;
  int get duration => _duration;
  bool get muted => _muted;
  MediaStream? get localStream => _localStream;
  MediaStream? get remoteStream => _remoteStream;

  CallProvider(this._socket) {
    _bindRenderers();
    _offs.addAll([
      _socket.on('call_offer', _onCallOffer),
      _socket.on('call_answer', _onCallAnswer),
      _socket.on('ice_candidate', _onIceCandidate),
      _socket.on('call_ended', (_) => _cleanup()),
      _socket.on('call_rejected', (_) => _cleanup()),
      _socket.on('call_unavailable', (_) => _cleanup()),
      _socket.on('user_offline', (data) {
        if (data is Map &&
            data['userId'] == _remoteUserId &&
            _state != CallState.idle) {
          _cleanup();
        }
      }),
    ]);
  }

  Future<void> _bindRenderers() async {
    await localRenderer.initialize();
    await remoteRenderer.initialize();
  }

  Future<void> startCall(int userId, String email, CallType type) async {
    if (_state != CallState.idle) return;

    _type = type;
    _remoteUserId = userId;
    _remoteEmail = email;
    _state = CallState.outgoing;
    notifyListeners();

    try {
      final stream = await WebRTCService.getLocalStream(
        video: type == CallType.video,
      );
      _localStream = stream;
      localRenderer.srcObject = stream;

      final pc = await _setupPc(stream, userId);
      final offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      _socket.emit('call_offer', {
        'to': userId,
        'offer': {'type': offer.type, 'sdp': offer.sdp},
        'callType': _callTypeToString(type),
      });
      notifyListeners();
    } catch (e) {
      debugPrint('startCall failed: $e');
      _cleanup();
    }
  }

  Future<void> acceptCall() async {
    if (_state != CallState.incoming ||
        _remoteUserId == null ||
        _pendingOffer == null) {
      return;
    }
    final targetId = _remoteUserId!;

    try {
      final isVideo = _type == CallType.video;
      final stream = await WebRTCService.getLocalStream(video: isVideo);
      _localStream = stream;
      localRenderer.srcObject = stream;

      final pc = await _setupPc(stream, targetId);

      await pc.setRemoteDescription(
        RTCSessionDescription(
          _pendingOffer!['sdp'] as String?,
          _pendingOffer!['type'] as String?,
        ),
      );
      _pendingOffer = null;

      for (final c in _pendingCandidates) {
        await pc.addCandidate(_iceFromMap(c));
      }
      _pendingCandidates.clear();

      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      _socket.emit('call_answer', {
        'to': targetId,
        'answer': {'type': answer.type, 'sdp': answer.sdp},
      });
      notifyListeners();
    } catch (e) {
      debugPrint('acceptCall failed: $e');
      _cleanup();
    }
  }

  void rejectCall() {
    if (_remoteUserId != null) {
      _socket.emit('call_reject', {'to': _remoteUserId});
    }
    _cleanup();
  }

  void endCall() {
    if (_remoteUserId != null) {
      _socket.emit('call_end', {'to': _remoteUserId});
    }
    _cleanup();
  }

  void toggleMute() {
    final stream = _localStream;
    if (stream == null) return;
    final audioTracks = stream.getAudioTracks();
    if (audioTracks.isEmpty) return;
    final t = audioTracks.first;
    t.enabled = !t.enabled;
    _muted = !t.enabled;
    notifyListeners();
  }

  Future<RTCPeerConnection> _setupPc(MediaStream stream, int targetId) async {
    final pc = await WebRTCService.createPeer();
    _pc = pc;

    for (final t in stream.getTracks()) {
      await pc.addTrack(t, stream);
    }

    pc.onIceCandidate = (c) {
      // Emit every candidate to the remote peer.
      _socket.emit('ice_candidate', {
        'to': targetId,
        'candidate': {
          'candidate': c.candidate,
          'sdpMid': c.sdpMid,
          'sdpMLineIndex': c.sdpMLineIndex,
        },
      });
    };

    pc.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        _remoteStream = event.streams.first;
        remoteRenderer.srcObject = _remoteStream;
        notifyListeners();
      }
    };

    pc.onIceConnectionState = (s) {
      if (s == RTCIceConnectionState.RTCIceConnectionStateConnected ||
          s == RTCIceConnectionState.RTCIceConnectionStateCompleted) {
        _state = CallState.connected;
        notifyListeners();
        _durationTimer ??=
            Timer.periodic(const Duration(seconds: 1), (_) {
          _duration++;
          notifyListeners();
        });
      } else if (s == RTCIceConnectionState.RTCIceConnectionStateFailed ||
          s == RTCIceConnectionState.RTCIceConnectionStateDisconnected) {
        _cleanup();
      }
    };

    return pc;
  }

  RTCIceCandidate _iceFromMap(Map<String, dynamic> c) {
    return RTCIceCandidate(
      c['candidate'] as String?,
      c['sdpMid'] as String?,
      (c['sdpMLineIndex'] as num?)?.toInt(),
    );
  }

  void _onCallOffer(dynamic data) {
    if (data is! Map) return;
    if (_state != CallState.idle) {
      _socket.emit('call_reject', {'to': data['from']});
      return;
    }
    _pendingOffer = Map<String, dynamic>.from(data['offer'] as Map);
    _pendingCandidates.clear();
    _type = _callTypeFromString(data['callType'] as String?);
    _remoteUserId = (data['from'] as num?)?.toInt();
    _remoteEmail =
        (data['fromEmail'] as String?) ?? 'User ${_remoteUserId ?? ''}';
    _state = CallState.incoming;
    notifyListeners();
  }

  Future<void> _onCallAnswer(dynamic data) async {
    final pc = _pc;
    if (pc == null || data is! Map) return;
    try {
      final ans = Map<String, dynamic>.from(data['answer'] as Map);
      await pc.setRemoteDescription(
        RTCSessionDescription(ans['sdp'] as String?, ans['type'] as String?),
      );
      for (final c in _pendingCandidates) {
        await pc.addCandidate(_iceFromMap(c));
      }
      _pendingCandidates.clear();
    } catch (e) {
      debugPrint('onCallAnswer error: $e');
    }
  }

  Future<void> _onIceCandidate(dynamic data) async {
    if (data is! Map) return;
    final c = Map<String, dynamic>.from(data['candidate'] as Map);
    final pc = _pc;
    if (pc != null && (await pc.getRemoteDescription()) != null) {
      try {
        await pc.addCandidate(_iceFromMap(c));
      } catch (e) {
        debugPrint('addIce error: $e');
      }
    } else {
      _pendingCandidates.add(c);
    }
  }

  void _cleanup() {
    _durationTimer?.cancel();
    _durationTimer = null;
    try {
      for (final t in _localStream?.getTracks() ?? []) {
        t.stop();
      }
    } catch (_) {}
    _localStream?.dispose();
    _remoteStream = null;
    _localStream = null;
    localRenderer.srcObject = null;
    remoteRenderer.srcObject = null;
    try {
      _pc?.close();
    } catch (_) {}
    _pc = null;
    _pendingOffer = null;
    _pendingCandidates.clear();

    _state = CallState.idle;
    _duration = 0;
    _muted = false;
    _remoteUserId = null;
    _remoteEmail = '';
    notifyListeners();
  }

  @override
  void dispose() {
    for (final off in _offs) {
      off();
    }
    _cleanup();
    localRenderer.dispose();
    remoteRenderer.dispose();
    super.dispose();
  }
}
