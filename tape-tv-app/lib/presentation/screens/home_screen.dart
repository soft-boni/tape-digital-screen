import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/device_provider.dart';
import '../../providers/content_provider.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        color: const Color(0xFFF9FAFB),
        child: Consumer2<DeviceProvider, ContentProvider>(
          builder: (context, deviceProvider, contentProvider, _) {
            final status = deviceProvider.status;
            final syncProgress = contentProvider.syncProgress;

            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Tape Logo
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: Colors.indigo,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Center(
                      child: Text(
                        'TAPE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 48),

                  // Connected message
                  RichText(
                    text: TextSpan(
                      style: Theme.of(context).textTheme.headlineMedium,
                      children: [
                        const TextSpan(text: 'Connected to '),
                        TextSpan(
                          text: status?.accountName ?? 'Dashboard',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const TextSpan(text: "'s dashboard"),
                      ],
                    ),
                  ),
                  const SizedBox(height: 64),

                  // Buttons
                  Wrap(
                    spacing: 24,
                    runSpacing: 24,
                    alignment: WrapAlignment.center,
                    children: [
                      // Play Button
                      _MenuButton(
                        icon: Icons.play_arrow,
                        label: 'Play',
                        onPressed: () {
                          deviceProvider.startPlaying();
                        },
                      ),

                      // Sync Button
                      _MenuButton(
                        icon: Icons.sync,
                        label:
                            syncProgress.isInProgress ? 'Syncing...' : 'Sync',
                        onPressed: syncProgress.isInProgress
                            ? null
                            : () async {
                                final content = status?.content ?? [];
                                final backgroundMusic = status?.backgroundMusic;
                                if (content.isNotEmpty ||
                                    backgroundMusic != null) {
                                  await contentProvider.syncContent(
                                    content,
                                    backgroundMusicUrl: backgroundMusic,
                                  );
                                }
                              },
                      ),

                      // Settings Button
                      _MenuButton(
                        icon: Icons.settings,
                        label: 'Settings',
                        onPressed: () {
                          deviceProvider.openSettings();
                        },
                      ),
                    ],
                  ),

                  // Sync Progress
                  if (syncProgress.isInProgress) ...[
                    const SizedBox(height: 48),
                    SizedBox(
                      width: 400,
                      child: Column(
                        children: [
                          LinearProgressIndicator(value: syncProgress.progress),
                          const SizedBox(height: 8),
                          Text(
                            '${syncProgress.downloadedItems}/${syncProgress.totalItems} items',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                          if (syncProgress.currentFileName != null)
                            Text(
                              syncProgress.currentFileName!,
                              style: TextStyle(
                                color: Colors.grey[500],
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _MenuButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  const _MenuButton({
    required this.icon,
    required this.label,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 180,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(fontSize: 18)),
          ],
        ),
      ),
    );
  }
}
