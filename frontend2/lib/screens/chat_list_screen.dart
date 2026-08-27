import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/chat_list_provider.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import '../widgets/conversation_tile.dart';
import 'chat_screen.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _openChat(int userId, String email) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatScreen(partnerId: userId, partnerEmail: email),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final list = context.watch<ChatListProvider>();
    final isSearching = list.searchQuery.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Chats',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                  IconButton(
                    onPressed: () => context.read<AuthProvider>().logout(),
                    icon: const Icon(
                      Icons.logout,
                      color: Color(0xFFAEBAC1),
                    ),
                    tooltip: 'Logout',
                  ),
                ],
              ),
            ),
            // Search bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.search,
                        size: 18, color: AppColors.secondaryText),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _search,
                        autocorrect: false,
                        onChanged: list.setSearchQuery,
                        style: const TextStyle(
                          color: AppColors.text,
                          fontSize: 15,
                        ),
                        decoration: const InputDecoration(
                          hintText: 'Search by email...',
                          hintStyle: TextStyle(color: AppColors.secondaryText),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: false,
                          isCollapsed: true,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(child: _buildBody(list, isSearching)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(ChatListProvider list, bool isSearching) {
    if (list.loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.accent),
      );
    }
    if (isSearching) {
      final results = list.searchResults;
      if (results.isEmpty) {
        return const Center(
          child: Text(
            'No users found',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: AppColors.secondaryText,
            ),
          ),
        );
      }
      return ListView.separated(
        itemCount: results.length,
        separatorBuilder: (_, __) => const Divider(
          height: 1,
          thickness: 0.5,
          color: AppColors.divider,
          indent: 76,
        ),
        itemBuilder: (ctx, i) {
          final u = results[i];
          final id = (u['id'] as num).toInt();
          final email = (u['email'] as String?) ?? '';
          return InkWell(
            onTap: () => _openChat(id, email),
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Avatar(userId: id, email: email),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    }

    if (list.conversations.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.chat_bubble_outline,
                  size: 64, color: AppColors.secondaryText),
              SizedBox(height: 16),
              Text(
                'No conversations yet',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: AppColors.secondaryText,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Search for a user by email to start chatting',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.secondaryText,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      itemCount: list.conversations.length,
      separatorBuilder: (_, __) => const Divider(
        height: 1,
        thickness: 0.5,
        color: AppColors.divider,
        indent: 76,
      ),
      itemBuilder: (ctx, i) {
        final c = list.conversations[i];
        return ConversationTile(
          conversation: c,
          onTap: () => _openChat(c.userId, c.email),
        );
      },
    );
  }
}
