import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'presentation/screens/router_screen.dart';
import 'providers/device_provider.dart';
import 'providers/content_provider.dart';
import 'providers/playback_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock orientation to landscape (TV mode)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  // Hide system UI for immersive experience
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  runApp(const TapeTVApp());
}

class TapeTVApp extends StatefulWidget {
  const TapeTVApp({super.key});

  @override
  State<TapeTVApp> createState() => _TapeTVAppState();
}

class _TapeTVAppState extends State<TapeTVApp> {
  late final ContentProvider _contentProvider;

  @override
  void initState() {
    super.initState();
    _contentProvider = ContentProvider();
    // Initialize content provider to load downloaded content
    _contentProvider.initialize();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => DeviceProvider()),
        ChangeNotifierProvider.value(value: _contentProvider),
        ChangeNotifierProvider(create: (_) => PlaybackProvider()),
      ],
      child: MaterialApp(
        title: 'Tape Player',
        theme: AppTheme.lightTheme,
        debugShowCheckedModeBanner: false,
        home: const RouterScreen(),
      ),
    );
  }
}
