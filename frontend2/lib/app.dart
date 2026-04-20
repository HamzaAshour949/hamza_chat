import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/call_provider.dart';
import 'providers/chat_list_provider.dart';
import 'providers/network_provider.dart';
import 'screens/call_screen.dart';
import 'screens/chat_list_screen.dart';
import 'screens/login_screen.dart';
import 'services/auth_storage.dart';
import 'services/message_store.dart';
import 'services/socket_service.dart';
import 'theme.dart';
import 'widgets/network_banner.dart';

class ChatApp extends StatelessWidget {
  const ChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SocketService()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProxyProvider<SocketService, NetworkProvider>(
          create: (ctx) => NetworkProvider(ctx.read<SocketService>()),
          update: (_, socket, prev) => prev ?? NetworkProvider(socket),
        ),
        ChangeNotifierProxyProvider<SocketService, CallProvider>(
          create: (ctx) => CallProvider(ctx.read<SocketService>()),
          update: (_, socket, prev) => prev ?? CallProvider(socket),
        ),
      ],
      child: MaterialApp(
        title: 'ChatApp',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool _dbReady = false;
  int? _lastUserId;

  @override
  void initState() {
    super.initState();
    MessageStore.init().then((_) {
      if (mounted) setState(() => _dbReady = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final socket = context.watch<SocketService>();

    // Connect / disconnect socket in sync with the user session.
    final userId = auth.user?.id;
    if (userId != _lastUserId) {
      _lastUserId = userId;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (userId != null) {
          final token = await AuthStorage.getToken();
          if (token != null && mounted) socket.connect(token);
        } else {
          socket.disconnect();
        }
      });
    }

    if (auth.loading || !_dbReady) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.accent),
        ),
      );
    }

    if (auth.user == null) {
      return const LoginScreen();
    }

    return ChangeNotifierProvider(
      create: (ctx) => ChatListProvider(ctx.read<SocketService>()),
      child: Stack(
        children: [
          Scaffold(
            backgroundColor: AppColors.bg,
            body: Column(
              children: [
                Consumer<NetworkProvider>(
                  builder: (_, n, __) =>
                      NetworkBanner(connected: n.connected),
                ),
                const Expanded(child: ChatListScreen()),
              ],
            ),
          ),
          // Call overlay sits on top of everything.
          const Positioned.fill(child: CallScreen()),
        ],
      ),
    );
  }
}
