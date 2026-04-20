import 'package:flutter/material.dart';

import '../theme.dart';
import '../utils/format.dart';

class FileBubble extends StatelessWidget {
  final String? fileName;
  final int? fileSize;
  const FileBubble({super.key, required this.fileName, required this.fileSize});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      child: Row(
        children: [
          const Icon(Icons.insert_drive_file_outlined,
              color: AppColors.secondaryText, size: 28),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fileName ?? 'File',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.text,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (fileSize != null && fileSize! > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      formatFileSize(fileSize),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.secondaryText,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
