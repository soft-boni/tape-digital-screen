/// Data models for Tape TV Player matching backend API responses
library;

class Device {
  final String id;
  final String? pin;
  final String name;
  final bool activated;
  final String? screenId;
  final String? userId;
  final DateTime lastSeen;

  Device({
    required this.id,
    this.pin,
    required this.name,
    required this.activated,
    this.screenId,
    this.userId,
    required this.lastSeen,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'] ?? json['deviceId'],
      pin: json['pin'],
      name: json['name'] ?? 'TV Device',
      activated: json['activated'] ?? false,
      screenId: json['screenId'] ?? json['screen_id'],
      userId: json['userId'] ?? json['user_id'],
      lastSeen: json['lastSeen'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['lastSeen'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'pin': pin,
      'name': name,
      'activated': activated ? 1 : 0,
      'screenId': screenId,
      'userId': userId,
      'lastSeen': lastSeen.millisecondsSinceEpoch,
    };
  }
}

class ContentItem {
  final String contentId;
  final int duration; // seconds
  final int order;
  final String type; // 'image' | 'video'
  final String url; // Cloud inary URL
  final String name;
  final String? localPath; // Downloaded file path
  final bool isDownloaded;
  final String? transition; // 'none' | 'fade' | 'slide' | 'zoom'
  final int? volume; // 0-100 for videos

  ContentItem({
    required this.contentId,
    required this.duration,
    required this.order,
    required this.type,
    required this.url,
    required this.name,
    this.localPath,
    this.isDownloaded = false,
    this.transition = 'fade',
    this.volume = 100,
  });

  factory ContentItem.fromJson(Map<String, dynamic> json) {
    return ContentItem(
      contentId: json['contentId'],
      duration: json['duration'] ?? 10,
      order: json['order'] ?? 0,
      type: json['type'] ?? 'image',
      url: json['url'] ?? '',
      name: json['name'] ?? 'Untitled',
      localPath: json['localPath'],
      isDownloaded: (json['isDownloaded'] ?? 0) == 1,
      transition: json['transition'] ?? 'fade',
      volume: json['volume'] ?? 100,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'contentId': contentId,
      'duration': duration,
      'order': order,
      'type': type,
      'url': url,
      'name': name,
      'localPath': localPath,
      'isDownloaded': isDownloaded ? 1 : 0,
      'transition': transition,
      'volume': volume,
    };
  }

  ContentItem copyWith({
    String? contentId,
    int? duration,
    int? order,
    String? type,
    String? url,
    String? name,
    String? localPath,
    bool? isDownloaded,
    String? transition,
    int? volume,
  }) {
    return ContentItem(
      contentId: contentId ?? this.contentId,
      duration: duration ?? this.duration,
      order: order ?? this.order,
      type: type ?? this.type,
      url: url ?? this.url,
      name: name ?? this.name,
      localPath: localPath ?? this.localPath,
      isDownloaded: isDownloaded ?? this.isDownloaded,
      transition: transition ?? this.transition,
      volume: volume ?? this.volume,
    );
  }
}

class PlayerStatus {
  final bool activated;
  final bool? deleted;
  final String? screenId;
  final List<ContentItem> content;
  final String accountName;
  final String? accountAvatar;
  final String deviceName;
  final String? backgroundMusic; // NEW: Background music URL

  PlayerStatus({
    required this.activated,
    this.deleted,
    this.screenId,
    required this.content,
    required this.accountName,
    this.accountAvatar,
    required this.deviceName,
    this.backgroundMusic,
  });

  factory PlayerStatus.fromJson(Map<String, dynamic> json) {
    final contentList = (json['content'] as List<dynamic>? ?? [])
        .map((e) => ContentItem.fromJson(e as Map<String, dynamic>))
        .toList();

    // Sort by order
    contentList.sort((a, b) => a.order.compareTo(b.order));

    return PlayerStatus(
      activated: json['activated'] ?? false,
      deleted: json['deleted'],
      screenId: json['screenId'],
      content: contentList,
      accountName: json['accountName'] ?? 'Unknown Account',
      accountAvatar: json['accountAvatar'],
      deviceName: json['deviceName'] ?? 'TV Display',
      backgroundMusic: json['backgroundMusic'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'activated': activated,
      'deleted': deleted,
      'screenId': screenId,
      'content': content.map((e) => e.toJson()).toList(),
      'accountName': accountName,
      'accountAvatar': accountAvatar,
      'deviceName': deviceName,
      'backgroundMusic': backgroundMusic,
    };
  }
}

enum ViewState {
  unregistered,
  notConnected,
  connected,
  playing,
  settings,
}

class SyncProgress {
  final bool isInProgress;
  final int totalItems;
  final int downloadedItems;
  final int failedItems;
  final String? currentFileName;
  final String? errorMessage;

  SyncProgress({
    this.isInProgress = false,
    this.totalItems = 0,
    this.downloadedItems = 0,
    this.failedItems = 0,
    this.currentFileName,
    this.errorMessage,
  });

  SyncProgress copyWith({
    bool? isInProgress,
    int? totalItems,
    int? downloadedItems,
    int? failedItems,
    String? currentFileName,
    String? errorMessage,
  }) {
    return SyncProgress(
      isInProgress: isInProgress ?? this.isInProgress,
      totalItems: totalItems ?? this.totalItems,
      downloadedItems: downloadedItems ?? this.downloadedItems,
      failedItems: failedItems ?? this.failedItems,
      currentFileName: currentFileName ?? this.currentFileName,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  double get progress => totalItems > 0 ? downloadedItems / totalItems : 0.0;
}
