import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// File management utilities for content storage
class FileManager {
  /// Get content directory path
  Future<Directory> getContentDirectory() async {
    final dir = await getApplicationDocumentsDirectory();
    final contentDir = Directory('${dir.path}/content');
    if (!await contentDir.exists()) {
      await contentDir.create(recursive: true);
    }
    return contentDir;
  }

  /// Get music directory path
  Future<Directory> getMusicDirectory() async {
    final dir = await getApplicationDocumentsDirectory();
    final musicDir = Directory('${dir.path}/music');
    if (!await musicDir.exists()) {
      await musicDir.create(recursive: true);
    }
    return musicDir;
  }

  /// Verify file exists and has valid size
  Future<bool> verifyFile(String path, {int? expectedSize}) async {
    try {
      final file = File(path);
      if (!await file.exists()) return false;

      final stat = await file.stat();
      if (stat.size == 0) return false;

      if (expectedSize != null && stat.size != expectedSize) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get file size in bytes
  Future<int> getFileSize(String path) async {
    try {
      final file = File(path);
      if (!await file.exists()) return 0;
      final stat = await file.stat();
      return stat.size;
    } catch (e) {
      return 0;
    }
  }

  /// Calculate total storage usage
  Future<int> getStorageUsage() async {
    int totalSize = 0;

    try {
      final contentDir = await getContentDirectory();
      final musicDir = await getMusicDirectory();

      // Calculate content directory size
      if (await contentDir.exists()) {
        await for (var entity in contentDir.list(recursive: false)) {
          if (entity is File) {
            final stat = await entity.stat();
            totalSize += stat.size;
          }
        }
      }

      // Calculate music directory size
      if (await musicDir.exists()) {
        await for (var entity in musicDir.list(recursive: false)) {
          if (entity is File) {
            final stat = await entity.stat();
            totalSize += stat.size;
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }

    return totalSize;
  }

  /// Format bytes to human-readable string
  String formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// Clear all downloaded content files
  Future<void> clearContentCache() async {
    try {
      final contentDir = await getContentDirectory();
      if (await contentDir.exists()) {
        await contentDir.delete(recursive: true);
        await contentDir.create(recursive: true);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  /// Clear all music files
  Future<void> clearMusicCache() async {
    try {
      final musicDir = await getMusicDirectory();
      if (await musicDir.exists()) {
        await musicDir.delete(recursive: true);
        await musicDir.create(recursive: true);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  /// Clear all cached files
  Future<void> clearAllCache() async {
    await clearContentCache();
    await clearMusicCache();
  }

  /// Delete specific file
  Future<bool> deleteFile(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Cleanup orphaned files (files not referenced in a given list)
  Future<void> cleanupOrphanedFiles(List<String> validPaths) async {
    try {
      final contentDir = await getContentDirectory();
      final musicDir = await getMusicDirectory();

      final validPathsSet = validPaths.toSet();

      // Clean content directory
      if (await contentDir.exists()) {
        await for (var entity in contentDir.list(recursive: false)) {
          if (entity is File && !validPathsSet.contains(entity.path)) {
            await entity.delete();
          }
        }
      }

      // Clean music directory
      if (await musicDir.exists()) {
        await for (var entity in musicDir.list(recursive: false)) {
          if (entity is File && !validPathsSet.contains(entity.path)) {
            await entity.delete();
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
}
