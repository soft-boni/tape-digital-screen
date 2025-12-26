# Flutter TV App - Complete Implementation Guide

## 🎯 Project Status

**Created**: Core Flutter project structure with providers  
**Progress**: 30% - Foundation ready  
**Next**: Data models, API client, screens (matching Player.tsx)

---

## 📁 Current Structure

```
tape-tv-app/
├── lib/
│   ├── main.dart ✅               # App entry + providers
│   ├── core/
│   │   ├── constants.dart ✅      # Backend config
│   │   └── theme.dart ✅          # App theme
│   ├── data/                     # TO CREATE
│   ├── presentation/             # TO CREATE  
│   └── providers/                # TO CREATE
├── pubspec.yaml ✅               # Dependencies
└── README.md ✅
```

---

## 🎬 Screen Flow (Matching Player.tsx)

Your web `/player` has these states - Flutter will match exactly:

### 1. **Unregistered Screen**
```typescript
// Player.tsx line 389-432
if (viewState === 'unregistered') {
  return (
    <div>
      <TapeLogo />
      <h1>Register This Device</h1>
      <Button onClick={registerDevice}>Register Device</Button>
    </div>
  );
}
```

**Flutter Equivalent**: `UnregisteredScreen`
- Tape logo
- "Register This Device" heading
- Register button
- Calls `/player/register` on click

### 2. **PIN Screen** (Not Connected)
```typescript
// Player.tsx line 435-549
if (viewState === 'not-connected') {
  return (
    <div>
      <TapeLogo />
      <h1>Connect to tape</h1>
      <QRCodeSVG value={qrUrl} />
      <div className="text-6xl">{pin}</div>
    </div>
  );
}
```

**Flutter Equivalent**: `PinScreen`
- Shows PIN in large text (6xl = 72px → Flutter: 72.0)
- QR code with URL: `https://tape-screen.vercel.app/connect?pin={pin}`
- Polls `/player/status` every 5 seconds
- Auto-navigates to Home when `activated=true`

### 3. **Home Screen** (Connected Menu)
```typescript
// Player.tsx line 552-601
if (viewState === 'connected') {
  return (
    <div>
      <TapeLogo />
      <p>Connected to {accountName}'s dashboard</p>
      <Button onClick={() => setViewState('playing')}>Play</Button>
      <Button onClick={syncContent}>Sync</Button>
      <Button onClick={() => setViewState('settings')}>Settings</Button>
    </div>
  );
}
```

**Flutter Equivalent**: `HomeScreen`
- "Connected to {accountName}'s dashboard"
- Play button (launches PlayerScreen)
- Sync button (downloads content)
- Settings button (opens SettingsScreen)

### 4. **Player Screen** (Playing)
```typescript
// Player.tsx line 688-841
if (viewState === 'playing') {
  return (
    <div className="h-screen bg-black">
      {currentItem?.type === 'image' ? (
        <img src={currentItem.url} className="w-full h-full" />
      ) : (
        <video src={currentItem.url} autoPlay />
      )}
      {showControls && <div>Controls overlay</div>}
    </div>
  );
}
```

**Flutter Equivalent**: `PlayerScreen`
- Fullscreen black background
- Image: `Image.file()` for offline
- Video: `VideoPlayer` widget
- Auto-advance based on `duration`
- Controls overlay (auto-hide after 5s)

### 5. **Settings Screen**
```typescript
// Player.tsx line 604-684
if (viewState === 'settings') {
  return (
    <div>
      <h2>Device Settings</h2>
      <input value={deviceName} onChange={...} />
      <Button onClick={handleUpdateDeviceName}>Save</Button>
      <Button onClick={handleRemoveDevice}>Remove Account</Button>
    </div>
  );
}
```

**Flutter Equivalent**: `SettingsScreen`
- Device name input + save button
- Storage usage display
- Account info (avatar + name)
- Remove device button
- Back to menu button

---

## 📦 Data Models (Matching Backend)

From your `Player.tsx` and backend responses:

```dart
// lib/data/models/device.dart
class Device {
  final String id;
  final String? pin;
  final String name;
  final bool activated;
  final String? screenId;
  final String? userId;
  final DateTime lastSeen;
}

// lib/data/models/content.dart
class ContentItem {
  final String contentId;
  final int duration;        // seconds
  final int order;
  final String type;         // 'image' | 'video'
  final String url;          // Cloudinary URL
  final String name;
  final String? localPath;   // Downloaded file path
  final bool isDownloaded;
}

// lib/data/models/player_status.dart
class PlayerStatus {
  final bool activated;
  final bool? deleted;
  final String? screenId;
  final List<ContentItem> content;
  final String accountName;
  final String? accountAvatar;
  final String deviceName;
}
```

---

## 🔌 API Client (Dio)

