import 'package:flutter/material.dart';

import '../theme.dart';
import '../utils/format.dart';

/// Bottom-bar shown while recording a voice message. Pulsing red dot + timer
/// on the left, "Slide to cancel" in the middle, teal mic button (send) on
/// the right.
class VoiceRecorderBar extends StatefulWidget {
  final int duration; // seconds
  final VoidCallback onCancel;
  final VoidCallback onSend;

  const VoiceRecorderBar({
    super.key,
    required this.duration,
    required this.onCancel,
    required this.onSend,
  });

  @override
  State<VoiceRecorderBar> createState() => _VoiceRecorderBarState();
}

class _VoiceRecorderBarState extends State<VoiceRecorderBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          FadeTransition(
            opacity: Tween<double>(begin: 0.3, end: 1.0).animate(_pulse),
            child: Container(
              width: 12,
              height: 12,
              decoration: const BoxDecoration(
                color: AppColors.danger,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatDuration(widget.duration),
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 15,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          Expanded(
            child: InkResponse(
              onTap: widget.onCancel,
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.chevron_left,
                      size: 18, color: AppColors.secondaryText),
                  SizedBox(width: 4),
                  Text(
                    'Slide to cancel',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
          ),
          InkResponse(
            onTap: widget.onSend,
            child: const SizedBox(
              width: 44,
              height: 44,
              child: Icon(Icons.mic, size: 28, color: AppColors.accent),
            ),
          ),
        ],
      ),
    );
  }
}
