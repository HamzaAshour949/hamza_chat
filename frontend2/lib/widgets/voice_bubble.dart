import 'package:flutter/material.dart';

import '../theme.dart';
import '../utils/format.dart';

class VoiceBubble extends StatelessWidget {
  final int? fileSize;
  const VoiceBubble({super.key, required this.fileSize});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: Row(
        children: [
          const Icon(Icons.play_arrow, color: AppColors.text, size: 24),
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 8),
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.inputBg,
                borderRadius: BorderRadius.circular(2),
              ),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: 0.3,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ),
          if (fileSize != null && fileSize! > 0)
            Text(
              formatFileSize(fileSize),
              style: const TextStyle(
                  fontSize: 12, color: AppColors.secondaryText),
            ),
        ],
      ),
    );
  }
}
