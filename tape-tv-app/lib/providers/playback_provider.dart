import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:audioplayers/audioplayers.dart';
import '../data/models.dart';
import '../core/constants.dart';

class PlaybackProvider extends ChangeNotifier {
  List<ContentItem> _playlist = [];
  int _currentIndex = 0;
  Timer? _advanceTimer;
  AudioPlayer? _backgroundMusicPlayer;
  bool _isPlaying = false;

  List<ContentItem> get playlist => _playlist;
  int get currentIndex => _currentIndex;
  ContentItem? get currentItem =>
      _playlist.isNotEmpty ? _playlist[_currentIndex] : null;
  bool get isPlaying => _isPlaying;
  SyncProgress get syncProgress =>
      SyncProgress(); // Return empty progress for now

  /// Load playlist from content items
  void loadPlaylist(List<ContentItem> content) {
    _playlist = content..sort((a, b) => a.order.compareTo(b.order));
    _currentIndex = 0;
    _isPlaying = false;
    notifyListeners();
  }

  /// Start playback
  void play() {
    if (_playlist.isEmpty) return;
    _isPlaying = true;
    _backgroundMusicPlayer?.resume();
    _scheduleNextAdvance();
    notifyListeners();
  }

  /// Pause playback
  void pause() {
    _isPlaying = false;
    _backgroundMusicPlayer?.pause();
    _advanceTimer?.cancel();
    notifyListeners();
  }

  /// Move to next item
  void moveToNext() {
    if (_playlist.isEmpty) return;
    _currentIndex = (_currentIndex + 1) % _playlist.length;
    _scheduleNextAdvance();
    notifyListeners();
  }

  /// Move to previous item
  void moveToPrevious() {
    if (_playlist.isEmpty) return;
    _currentIndex = (_currentIndex - 1 + _playlist.length) % _playlist.length;
    _scheduleNextAdvance();
    notifyListeners();
  }

  /// Schedule automatic advance
  void _scheduleNextAdvance() {
    _advanceTimer?.cancel();

    if (!_isPlaying || _playlist.isEmpty) return;

    final item = currentItem;
    if (item == null) return;

    final duration =
        item.duration > 0 ? item.duration : Constants.defaultContentDuration;

    _advanceTimer = Timer(
      Duration(seconds: duration),
      moveToNext,
    );
  }

  /// Start background music (local file)
  Future<void> startBackgroundMusic(String? musicPath) async {
    if (musicPath == null || musicPath.isEmpty) return;

    try {
      _backgroundMusicPlayer ??= AudioPlayer();
      await _backgroundMusicPlayer!.setReleaseMode(ReleaseMode.loop);

      // Use local file if it's a file path, otherwise use URL
      if (musicPath.startsWith('http')) {
        await _backgroundMusicPlayer!.play(UrlSource(musicPath));
      } else {
        await _backgroundMusicPlayer!.play(DeviceFileSource(musicPath));
      }

      debugPrint('Background music started: $musicPath');
    } catch (e) {
      debugPrint('Failed to play background music: $e');
    }
  }

  /// Stop background music
  Future<void> stopBackgroundMusic() async {
    await _backgroundMusicPlayer?.stop();
    await _backgroundMusicPlayer?.dispose();
    _backgroundMusicPlayer = null;
  }

  /// Get transition duration for animations
  Duration getTransitionDuration(String? transition) {
    switch (transition?.toLowerCase()) {
      case 'fade':
        return const Duration(milliseconds: 500);
      case 'slide':
        return const Duration(milliseconds: 400);
      case 'zoom':
        return const Duration(milliseconds: 600);
      default:
        return Duration.zero;
    }
  }

  @override
  void dispose() {
    _advanceTimer?.cancel();
    stopBackgroundMusic();
    super.dispose();
  }
}
