import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';

import '../models/message.dart';
import '../providers/auth_provider.dart';
import '../providers/call_provider.dart';
import '../providers/messages_provider.dart';
import '../services/media_compress.dart';
import '../services/media_upload.dart';
import '../services/socket_service.dart';
import '../theme.dart';
import '../widgets/attachment_sheet.dart';
import '../widgets/message_bubble.dart';
import '../widgets/voice_recorder_bar.dart';

class ChatScreen extends StatelessWidget {
  final int partnerId;
  final String partnerEmail;

  const ChatScreen({
    super.key,
    required this.partnerId,
    required this.partnerEmail,
  });

  @override
  Widget build(BuildContext context) {
    final user = context.read<AuthProvider>().user!;
    final socket = context.read<SocketService>();

    return ChangeNotifierProvider(
      create: (_) => MessagesProvider(
        partnerId: partnerId,
        currentUserId: user.id,
        socket: socket,
      ),
      child: _ChatScreenBody(
        partnerId: partnerId,
        partnerEmail: partnerEmail,
        currentUserId: user.id,
      ),
    );
  }
}

class _ChatScreenBody extends StatefulWidget {
  final int partnerId;
  final String partnerEmail;
  final int currentUserId;

  const _ChatScreenBody({
    required this.partnerId,
    required this.partnerEmail,
    required this.currentUserId,
  });

  @override
  State<_ChatScreenBody> createState() => _ChatScreenBodyState();
}