```dart
// lib/data/api_client.dart
class ApiClient {
  final Dio _dio;
  
  Future<Map<String, dynamic>> registerDevice(String ipAddress) async {
    final response = await _dio.post(
      '${Constants.apiBaseUrl}/player/register',
      data: {'ipAddress': ipAddress},
    );
    return response.data; // {deviceId, pin, activated}
  }
  
  Future<PlayerStatus> getPlayerStatus(String deviceId) async {
    final response = await _dio.get(
      '${Constants.apiBaseUrl}/player/status',
      queryParameters: {'deviceId': deviceId},
    );
    return PlayerStatus.fromJson(response.data);
  }
  
  Future<void> updateDevice(String deviceId, String name) async {
    await _dio.put(
      '${Constants.apiBaseUrl}/devices/$deviceId',
      data: {'name': name},
    );
  }
  
  Future<void> deleteDevice(String deviceId) async {
    await _dio.delete(
      '${Constants.apiBaseUrl}/devices/$deviceId',
    );
  }
  
  Future<void> downloadFile(String url, String localPath) async {
    await _dio.download(url, localPath);
  }
}
```

---

## 🏪 Providers (State Management)

### DeviceProvider
```dart
class DeviceProvider extends ChangeNotifier {
  ViewState _viewState = ViewState.unregistered;
  Device? _device;
  PlayerStatus? _status;
  Timer? _pollTimer;
  
  Future<void> registerDevice() async {
    final ip = await getIpAddress();
    final result = await apiClient.registerDevice(ip);
    _device = Device.fromJson(result);
    _viewState = ViewState.notConnected;
    _startPolling();
    notifyListeners();
  }
  
  void _startPolling() {
    _pollTimer = Timer.periodic(
      Constants.activationPollInterval,
      (_) => _checkActivation(),
    );
  }
  
  Future<void> _checkActivation() async {
    final status = await apiClient.getPlayerStatus(_device!.id);
    if (status.deleted) {
      await registerDevice(); // Re-register
      return;
    }
    if (status.activated) {
      _pollTimer?.cancel();
      _status = status;
      _viewState = ViewState.connected;
      notifyListeners();
    }
  }
}
```

### ContentProvider
```dart
class ContentProvider extends ChangeNotifier {
  List<ContentItem> _content = [];
  bool _isSyncing = false;
  int _downloadedCount = 0;
  int _totalCount = 0;
  
  Future<void> syncContent(List<ContentItem> items) async {
    _isSyncing = true;
    _totalCount = items.length;
    _downloadedCount = 0;
    notifyListeners();
    
    for (final item in items) {
      try {
        final localPath = await _downloadContent(item);
        final updated = item.copyWith(
          localPath: localPath,
          isDownloaded: true,
        );
        await _saveToDatabase(updated);
        _downloadedCount++;
        notifyListeners();
      } catch (e) {
        print('Download failed: ${item.name}');
      }
    }
    
    _isSyncing = false;
    notifyListeners();
  }
  
  Future<String> _downloadContent(ContentItem item) async {
    final dir = await getApplicationDocumentsDirectory();
    final localPath = '${dir.path}/content/${item.contentId}.${_getExtension(item.type)}';
    await apiClient.downloadFile(item.url, localPath);
    return localPath;
  }
}
```

### PlaybackProvider
```dart
class PlaybackProvider extends ChangeNotifier {
  List<ContentItem> _playlist = [];
  int _currentIndex = 0;
  Timer? _advanceTimer;
  
  void loadPlaylist(List<ContentItem> content) {
    _playlist = content..sort((a, b) => a.order.compareTo(b.order));
    _currentIndex = 0;
    notifyListeners();
  }
  
  ContentItem? get currentItem => 
    _playlist.isNotEmpty ? _playlist[_currentIndex] : null;
  
  void moveToNext() {
    _currentIndex = (_currentIndex + 1) % _playlist.length;
    notifyListeners();
    _scheduleNextAdvance();
  }
  
  void _scheduleNextAdvance() {
    _advanceTimer?.cancel();
    final duration = currentItem?.duration ?? Constants.defaultContentDuration;
    _advanceTimer = Timer(
      Duration(seconds: duration),
      moveToNext,
    );
  }
}
```

---

## 📊 Implementation Progress

### ✅ Completed (30%)
- [x] Project structure
- [x] Constants & theme
- [x] Main app setup with providers
- [x] pubspec dependencies

### 🚧 Next Steps (70%)
- [ ] Data models (Device, Content, PlayerStatus)
- [ ] API client (Dio)
- [ ] Providers (Device, Content, Playback)
- [ ] RouterScreen (state-based navigation)
- [ ] UnregisteredScreen
- [ ] PinScreen (with QR code)
- [ ] HomeScreen
- [ ] PlayerScreen (video/image playback)
- [ ] SettingsScreen
- [ ] Local database (SQLite)
- [ ] AndroidManifest configuration

---

## ⏱️ Time Estimate

- **Data layer**: 2 hours
- **Providers**: 2 hours
- **Screens**: 4 hours
- **Testing**: 2 hours

**Total**: ~10 hours to complete

---

## 🚀 Next Action

Should I:
1. **Continue building** all remaining files now?
2. **Create working skeleton** (minimal but functional)?
3. **Provide step-by-step guide** for you to complete in VS Code/Android Studio?

Let me know and I'll proceed!
