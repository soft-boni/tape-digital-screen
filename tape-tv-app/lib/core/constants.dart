/// Core constants for Tape TV Player
/// Matches backend configuration from existing web app
library;

class Constants {
  // Supabase Configuration (from utils/supabase/info.tsx)
  static const String supabaseProjectId = 'aumsyunntzcbqajwdyga';
  static const String supabaseUrl = 'https://$supabaseProjectId.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bXN5dW5udHpjYnFhandkeWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjQwNDgsImV4cCI6MjA4MTgwMDA0OH0.mRj__b-haEPW5PaSgAEEAob_ewPWIme89mYaPLWtyhM';

  // API Configuration
  static const String apiBaseUrl =
      '$supabaseUrl/functions/v1/make-server-31bfbcca';
  static const Duration apiTimeout = Duration(seconds: 30);

  // Endpoints
  static const String registerEndpoint = '/player/register';
  static const String statusEndpoint = '/player/status';
  static const String updateDeviceEndpoint = '/devices';

  // Polling Configuration
  static const Duration activationPollInterval = Duration(seconds: 5);
  static const Duration statusUpdateInterval = Duration(seconds: 30);

  // Storage
  static const String contentDirectory = 'content';
  static const String prefsDeviceId = 'device_id';
  static const String prefsDevicePin = 'device_pin';
  static const String prefsDeviceActivated = 'device_activated';

  // Playback
  static const int defaultContentDuration = 10; // seconds
  static const Duration autoHideControls = Duration(seconds: 5);

  // Web App URLs
  static const String webAppUrl = 'https://tape-screen.vercel.app';

  // App Info
  static const String appName = 'Tape Player';
  static const String appVersion = '1.0.0';
}
