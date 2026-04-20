import 'package:flutter/material.dart';

import '../theme.dart';

class LogoArea extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? subtitle;
  final Widget? subtitleWidget;

  const LogoArea({
    super.key,
    required this.title,
    this.icon = Icons.chat_bubble,
    this.subtitle,
    this.subtitleWidget,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 48),
      child: Column(
        children: [
          Icon(icon, size: 64, color: AppColors.accent),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
            ),
          ),
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.secondaryText,
                  height: 20 / 14,
                ),
              ),
            ),
          if (subtitleWidget != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: subtitleWidget!,
            ),
        ],
      ),
    );
  }
}

class AuthInputField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final IconData icon;
  final String hint;
  final bool obscure;
  final TextInputType? keyboardType;
  final int? maxLength;
  final double fontSize;
  final double letterSpacing;
  final ValueChanged<String>? onChanged;

  const AuthInputField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.icon,
    required this.hint,
    this.obscure = false,
    this.keyboardType,
    this.maxLength,
    this.fontSize = 15,
    this.letterSpacing = 0,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final focused = focusNode.hasFocus;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      height: 52,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: focused ? AppColors.accent : AppColors.inputBg,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          Icon(
            icon,
            size: 20,
            color: focused ? AppColors.accent : AppColors.secondaryText,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              obscureText: obscure,
              keyboardType: keyboardType,
              autocorrect: false,
              maxLength: maxLength,
              onChanged: onChanged,
              style: TextStyle(
                color: AppColors.text,
                fontSize: fontSize,
                letterSpacing: letterSpacing,
              ),
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                hintText: hint,
                hintStyle: const TextStyle(color: AppColors.secondaryText),
                counterText: '',
                filled: false,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AuthPrimaryButton extends StatelessWidget {
  final String label;
  final bool loading;
  final VoidCallback onPressed;
  final bool enabled;

  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: SizedBox(
        height: 52,
        width: double.infinity,
        child: ElevatedButton(
          onPressed: loading || !enabled ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.accent,
            disabledBackgroundColor: AppColors.accent.withOpacity(0.5),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(Colors.white),
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
      ),
    );
  }
}
