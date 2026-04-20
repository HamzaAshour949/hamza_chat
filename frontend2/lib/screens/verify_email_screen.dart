import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme.dart';
import '_auth_widgets.dart';

class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key});

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _code = TextEditingController();
  final _codeFocus = FocusNode();
  String? _resendStatus;
  bool _resending = false;

  @override
  void initState() {
    super.initState();
    _codeFocus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _code.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  Future<void> _onVerify() async {
    final auth = context.read<AuthProvider>();
    final email = auth.pendingVerificationEmail ?? '';
    if (auth.loading || _code.text.length != 6) return;
    try {
      await auth.verifyEmail(email, _code.text.trim());
    } catch (_) {}
  }

  Future<void> _onResend() async {
    final auth = context.read<AuthProvider>();
    final email = auth.pendingVerificationEmail ?? '';
    if (_resending || email.isEmpty) return;
    setState(() {
      _resending = true;
      _resendStatus = null;
    });
    try {
      await auth.resendVerification(email);
      if (mounted) {
        setState(() => _resendStatus = 'A new code has been sent to your email.');
      }
    } catch (_) {
      // surfaced via auth.error
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final email = auth.pendingVerificationEmail ?? '';
    return Scaffold(
      backgroundColor: AppColors.bg,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: const BackButton(color: AppColors.text),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.of(context).size.height - 100,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                LogoArea(
                  title: 'Verify your email',
                  icon: Icons.mark_email_unread_outlined,
                  subtitleWidget: Text.rich(
                    TextSpan(
                      text: 'We sent a confirmation code to\n',
                      style: const TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 14,
                        height: 20 / 14,
                      ),
                      children: [
                        TextSpan(
                          text: email,
                          style: const TextStyle(
                            color: AppColors.text,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                AuthInputField(
                  controller: _code,
                  focusNode: _codeFocus,
                  icon: Icons.vpn_key_outlined,
                  hint: '6-digit code',
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  fontSize: 18,
                  letterSpacing: 4,
                  onChanged: (v) {
                    final filtered = v.replaceAll(RegExp(r'[^0-9]'), '');
                    if (filtered != v) {
                      _code.value = TextEditingValue(
                        text: filtered,
                        selection:
                            TextSelection.collapsed(offset: filtered.length),
                      );
                    }
                    setState(() {});
                  },
                ),
                AuthPrimaryButton(
                  loading: auth.loading,
                  label: 'Verify',
                  onPressed: _onVerify,
                  enabled: _code.text.length == 6,
                ),
                if (auth.error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      auth.error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 13,
                      ),
                    ),
                  ),
                if (_resendStatus != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      _resendStatus!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontSize: 13,
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 20),
                  child: TextButton(
                    onPressed: _resending ? null : _onResend,
                    child: Text.rich(
                      TextSpan(
                        text: "Didn't get the code? ",
                        style: const TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 14,
                        ),
                        children: [
                          TextSpan(
                            text: _resending ? 'Sending…' : 'Resend',
                            style: const TextStyle(
                              color: AppColors.accent,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    auth.cancelVerification();
                    Navigator.of(context).popUntil((r) => r.isFirst);
                  },
                  child: const Text(
                    'Back to Login',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// end of file.

