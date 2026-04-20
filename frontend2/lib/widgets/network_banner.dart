import 'package:flutter/material.dart';

import '../theme.dart';

class NetworkBanner extends StatelessWidget {
  final bool connected;
  const NetworkBanner({super.key, required this.connected});

  @override
  Widget build(BuildContext context) {
    if (connected) return const SizedBox.shrink();
    return Container(
      height: 28,
      width: double.infinity,
      color: AppColors.danger,
      alignment: Alignment.center,
      child: const Text(
        'Connecting...',
        style: TextStyle(color: Colors.white, fontSize: 14),
      ),
    );
  }
}
