import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../core/constants.dart';

class DeviceProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  ViewState _viewState = ViewState.unregistered;
  Device? _device;
  PlayerStatus? _status;
  Timer? _pollTimer;
  String? _error;
  bool _isLoading = false;

  ViewState get viewState => _viewState;
  Device? get device => _device;
  PlayerStatus? get status => _status;
  String? get error => _error;
  bool get isLoading => _isLoading;

  DeviceProvider() {
    _initializeDevice();
  }

  Future<void> _initializeDevice() async {
    print('🚀 Initializing device...');
    final prefs = await SharedPreferences.getInstance();
    final deviceId = prefs.getString(Constants.prefsDeviceId);

    if (deviceId != null) {
      print('📱 Found existing device ID: $deviceId');

      // Check if device is already activated
      final isActivated =
          prefs.getBool(Constants.prefsDeviceActivated) ?? false;
      print('✅ Saved activation status: $isActivated');

      _device = Device(
        id: deviceId,
        pin: prefs.getString(Constants.prefsDevicePin),
        name: 'TV Device',
        activated: isActivated,
        lastSeen: DateTime.now(),
      );

      if (isActivated) {
        print(
            '🎉 Device already activated! Loading cache and checking for updates...');

        // Load cache immediately so we have content to show/play while checking online
        await _loadCachedStatus();

        _viewState = ViewState.connected;
        notifyListeners();

        // Check for latest content in background
        _checkActivationStatus();
      } else {
        print('⏳ Not activated yet, showing PIN screen...');
        _viewState = ViewState.notConnected;
        notifyListeners();
        await _checkActivationStatus();

        // Start polling only if not activated yet
        if (!(_status?.activated ?? false)) {
          _startPolling();
        }
      }
    }
  }

  /// Register new device
  Future<void> registerDevice() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      print('🔵 Starting device registration...');
      final ipAddress = await _getIpAddress();
      print('🔵 Got IP address: $ipAddress');

      final response = await _api.registerDevice(ipAddress);
      print('🔵 Registration response: $response');

      _device = Device.fromJson(response);
      _viewState = ViewState.notConnected;

      // Save to prefs
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(Constants.prefsDeviceId, _device!.id);
      await prefs.setString(Constants.prefsDevicePin, _device!.pin ?? '');

      print('✅ Device registered successfully! PIN: ${_device!.pin}');
      _isLoading = false;
      notifyListeners();
      _startPolling();
    } catch (e) {
      print('❌ Registration failed: $e');
      _error = 'Registration failed: $e';
      _isLoading = false;
      notifyListeners();
      rethrow; // Re-throw to allow UI to handle
    }
  }

  /// Start polling for activation
  void _startPolling() {
    print(
        '🔄 Starting activation polling every ${Constants.activationPollInterval.inSeconds} seconds...');
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(
      Constants.activationPollInterval,
      (_) => _checkActivationStatus(),
    );
    // Do first check immediately
    _checkActivationStatus();
  }

  /// Check if device is activated
  Future<void> _checkActivationStatus() async {
    if (_device == null) return;

    print('🔍 Checking activation status for device: ${_device!.id}');

    try {
      final status = await _api.getPlayerStatus(_device!.id);
      print(
          '📡 API Response - activated: ${status.activated}, deleted: ${status.deleted}');

      // Check if deleted - re-register
      if (status.deleted == true) {
        await _clearDevice();
        await registerDevice();
        return;
      }

      _status = status;

      if (status.activated) {
        print('✅ Device is ACTIVATED! Saving state and transitioning...');

        // CRITICAL: Save activation state and Playlist Manifest to persist across restarts
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(Constants.prefsDeviceActivated, true);

        // Save the full status object (including content list)
        await prefs.setString(
            Constants.prefsPlayerStatus, jsonEncode(status.toJson()));

        print(
            '💾 Activation state and Playlist Manifest saved to SharedPreferences');

        _pollTimer?.cancel();
        _viewState = ViewState.connected;
        notifyListeners();
      } else {
        print('⏳ Still waiting for activation...');
      }
    } catch (e) {
      print('❌ Activation check failed: $e');

      // If we are already activated, try to load from cache
      if (_device != null && _device!.activated && _status == null) {
        print('⚠️ Trying to load cached PlayerStatus due to network error...');
        await _loadCachedStatus();
      } else {
        _error = e.toString();
        notifyListeners();
      }
    }
  }

  /// Load cached PlayerStatus from SharedPreferences
  Future<void> _loadCachedStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = prefs.getString(Constants.prefsPlayerStatus);

      if (jsonStr != null) {
        final Map<String, dynamic> jsonMap = jsonDecode(jsonStr);
        _status = PlayerStatus.fromJson(jsonMap);
        print(
            '📦 Loaded cached PlayerStatus with ${_status!.content.length} items');

        if (_viewState != ViewState.playing &&
            _viewState != ViewState.settings) {
          _viewState = ViewState.connected;
        }
        notifyListeners();
      } else {
        print('⚠️ No cached PlayerStatus found.');
        _error = 'Offline and no content cached.';
        notifyListeners();
      }
    } catch (e) {
      print('❌ Failed to load cached status: $e');
      _error = 'Failed to load offline content.';
      notifyListeners();
    }
  }

  /// Navigate to playing state
  void startPlaying() {
    _viewState = ViewState.playing;
    notifyListeners();
  }

  /// Navigate to settings
  void openSettings() {
    _viewState = ViewState.settings;
    notifyListeners();
  }

  /// Navigate back to connected/home
  void backToHome() {
    _viewState = ViewState.connected;
    notifyListeners();
  }

  /// Update device name
  Future<void> updateDeviceName(String name) async {
    if (_device == null) return;

    try {
      await _api.updateDevice(_device!.id, name);
      _error = null;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Remove device and re-register
  Future<void> removeDevice() async {
    if (_device == null) return;

    try {
      await _api.deleteDevice(_device!.id);
      await _clearDevice();
      _viewState = ViewState.unregistered;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Set view state manually
  void setViewState(ViewState state) {
    _viewState = state;
    notifyListeners();
  }

  /// Sync content (placeholder - actual implementation in PlaybackProvider)
  Future<void> syncContent() async {
    // This will be handled by PlaybackProvider
    // Just a placeholder to prevent errors
    print('🔄 Sync triggered from DeviceProvider');
  }

  Future<void> _clearDevice() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(Constants.prefsDeviceId);
    await prefs.remove(Constants.prefsDevicePin);
    await prefs.remove(Constants.prefsDeviceActivated); // Clear activation flag
    _device = null;
    _status = null;
    _pollTimer?.cancel();
  }

  Future<String> _getIpAddress() async {
    try {
      for (var interface in await NetworkInterface.list()) {
        for (var addr in interface.addresses) {
          if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
            return addr.address;
          }
        }
      }
    } catch (e) {
      // Fallback
    }
    return '0.0.0.0';
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}
