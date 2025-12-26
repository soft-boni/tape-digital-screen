import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models.dart';

/// SQLite database helper for content persistence
class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;

  factory DatabaseHelper() => _instance;

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'tape_tv.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // Downloaded content table
    await db.execute('''
      CREATE TABLE downloaded_content (
        contentId TEXT PRIMARY KEY,
        duration INTEGER NOT NULL,
        orderIndex INTEGER NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        name TEXT NOT NULL,
        localPath TEXT,
        isDownloaded INTEGER NOT NULL DEFAULT 0,
        transition TEXT,
        volume INTEGER,
        downloadedAt INTEGER NOT NULL
      )
    ''');

    // Background music table
    await db.execute('''
      CREATE TABLE background_music (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        localPath TEXT,
        isDownloaded INTEGER NOT NULL DEFAULT 0,
        downloadedAt INTEGER
      )
    ''');
  }

  /// Save downloaded content item
  Future<void> saveDownloadedContent(ContentItem item) async {
    final db = await database;
    final data = item.toJson();
    data['orderIndex'] = data['order']; // Rename to avoid SQL keyword conflict
    data.remove('order');
    data['downloadedAt'] = DateTime.now().millisecondsSinceEpoch;

    await db.insert(
      'downloaded_content',
      data,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Get all downloaded content
  Future<List<ContentItem>> getDownloadedContent() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'downloaded_content',
      orderBy: 'orderIndex ASC',
    );

    return maps.map((map) {
      final item = Map<String, dynamic>.from(map);
      item['order'] = item['orderIndex']; // Restore order field
      item.remove('orderIndex');
      item.remove('downloadedAt');
      return ContentItem.fromJson(item);
    }).toList();
  }

  /// Get downloaded content by IDs
  Future<List<ContentItem>> getDownloadedContentByIds(
      List<String> contentIds) async {
    if (contentIds.isEmpty) return [];

    final db = await database;
    final placeholders = List.filled(contentIds.length, '?').join(',');
    final List<Map<String, dynamic>> maps = await db.query(
      'downloaded_content',
      where: 'contentId IN ($placeholders)',
      whereArgs: contentIds,
      orderBy: 'orderIndex ASC',
    );

    return maps.map((map) {
      final item = Map<String, dynamic>.from(map);
      item['order'] = item['orderIndex'];
      item.remove('orderIndex');
      item.remove('downloadedAt');
      return ContentItem.fromJson(item);
    }).toList();
  }

  /// Delete content item
  Future<void> deleteContent(String contentId) async {
    final db = await database;
    await db.delete(
      'downloaded_content',
      where: 'contentId = ?',
      whereArgs: [contentId],
    );
  }

  /// Clear all downloaded content
  Future<void> clearAllContent() async {
    final db = await database;
    await db.delete('downloaded_content');
  }

  /// Save background music
  Future<void> saveBackgroundMusic(String url, String localPath) async {
    final db = await database;
    await db.insert(
      'background_music',
      {
        'url': url,
        'localPath': localPath,
        'isDownloaded': 1,
        'downloadedAt': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Get background music local path
  Future<String?> getBackgroundMusicPath(String url) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'background_music',
      where: 'url = ? AND isDownloaded = 1',
      whereArgs: [url],
      limit: 1,
    );

    if (maps.isEmpty) return null;
    return maps.first['localPath'] as String?;
  }

  /// Clear all background music
  Future<void> clearBackgroundMusic() async {
    final db = await database;
    await db.delete('background_music');
  }

  /// Get storage statistics
  Future<Map<String, int>> getStorageStats() async {
    final db = await database;

    final contentCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM downloaded_content'),
        ) ??
        0;

    final musicCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM background_music'),
        ) ??
        0;

    return {
      'contentCount': contentCount,
      'musicCount': musicCount,
    };
  }

  /// Close database
  Future<void> close() async {
    final db = await database;
    await db.close();
    _database = null;
  }
}
