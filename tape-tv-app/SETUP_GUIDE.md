# Flutter TV App - Setup & Testing Guide

## ✅ What's Been Created

### Project Structure
```
tape-tv-app/
├── pubspec.yaml          ✅ Dependencies configured
├── lib/
│   ├── main.dart         ✅ App entry point
│   ├── core/
│   │   ├── constants.dart  ✅ Backend config
│   │   └── theme.dart      ✅ App styling
│   └── data/
│       └── models.dart     ✅ Data models (Device, Content, PlayerStatus)
```

### Features Included in Models
- ✅ Transition effects (`transition`: none/fade/slide/zoom)
- ✅ Video volume control (`volume`: 0-100)
- ✅ Background music URL (`backgroundMusic`)

---

## 🚧 What's Still Needed

To make this a fully functional app, you need:

### 1. API Client
- `lib/data/api_client.dart` - Dio HTTP client
- Handles `/player/register`, `/player/status`, file downloads

### 2. Database (SQLite)
- `lib/data/database.dart` - sqflite setup
- Store downloaded content metadata offline

### 3. State Providers (Provider package)
- `lib/providers/device_provider.dart` - Device registration & activation
- `lib/providers/content_provider.dart` - Content sync & downloads
- `lib/providers/playback_provider.dart` - Playlist management

### 4. UI Screens
- `lib/presentation/screens/router_screen.dart` - State-based navigation
- `lib/presentation/screens/unregistered_screen.dart` - Register button
- `lib/presentation/screens/pin_screen.dart` - PIN/QR display + polling
- `lib/presentation/screens/home_screen.dart` - Play/Sync/Settings menu
- `lib/presentation/screens/player_screen.dart` - Full screen playback
- `lib/presentation/screens/settings_screen.dart` - Device settings

### 5. Playback Logic
- Transition animations (fade/slide/zoom)
- Video player with volume control
- Background music looping
- Auto-advance timer

---

## 📋 Quick Setup in Android Studio

### Prerequisites
1. **Install Flutter SDK**: https://docs.flutter.dev/get-started/install/windows
2. **Add to PATH**: Add Flutter bin folder to system PATH
3. **Install Android Studio**: Already installed ✅
4. **Configure Flutter in Android Studio**:
   - File > Settings > Plugins > Install "Flutter" plugin
   - Restart Android Studio

### Open Project
1. Open Android Studio
2. File > Open
3. Navigate to: `C:\Users\Boni\OneDrive\Desktop\'Digital Signage Management App\tape-tv-app`
4. Click OK

### Get Dependencies
```bash
cd "C:\Users\Boni\OneDrive\Desktop\Digital Signage Management App\tape-tv-app"
flutter pub get
```

### Create Android TV Emulator
1. Tools > Device Manager
2. Create Device > TV > Android TV (1080p)
3. Select System Image: API 33 (Android 13)
4. Finish

### Run App
```bash
flutter run -d <emulator-name>
```

---

## 🎯 Current Status

**Completion**: ~20%

### ✅ Done
- Project structure
- Dependencies (pubspec.yaml)
- Constants with backend config
- Theme matching web app
- Data models with all new features
- Main app entry point

### 🚧 Remaining (~8-10 hours work)
1. API Client (2 hours)
2. Database setup (1 hour)
3. Providers (3 hours)
4. UI Screens (3-4 hours)
5. Playback engine (2 hours)

---

## 💡 Recommendations

### Option A: I Complete the App
- I'll create all remaining ~20 files
- Full implementation matching Player.tsx
- Ready to test in ~30-40 minutes

### Option B: Guided Build
- I provide detailed code for each file
- You copy/paste into Android Studio
- Learn Flutter development process

### Option C: Hybrid Approach
-  I create critical files (API, Providers, Main screens)
- You handle styling/polish in Android Studio

---

## 🔧 Testing Strategy

Once complete:
1. **Emulator Test**: Run on Android TV emulator
2. **Device Registration**: Check PIN display
3. **Web Activation**: Activate from web dashboard
4. **Content Sync**: Download test content
5. **Offline Playback**: Disconnect internet, verify playback
6. **Transitions**: Test fade/slide/zoom effects
7. **Volume**: Test video volume control
8. **Background Music**: Test music looping

---

## 📞 Next Steps

**Which option would you prefer?**
1. I'll finish building the complete app now (Option A) ✅ Recommended
2. Guide me through each file (Option B)
3. Hybrid approach (Option C)

Let me know and I'll proceed!
