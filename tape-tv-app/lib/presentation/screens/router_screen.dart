import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../data/models.dart';
import '../../providers/device_provider.dart';
import 'unregistered_screen.dart';
import 'pin_screen.dart';
import 'connected_screen.dart';
import 'player_screen.dart';
import 'settings_screen.dart';

/// Router screen that displays the appropriate screen based on ViewState
class RouterScreen extends StatelessWidget {
  const RouterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (context, deviceProvider, _) {
        switch (deviceProvider.viewState) {
          case ViewState.unregistered:
            return const UnregisteredScreen();
          case ViewState.notConnected:
            return const PinScreen();
          case ViewState.connected:
            return const ConnectedScreen();
          case ViewState.playing:
            return const PlayerScreen();
          case ViewState.settings:
            return const SettingsScreen();
        }
      },
    );
  }
}
