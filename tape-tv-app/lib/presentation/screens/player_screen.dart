import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../../providers/device_provider.dart';
import '../../providers/content_provider.dart';
import '../../providers/playback_provider.dart';
import '../../data/models.dart';

class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  VideoPlayerController? _videoController;
  bool _showControls = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializePlayback();
    });
  }

  void _initializePlayback() async {
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);
    final contentProvider =
        Provider.of<ContentProvider>(context, listen: false);
    final playbackProvider =
        Provider.of<PlaybackProvider>(context, listen: false);

    final status = deviceProvider.status;
    if (status == null) return;

    // Get content IDs from status
    final contentIds = status.content.map((c) => c.contentId).toList();

    // Load downloaded content from database
    final downloadedContent =
        await contentProvider.getDownloadedContentByIds(contentIds);

    // Create a map for quick lookup
    final downloadedMap = {
      for (var item in downloadedContent) item.contentId: item
    };

    // Merge content: Perfer local, fallback to remote
    final playlist = status.content.map((remoteItem) {
      if (downloadedMap.containsKey(remoteItem.contentId)) {
        final localItem = downloadedMap[remoteItem.contentId]!;
        // Ensure the local file actually exists
        if (localItem.localPath != null &&
            File(localItem.localPath!).existsSync()) {
          return localItem;
        }
      }
      return remoteItem;
    }).toList();

    playbackProvider.loadPlaylist(playlist);

    // Load background music from local storage if available
    String? musicPath;
    if (status.backgroundMusic != null) {
      musicPath = await contentProvider
          .getBackgroundMusicPathFromUrl(status.backgroundMusic!);

      // Verify local music existence
      if (musicPath != null && !File(musicPath).existsSync()) {
        musicPath = null;
      }

      // Fallback to remote URL if not locally available
      musicPath ??= status.backgroundMusic;
    }

    // Start background music
    if (musicPath != null) {
      await playbackProvider.startBackgroundMusic(musicPath);
    }

    // Start playback
    playbackProvider.play();
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Consumer<PlaybackProvider>(
        builder: (context, playbackProvider, _) {
          final currentItem = playbackProvider.currentItem;

          if (currentItem == null) {
            return const Center(
              child: Text(
                'No content available',
                style: TextStyle(color: Colors.white),
              ),
            );
          }

          return GestureDetector(
            onTap: () {
              setState(() {
                _showControls = !_showControls;
              });
              if (_showControls) {
                Future.delayed(const Duration(seconds: 5), () {
                  if (mounted) {
                    setState(() {
                      _showControls = false;
                    });
                  }
                });
              }
            },
            child: Stack(
              children: [
                // Content Display
                _buildContent(currentItem, playbackProvider),

                // Controls Overlay
                if (_showControls)
                  _buildControlsOverlay(context, playbackProvider),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildContent(ContentItem item, PlaybackProvider playbackProvider) {
    final transition = playbackProvider.getTransitionDuration(item.transition);

    Widget content;

    if (item.type.toLowerCase() == 'video') {
      content = _buildVideoPlayer(item, playbackProvider.isPlaying);
    } else {
      content = _buildImageDisplay(item);
    }

    // Apply transition animation
    return AnimatedSwitcher(
      duration: transition,
      transitionBuilder: (child, animation) {
        switch (item.transition?.toLowerCase()) {
          case 'fade':
            return FadeTransition(opacity: animation, child: child);
          case 'slide':
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(animation),
              child: child,
            );
          case 'zoom':
            return ScaleTransition(scale: animation, child: child);
          default:
            return child;
        }
      },
      child: Container(
        key: ValueKey(item.contentId),
        child: content,
      ),
    );
  }

  Widget _buildImageDisplay(ContentItem item) {
    // Try local file first
    if (item.localPath != null && File(item.localPath!).existsSync()) {
      return Image.file(
        File(item.localPath!),
        fit: BoxFit.contain,
        width: double.infinity,
        height: double.infinity,
      );
    }

    // Fallback to remote URL
    if (item.url.isNotEmpty) {
      return Image.network(
        item.url,
        fit: BoxFit.contain,
        width: double.infinity,
        height: double.infinity,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return const Center(child: CircularProgressIndicator());
        },
        errorBuilder: (context, error, stackTrace) {
          return const Center(
            child: Icon(Icons.broken_image, color: Colors.white, size: 100),
          );
        },
      );
    }

    // No source available
    return const Center(
      child: Icon(Icons.broken_image, color: Colors.white, size: 100),
    );
  }

  Widget _buildVideoPlayer(ContentItem item, bool isPlaying) {
    return VideoPlayerItem(
      key: ValueKey(item.contentId),
      item: item,
      isPlaying: isPlaying,
      onVideoFinished: () {
        final playbackProvider =
            Provider.of<PlaybackProvider>(context, listen: false);
        playbackProvider.moveToNext();
      },
    );
  }

  Widget _buildControlsOverlay(
      BuildContext context, PlaybackProvider playbackProvider) {
    final deviceProvider = Provider.of<DeviceProvider>(context, listen: false);

    return Container(
      color: Colors.black54,
      child: Column(
        children: [
          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => deviceProvider.backToHome(),
                  ),
                  Text(
                    '${playbackProvider.currentIndex + 1}/${playbackProvider.playlist.length}',
                    style: const TextStyle(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          const Spacer(),
          // Bottom controls
          Padding(
            padding: const EdgeInsets.all(32),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.skip_previous, color: Colors.white),
                  iconSize: 48,
                  onPressed: () => playbackProvider.moveToPrevious(),
                ),
                const SizedBox(width: 24),
                IconButton(
                  icon: Icon(
                    playbackProvider.isPlaying ? Icons.pause : Icons.play_arrow,
                    color: Colors.white,
                  ),
                  iconSize: 64,
                  onPressed: () {
                    if (playbackProvider.isPlaying) {
                      playbackProvider.pause();
                    } else {
                      playbackProvider.play();
                    }
                  },
                ),
                const SizedBox(width: 24),
                IconButton(
                  icon: const Icon(Icons.skip_next, color: Colors.white),
                  iconSize: 48,
                  onPressed: () => playbackProvider.moveToNext(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class VideoPlayerItem extends StatefulWidget {
  final ContentItem item;
  final bool isPlaying;
  final VoidCallback onVideoFinished;

  const VideoPlayerItem({
    super.key,
    required this.item,
    required this.isPlaying,
    required this.onVideoFinished,
  });

  @override
  State<VideoPlayerItem> createState() => _VideoPlayerItemState();
}

class _VideoPlayerItemState extends State<VideoPlayerItem> {
  VideoPlayerController? _controller;
  bool _isError = false;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  @override
  void didUpdateWidget(VideoPlayerItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.contentId != widget.item.contentId) {
      _controller?.dispose();
      _initializePlayer();
    } else if (oldWidget.isPlaying != widget.isPlaying) {
      if (_controller != null && _controller!.value.isInitialized) {
        if (widget.isPlaying) {
          _controller!.play();
        } else {
          _controller!.pause();
        }
      }
    }
  }

  Future<void> _initializePlayer() async {
    try {
      if (widget.item.localPath != null &&
          File(widget.item.localPath!).existsSync()) {
        _controller = VideoPlayerController.file(File(widget.item.localPath!));
      } else if (widget.item.url.isNotEmpty) {
        _controller =
            VideoPlayerController.networkUrl(Uri.parse(widget.item.url));
      } else {
        setState(() => _isError = true);
        return;
      }

      await _controller!.initialize();
      _controller!.setVolume((widget.item.volume ?? 100) / 100.0);

      if (widget.isPlaying) {
        _controller!.play();
      }

      _controller!.addListener(_checkVideoEnd);
      setState(() {});
    } catch (e) {
      debugPrint("Video initialization error: $e");
      setState(() => _isError = true);
    }
  }

  void _checkVideoEnd() {
    if (_controller != null &&
        _controller!.value.isInitialized &&
        !_controller!.value.isPlaying &&
        _controller!.value.position >= _controller!.value.duration) {
      widget.onVideoFinished();
    }
  }

  @override
  void dispose() {
    _controller?.removeListener(_checkVideoEnd);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isError) {
      return const Center(
          child: Icon(Icons.videocam_off, color: Colors.white, size: 64));
    }

    if (_controller == null || !_controller!.value.isInitialized) {
      return const Center(child: CircularProgressIndicator());
    }

    return FittedBox(
      fit: BoxFit.contain, // Ensures video fits within screen bounds
      child: SizedBox(
        width: _controller!.value.size.width,
        height: _controller!.value.size.height,
        child: VideoPlayer(_controller!),
      ),
    );
  }
}
