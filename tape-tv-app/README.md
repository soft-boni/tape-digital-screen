# Tape TV Player - Flutter

Official Flutter application for Tape Digital Signage - optimized for Android TV offline playback.

## Features

- 📺 Android TV optimized interface
- 📌 PIN-based device activation
- 🔄 Content synchronization from backend
- 📥 Offline content playback
- 🎬 Video and image support
- ⚙️ Device settings management

## Interface States

The app replicates the web player (`/player`) with these states:

1. **Unregistered** - Device registration prompt
2. **Not Connected** - PIN/QR code display for activation
3. **Connected** - Main menu (Play/Sync/Settings)
4. **Playing** - Fullscreen content playback  
5. **Settings** - Device configuration

## Setup

### Prerequisites
- Flutter SDK 3.0+
- Android Studio with Android SDK
- Android TV emulator or physical device

### Installation

```bash
# Get dependencies
flutter pub get

# Run on Android TV
flutter run -d <tv-device-id>

# Build APK
flutter build apk --release
```

## Backend Integration

Connects to existing Tape backend:
- Supabase URL: `https://aumsyunntzcbqajwdyga.supabase.co`
- API Base: `/functions/v1/make-server-31bfbcca/`
- Endpoints: `/player/register`, `/player/status`

## Project Structure

```
lib/
├── main.dart                    # App entry point
├── core/
│   ├── constants.dart           # Backend config, API URLs
│   └── theme.dart               # App theme matching web
├── data/
│   ├── models/                  # Data models
│   ├── repositories/            # API & local data
│   └── local/                   # SQLite database
├── presentation/
│   ├── screens/
│   │   ├── unregistered_screen.dart
│   │   ├── pin_screen.dart
│   │   ├── home_screen.dart
│   │   ├── player_screen.dart
│   │   └── settings_screen.dart
│   └── widgets/                 # Reusable UI components
└── providers/                   # State management
    ├── device_provider.dart
    ├── content_provider.dart
    └── playback_provider.dart
```

## Development

This Flutter app is part of the Tape Digital Signage ecosystem:
- **Web App** (React/Vite) - Admin dashboard
- **TV App** (Flutter) - Content player
- **Backend** (Supabase + Deno) - Shared infrastructure
  flutter clean
  flutter pub get
All apps use the same backend and content management system.

## License

© 2025 Tape. All Rights Reserved.
