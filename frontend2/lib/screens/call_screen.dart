import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';

import '../providers/call_provider.dart';
import '../theme.dart';
import '../utils/format.dart';

/// Full-screen overlay shown by the root widget whenever [CallProvider.state]
/// is not `idle`. Mirrors `frontend/src/screens/CallScreen.tsx`.
class CallScreen extends StatelessWidget {
  const CallScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final call = context.watch<CallProvider>();
    if (call.state == CallState.idle) return const SizedBox.shrink();

    final isVideo = call.type == CallType.video;
    return Material(
      color: AppColors.bg,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (isVideo && call.remoteStream != null)
            RTCVideoView(
              call.remoteRenderer,
              objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
            ),
          if (isVideo && call.localStream != null)
            Positioned(
              top: 60,
              right: 16,
              width: 100,
              height: 140,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.surface, width: 2),
                  ),
                  child: RTCVideoView(
                    call.localRenderer,
                    mirror: true,
                    objectFit:
                        RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 100, bottom: 60),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _TopInfo(call: call, isVideo: isVideo),
                _BottomButtons(call: call),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TopInfo extends StatelessWidget {
  final CallProvider call;
  final bool isVideo;
  const _TopInfo({required this.call, required this.isVideo});

  @override
  Widget build(BuildContext context) {
    String status;
    switch (call.state) {
      case CallState.outgoing:
        status = 'Calling...';
        break;
      case CallState.incoming:
        status = 'Incoming ${call.type == CallType.video ? 'video' : 'voice'} call';
        break;
      case CallState.connected:
        status = formatCallDuration(call.duration);
        break;
      case CallState.idle:
        status = '';
    }
    return Column(
      children: [
        if (!isVideo)
          Container(
            width: 120,
            height: 120,
            margin: const EdgeInsets.only(bottom: 24),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.person,
                size: 64, color: AppColors.secondaryText),
          ),
        Text(
          call.remoteEmail,
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 24,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          status,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontSize: 16,
          ),
        ),
      ],
    );
  }
}

class _BottomButtons extends StatelessWidget {
  final CallProvider call;
  const _BottomButtons({required this.call});

  @override
  Widget build(BuildContext context) {
    if (call.state == CallState.incoming) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _BtnWrapper(
              label: 'Decline',
              child: _RoundBtn(
                color: AppColors.danger,
                icon: Icons.call_end,
                onTap: call.rejectCall,
              ),
            ),
            _BtnWrapper(
              label: 'Accept',
              child: _RoundBtn(
                color: AppColors.accent,
                icon: Icons.call,
                onTap: call.acceptCall,
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _BtnWrapper(
            label: call.muted ? 'Unmute' : 'Mute',
            child: _SmallBtn(
              icon: call.muted ? Icons.mic_off : Icons.mic,
              active: call.muted,
              onTap: call.toggleMute,
            ),
          ),
          _BtnWrapper(
            label: 'End',
            child: _RoundBtn(
              color: AppColors.danger,
              icon: Icons.call_end,
              onTap: call.endCall,
            ),
          ),
          const _BtnWrapper(
            label: 'Speaker',
            child: _SmallBtn(icon: Icons.volume_up, onTap: null),
          ),
        ],
      ),
    );
  }
}

class _BtnWrapper extends StatelessWidget {
  final Widget child;
  final String label;
  const _BtnWrapper({required this.child, required this.label});
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        child,
        const SizedBox(height: 6),
        Text(label,
            style: const TextStyle(
                color: AppColors.secondaryText, fontSize: 11)),
      ],
    );
  }
}

class _RoundBtn extends StatelessWidget {
  final Color color;
  final IconData icon;
  final VoidCallback onTap;
  const _RoundBtn({
    required this.color,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      child: Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: Icon(icon, size: 30, color: Colors.white),
      ),
    );
  }
}

class _SmallBtn extends StatelessWidget {
  final IconData icon;
  final bool active;
  final VoidCallback? onTap;
  const _SmallBtn({required this.icon, this.active = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      child: Container(
        width: 50,
        height: 50,
        decoration: BoxDecoration(
          color: active
              ? const Color(0x59FFFFFF)
              : const Color(0x26FFFFFF),
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 24, color: Colors.white),
      ),
    );
  }
}