class _ChatScreenBodyState extends State<_ChatScreenBody> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final AudioRecorder _recorder = AudioRecorder();

  bool _isRecording = false;
  int _recordingSeconds = 0;
  Timer? _recordingTimer;
  String? _recordingPath;

  @override
  void initState() {
    super.initState();
    _input.addListener(() => setState(() {}));
    _scroll.addListener(_maybeLoadMore);
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    _recordingTimer?.cancel();
    _recorder.dispose();
    super.dispose();
  }

  void _maybeLoadMore() {
    if (!_scroll.hasClients) return;
    // Inverted list: reaching the top == reaching max scroll extent.
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 300) {
      context.read<MessagesProvider>().loadMore();
    }
  }

  void _onSendText() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    context.read<MessagesProvider>().sendText(text);
    _input.clear();
  }

  Future<void> _sendMedia({
    required String path,
    required MessageType type,
    required String mimeType,
    required String fileName,
    String? thumbnail,
  }) async {
    final messages = context.read<MessagesProvider>();
    final socket = context.read<SocketService>();
    final localId = messages.newLocalId();
    final now = DateTime.now().toUtc().toIso8601String();
    final size = await MediaCompress.fileSize(path);

    final optimistic = Message(
      id: localId,
      from: widget.currentUserId,
      to: widget.partnerId,
      type: type,
      thumbnail: thumbnail,
      mimeType: mimeType,
      fileName: fileName,
      fileSize: size,
      createdAt: now,
      status: MessageStatus.pending,
    );

    await messages.addOptimistic(optimistic);

    try {
      final result = await MediaUpload.upload(
        filePath: path,
        mimeType: mimeType,
        fileName: fileName,
      );
      socket.emitOrQueue('send_message', {
        'to': widget.partnerId,
        'type': messageTypeToString(type),
        'content': null,
        'localId': localId,
        if (thumbnail != null) 'thumbnail': thumbnail,
        'mediaUrl': result.url,
        'mimeType': result.mimeType,
        'fileName': result.filename,
        'fileSize': result.size,
      });
      await messages.addOptimistic(
        optimistic.copyWith(
          mediaUrl: result.url,
          fileSize: result.size,
        ),
      );
    } catch (e) {
      debugPrint('sendMedia failed: $e');
      await messages.addOptimistic(
        optimistic.copyWith(status: MessageStatus.failed),
      );
    }
  }

  Future<void> _takePhoto() async {
    try {
      final cam = await Permission.camera.request();
      if (!cam.isGranted) return;
      final picker = ImagePicker();
      final x = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 70,
      );
      if (x == null) return;
      final compressed = await MediaCompress.compressImage(x.path);
      final thumb = await MediaCompress.generateImageThumbnail(compressed);
      await _sendMedia(
        path: compressed,
        type: MessageType.image,
        mimeType: 'image/jpeg',
        fileName: 'photo.jpg',
        thumbnail: thumb.isEmpty ? null : thumb,
      );
    } catch (e) {
      _toast('Camera error: $e');
    }
  }

  Future<void> _captureVideo() async {
    try {
      final cam = await Permission.camera.request();
      final mic = await Permission.microphone.request();
      if (!cam.isGranted || !mic.isGranted) return;
      final picker = ImagePicker();
      final x = await picker.pickVideo(
        source: ImageSource.camera,
        maxDuration: const Duration(seconds: 15),
      );
      if (x == null) return;
      final compressed = await MediaCompress.compressVideo(x.path);
      final thumb = await MediaCompress.generateVideoThumbnail(compressed);
      await _sendMedia(
        path: compressed,
        type: MessageType.video,
        mimeType: 'video/mp4',
        fileName: 'video.mp4',
        thumbnail: thumb.isEmpty ? null : thumb,
      );
    } catch (e) {
      _toast('Camera error: $e');
    }
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        withData: false,
      );
      if (result == null || result.files.isEmpty) return;
      final f = result.files.first;
      final path = f.path;
      if (path == null) return;
      final mime = _mimeForExtension(f.extension) ?? 'application/octet-stream';
      final name = f.name;

      if (mime.startsWith('image/')) {
        final thumb = await MediaCompress.generateImageThumbnail(path);
        await _sendMedia(
          path: path,
          type: MessageType.image,
          mimeType: mime,
          fileName: name,
          thumbnail: thumb.isEmpty ? null : thumb,
        );
        return;
      }
      if (mime.startsWith('video/')) {
        final thumb = await MediaCompress.generateVideoThumbnail(path);
        await _sendMedia(
          path: path,
          type: MessageType.video,
          mimeType: mime,
          fileName: name,
          thumbnail: thumb.isEmpty ? null : thumb,
        );
        return;
      }
      await _sendMedia(
        path: path,
        type: MessageType.file,
        mimeType: mime,
        fileName: name,
      );
    } catch (e) {
      _toast('File error: $e');
    }
  }

  String? _mimeForExtension(String? ext) {
    if (ext == null) return null;
    switch (ext.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'mp4':
        return 'video/mp4';
      case 'm4a':
        return 'audio/m4a';
      case 'aac':
        return 'audio/aac';
      case 'opus':
        return 'audio/opus';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return null;
    }
  }

  Future<void> _startRecording() async {
    try {
      final granted = await Permission.microphone.request();
      if (!granted.isGranted) {
        _toast('Microphone permission required');
        return;
      }
      final dir = await getTemporaryDirectory();
      final path = p.join(
        dir.path,
        'voice_${DateTime.now().millisecondsSinceEpoch}.m4a',
      );
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 32000,
          sampleRate: 16000,
          numChannels: 1,
        ),
        path: path,
      );
      _recordingPath = path;
      setState(() {
        _isRecording = true;
        _recordingSeconds = 0;
      });
      _recordingTimer?.cancel();
      _recordingTimer = Timer.periodic(
        const Duration(seconds: 1),
        (_) => setState(() => _recordingSeconds++),
      );
    } catch (e) {
      _toast('Recording error: $e');
      setState(() => _isRecording = false);
    }
  }

  Future<void> _stopRecording() async {
    if (!_isRecording) return;
    _recordingTimer?.cancel();
    _recordingTimer = null;
    try {
      final path = await _recorder.stop();
      setState(() => _isRecording = false);
      final file = path ?? _recordingPath;
      if (file != null && await File(file).exists()) {
        await _sendMedia(
          path: file,
          type: MessageType.voice,
          mimeType: 'audio/m4a',
          fileName: 'voice.m4a',
        );
      }
    } catch (e) {
      _toast('Recording error: $e');
      setState(() => _isRecording = false);
    }
  }

  Future<void> _cancelRecording() async {
    if (!_isRecording) return;
    _recordingTimer?.cancel();
    _recordingTimer = null;
    try {
      await _recorder.stop();
    } catch (_) {}
    setState(() => _isRecording = false);
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.surface),
    );
  }

  @override
  Widget build(BuildContext context) {
    final messages = context.watch<MessagesProvider>();
    final hasText = _input.text.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.bg,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.text,
        title: Text(
          widget.partnerEmail,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: 'Video call',
            icon: const Icon(Icons.videocam_outlined,
                size: 23, color: AppColors.text),
            onPressed: () => context.read<CallProvider>().startCall(
                  widget.partnerId,
                  widget.partnerEmail,
                  CallType.video,
                ),
          ),
          IconButton(
            tooltip: 'Voice call',
            icon: const Icon(Icons.call_outlined,
                size: 21, color: AppColors.text),
            onPressed: () => context.read<CallProvider>().startCall(
                  widget.partnerId,
                  widget.partnerEmail,
                  CallType.voice,
                ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: messages.loading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.accent),
                    )
                  : ListView.builder(
                      controller: _scroll,
                      reverse: true,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 8,
                      ),
                      itemCount: messages.messages.length +
                          (messages.loadingMore ? 1 : 0),
                      itemBuilder: (ctx, i) {
                        if (i == messages.messages.length) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.accent,
                                ),
                              ),
                            ),
                          );
                        }
                        final m = messages.messages[i];
                        return MessageBubble(
                          message: m,
                          isSent: m.from == widget.currentUserId,
                        );
                      },
                    ),
            ),
            if (_isRecording)
              VoiceRecorderBar(
                duration: _recordingSeconds,
                onCancel: _cancelRecording,
                onSend: _stopRecording,
              )
            else
              _InputBar(
                controller: _input,
                hasText: hasText,
                onAttach: () => AttachmentSheet.show(
                  context,
                  onTakePhoto: _takePhoto,
                  onCaptureVideo: _captureVideo,
                  onPickFile: _pickFile,
                ),
                onMic: _startRecording,
                onSend: _onSendText,
              ),
          ],
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool hasText;
  final VoidCallback onAttach;
  final VoidCallback onMic;
  final VoidCallback onSend;

  const _InputBar({
    required this.controller,
    required this.hasText,
    required this.onAttach,
    required this.onMic,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      color: AppColors.surface,
      padding: EdgeInsets.fromLTRB(8, 8, 8, 8 + bottom),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          SizedBox(
            width: 44,
            height: 44,
            child: IconButton(
              onPressed: onAttach,
              icon: const Icon(Icons.add,
                  size: 26, color: AppColors.secondaryText),
            ),
          ),
          Expanded(
            child: Container(
              constraints:
                  const BoxConstraints(minHeight: 40, maxHeight: 120),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.inputBg,
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                maxLength: 4096,
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 15,
                ),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  isCollapsed: true,
                  filled: false,
                  counterText: '',
                  hintText: 'Type a message',
                  hintStyle: TextStyle(color: AppColors.secondaryText),
                ),
              ),
            ),
          ),
          SizedBox(
            width: 44,
            height: 44,
            child: IconButton(
              onPressed: hasText ? onSend : onMic,
              icon: Icon(
                hasText ? Icons.send : Icons.mic,
                size: hasText ? 22 : 24,
                color: hasText ? AppColors.accent : AppColors.secondaryText,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
