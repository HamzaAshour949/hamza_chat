import 'package:flutter/material.dart';

import '../theme.dart';

class AttachmentSheet extends StatelessWidget {
  final VoidCallback onTakePhoto;
  final VoidCallback onCaptureVideo;
  final VoidCallback onPickFile;

  const AttachmentSheet({
    super.key,
    required this.onTakePhoto,
    required this.onCaptureVideo,
    required this.onPickFile,
  });

  static Future<void> show(
    BuildContext context, {
    required VoidCallback onTakePhoto,
    required VoidCallback onCaptureVideo,
    required VoidCallback onPickFile,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black54,
      builder: (_) => AttachmentSheet(
        onTakePhoto: onTakePhoto,
        onCaptureVideo: onCaptureVideo,
        onPickFile: onPickFile,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
          ),
        ),
        padding: const EdgeInsets.all(24),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _Option(
              icon: Icons.camera_alt,
              label: 'Photo',
              iconColor: AppColors.accent,
              onTap: () {
                Navigator.of(context).pop();
                onTakePhoto();
              },
            ),
            _Option(
              icon: Icons.videocam,
              label: 'Video',
              iconColor: AppColors.accent,
              onTap: () {
                Navigator.of(context).pop();
                onCaptureVideo();
              },
            ),
            _Option(
              icon: Icons.description,
              label: 'File',
              iconColor: AppColors.accent,
              onTap: () {
                Navigator.of(context).pop();
                onPickFile();
              },
            ),
            _Option(
              icon: Icons.cancel,
              label: 'Cancel',
              iconColor: AppColors.danger,
              onTap: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}

class _Option extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color iconColor;
  final VoidCallback onTap;

  const _Option({
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      child: SizedBox(
        width: 80,
        height: 80,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: const BoxDecoration(
                color: AppColors.inputBg,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 24, color: iconColor),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
