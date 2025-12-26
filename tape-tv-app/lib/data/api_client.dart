import 'package:dio/dio.dart';
import '../core/constants.dart';
import 'models.dart';

class ApiClient {
  final Dio _dio;

  ApiClient()
      : _dio = Dio(BaseOptions(
          baseUrl: Constants.apiBaseUrl,
          connectTimeout: Constants.apiTimeout,
          receiveTimeout: Constants.apiTimeout,
          headers: {
            'Content-Type': 'application/json',
            'apikey': Constants.supabaseAnonKey,
            'Authorization': 'Bearer ${Constants.supabaseAnonKey}',
          },
        )) {
    _dio.interceptors.add(LogInterceptor(
      requestBody: true,
      responseBody: true,
    ));
  }

  /// Register a new device and get PIN
  Future<Map<String, dynamic>> registerDevice(String ipAddress) async {
    try {
      final response = await _dio.post(
        '/player/register',
        data: {'ipAddress': ipAddress},
      );
      return response.data as Map<String, dynamic>;
    } catch (e) {
      throw _handleError(e);
    }
  }

  /// Check activation status and get content
  Future<PlayerStatus> getPlayerStatus(String deviceId) async {
    try {
      print('🔵 API: Fetching player status for deviceId: $deviceId');
      final response = await _dio.get(
        '/player/status',
        queryParameters: {'deviceId': deviceId},
      );
      print('🔵 API Response Status Code: ${response.statusCode}');
      print('🔵 API Response Data: ${response.data}');

      final playerStatus =
          PlayerStatus.fromJson(response.data as Map<String, dynamic>);
      print('🔵 Parsed PlayerStatus:');
      print('   - activated: ${playerStatus.activated}');
      print('   - deviceName: ${playerStatus.deviceName}');
      print('   - accountName: ${playerStatus.accountName}');
      print('   - content count: ${playerStatus.content.length}');
      print('   - backgroundMusic: ${playerStatus.backgroundMusic}');

      return playerStatus;
    } catch (e) {
      print('❌ API Error in getPlayerStatus: $e');
      throw _handleError(e);
    }
  }

  /// Update device name
  Future<void> updateDevice(String deviceId, String name) async {
    try {
      await _dio.put(
        '/devices/$deviceId',
        data: {'name': name},
      );
    } catch (e) {
      throw _handleError(e);
    }
  }

  /// Remove device
  Future<void> deleteDevice(String deviceId) async {
    try {
      await _dio.delete('/devices/$deviceId');
    } catch (e) {
      throw _handleError(e);
    }
  }

  /// Download file from URL
  Future<void> downloadFile(String url, String savePath,
      {Function(int, int)? onProgress}) async {
    try {
      await _dio.download(
        url,
        savePath,
        onReceiveProgress: onProgress,
      );
    } catch (e) {
      throw _handleError(e);
    }
  }

  String _handleError(dynamic error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.receiveTimeout:
          return 'Connection timeout. Please check your internet.';
        case DioExceptionType.badResponse:
          return error.response?.data['error'] ??
              'Server error: ${error.response?.statusCode}';
        default:
          return 'Network error. Please try again.';
      }
    }
    return error.toString();
  }
}
