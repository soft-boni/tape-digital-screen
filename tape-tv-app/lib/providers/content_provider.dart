import 'package:flutter/foundation.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../data/local/database_helper.dart';
import '../data/local/file_manager.dart';

class ContentProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  final DatabaseHelper _db = DatabaseHelper();
  final FileManager _fileManager = FileManager();

  SyncProgress _syncProgress = SyncProgress();
  final List<ContentItem> _downloadedContent = [];
  String? _backgroundMusicPath;

  SyncProgress get syncProgress => _syncProgress;
  List<ContentItem> get downloadedContent => _downloadedContent;
  String? get backgroundMusicPath => _backgroundMusicPath;

  /// Initialize provider - load downloaded content from database
  Future<void> initialize() async {
    try {
      final content = await _db.getDownloadedContent();
      _downloadedContent.clear();
      _downloadedContent.addAll(content);
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading downloaded content: $e');
    }
  }

  /// Sync content from PlayerStatus
  Future<void> syncContent(List<ContentItem> items,
      {String? backgroundMusicUrl}) async {
    if (items.isEmpty && backgroundMusicUrl == null) return;

    _syncProgress = SyncProgress(
      isInProgress: true,
      totalItems: items.length + (backgroundMusicUrl != null ? 1 : 0),
      downloadedItems: 0,
      failedItems: 0,
    );
    notifyListeners();

    final contentDir = await _fileManager.getContentDirectory();
    int downloaded = 0;
    int failed = 0;

    // Download content items
    for (final item in items) {
      bool success = await _downloadContentItem(item, contentDir.path);
      if (success) {
        downloaded++;
      } else {
        failed++;
      }

      _syncProgress = _syncProgress.copyWith(
        downloadedItems: downloaded,
        failedItems: failed,
      );
      notifyListeners();
    }

    // Download background music if provided
    if (backgroundMusicUrl != null) {
      _syncProgress = _syncProgress.copyWith(
        currentFileName: 'Background Music',
      );
      notifyListeners();

      bool success = await _downloadBackgroundMusic(backgroundMusicUrl);
      if (success) {
        downloaded++;
      } else {
        failed++;
      }

      _syncProgress = _syncProgress.copyWith(
        downloadedItems: downloaded,
        failedItems: failed,
      );
      notifyListeners();
    }

    _syncProgress = SyncProgress(
      isInProgress: false,
      totalItems: items.length + (backgroundMusicUrl != null ? 1 : 0),
      downloadedItems: downloaded,
      failedItems: failed,
    );
    notifyListeners();
  }

  /// Download a single content item with retry logic
  Future<bool> _downloadContentItem(
      ContentItem item, String contentDirPath) async {
    const maxRetries = 3;
    int attempt = 0;

    while (attempt < maxRetries) {
      try {
        _syncProgress = _syncProgress.copyWith(
          currentFileName: item.name,
        );
        notifyListeners();

        final extension = _getExtension(item.type);
        final localPath = '$contentDirPath/${item.contentId}.$extension';

        // Verify if already downloaded and valid
        if (await _fileManager.verifyFile(localPath)) {
          debugPrint('Content already downloaded: ${item.name}');
          await _saveContentToDatabase(item, localPath);
          return true;
        }

        // Download file
        debugPrint('Downloading: ${item.name} (Attempt ${attempt + 1})');
        await _api.downloadFile(item.url, localPath);

        // Verify download
        if (await _fileManager.verifyFile(localPath)) {
          debugPrint('Download successful: ${item.name}');
          await _saveContentToDatabase(item, localPath);
          return true;
        } else {
          debugPrint('Download verification failed: ${item.name}');
          await _fileManager.deleteFile(localPath);
          throw Exception('File verification failed');
        }
      } catch (e) {
        attempt++;
        debugPrint('Download error (attempt $attempt/$maxRetries): $e');

        if (attempt >= maxRetries) {
          _syncProgress = _syncProgress.copyWith(
            errorMessage:
                'Failed to download ${item.name} after $maxRetries attempts',
          );
          notifyListeners();
          return false;
        }

        // Exponential backoff: 1s, 2s, 4s
        await Future.delayed(Duration(seconds: 1 << (attempt - 1)));
      }
    }

    return false;
  }

  /// Download background music with retry logic
  Future<bool> _downloadBackgroundMusic(String musicUrl) async {
    const maxRetries = 3;
    int attempt = 0;

    while (attempt < maxRetries) {
      try {
        final musicDir = await _fileManager.getMusicDirectory();

        // Check if already downloaded
        final existingPath = await _db.getBackgroundMusicPath(musicUrl);
        if (existingPath != null &&
            await _fileManager.verifyFile(existingPath)) {
          debugPrint('Background music already downloaded');
          _backgroundMusicPath = existingPath;
          return true;
        }

        // Generate filename from URL
        final uri = Uri.parse(musicUrl);
        final filename = uri.pathSegments.last;
        final localPath = '${musicDir.path}/$filename';

        debugPrint('Downloading background music (Attempt ${attempt + 1})');
        await _api.downloadFile(musicUrl, localPath);

        // Verify download
        if (await _fileManager.verifyFile(localPath)) {
          debugPrint('Background music download successful');
          await _db.saveBackgroundMusic(musicUrl, localPath);
          _backgroundMusicPath = localPath;
          return true;
        } else {
          debugPrint('Background music verification failed');
          await _fileManager.deleteFile(localPath);
          throw Exception('File verification failed');
        }
      } catch (e) {
        attempt++;
        debugPrint(
            'Background music download error (attempt $attempt/$maxRetries): $e');

        if (attempt >= maxRetries) {
          _syncProgress = _syncProgress.copyWith(
            errorMessage:
                'Failed to download background music after $maxRetries attempts',
          );
          notifyListeners();
          return false;
        }

        await Future.delayed(Duration(seconds: 1 << (attempt - 1)));
      }
    }

    return false;
  }

  /// Save content item to database
  Future<void> _saveContentToDatabase(
      ContentItem item, String localPath) async {
    final updatedItem = item.copyWith(
      localPath: localPath,
      isDownloaded: true,
    );

    await _db.saveDownloadedContent(updatedItem);

    // Update in-memory list
    final index =
        _downloadedContent.indexWhere((c) => c.contentId == item.contentId);
    if (index >= 0) {
      _downloadedContent[index] = updatedItem;
    } else {
      _downloadedContent.add(updatedItem);
    }
  }

  /// Get downloaded content by IDs
  Future<List<ContentItem>> getDownloadedContentByIds(List<String> ids) async {
    try {
      return await _db.getDownloadedContentByIds(ids);
    } catch (e) {
      debugPrint('Error getting downloaded content: $e');
      return _downloadedContent
          .where((item) => ids.contains(item.contentId))
          .toList();
    }
  }

  /// Get background music path from URL
  Future<String?> getBackgroundMusicPathFromUrl(String url) async {
    try {
      return await _db.getBackgroundMusicPath(url);
    } catch (e) {
      debugPrint('Error getting background music path: $e');
      return null;
    }
  }

  /// Clear all downloaded content
  Future<void> clearContent() async {
    try {
      await _fileManager.clearContentCache();
      await _fileManager.clearMusicCache();
      await _db.clearAllContent();
      await _db.clearBackgroundMusic();

      _downloadedContent.clear();
      _backgroundMusicPath = null;

      notifyListeners();
    } catch (e) {
      debugPrint('Error clearing content: $e');
    }
  }

  /// Get storage usage in bytes
  Future<int> getStorageUsage() async {
    return await _fileManager.getStorageUsage();
  }

  /// Get formatted storage usage string
  Future<String> getFormattedStorageUsage() async {
    final bytes = await getStorageUsage();
    return _fileManager.formatBytes(bytes);
  }

  String _getExtension(String type) {
    return type.toLowerCase() == 'video' ? 'mp4' : 'jpg';
  }
}
