import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { Loader2, Monitor, Settings as SettingsIcon, Play, RefreshCw, Sun, Volume2, X } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { Button } from "../components/ui/button";
import { TapeLogo } from "../components/TapeLogo";

type ViewState = 'unregistered' | 'not-connected' | 'connected' | 'playing' | 'settings';

export function Player() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>('unregistered');
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deviceName, setDeviceName] = useState("Samsung 55' Smart Display");
  const [accountName, setAccountName] = useState("User");
  const [showControls, setShowControls] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(50);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Check for existing device on mount
  useEffect(() => {
    const storedDeviceId = localStorage.getItem('deviceId');
    const storedPin = localStorage.getItem('devicePin');

    if (storedDeviceId) {
      // Check if this device still exists and is activated
      setDeviceId(storedDeviceId);
      if (storedPin) {
        setPin(storedPin);
      }
      setViewState('not-connected'); // Default to not-connected until we confirm activation
      checkActivationStatus(storedDeviceId);
    } else {
      // No stored device - show manual registration screen
      setViewState('unregistered');
      setLoading(false);
    }
  }, []);

  // Poll for activation status (only when not connected and has deviceId)
  useEffect(() => {
    if (!deviceId || viewState !== 'not-connected') return;

    const interval = setInterval(() => checkActivationStatus(deviceId), 5000);
    return () => clearInterval(interval);
  }, [deviceId, viewState]);

  // Auto-advance content
  useEffect(() => {
    if (viewState !== 'playing' || content.length === 0) return;

    const timeout = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % content.length);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [currentIndex, content, viewState]);

  // Auto-hide controls
  useEffect(() => {
    if (viewState !== 'playing') return;

    const timeout = setTimeout(() => setShowControls(false), 5000);
    return () => clearTimeout(timeout);
  }, [showControls, viewState]);

  async function registerDevice() {
    try {
      setLoading(true);

      // Get IP address (with timeout)
      let ipAddress = 'unknown';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const ipRes = await fetch('https://api.ipify.org?format=json', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn('Could not detect IP, using unknown');
      }

      // Register device - use direct fetch for public endpoint
      const { projectId, publicAnonKey } = await import('../../../utils/supabase/info');
      const SUPABASE_ANON_KEY = publicAnonKey;

      if (!SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase anon key. Please check your configuration.');
      }

      if (!projectId) {
        throw new Error('Missing projectId. Please check your Supabase configuration.');
      }

      const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-31bfbcca`;

      console.log('Registering device at:', BASE_URL);
      console.log('Using projectId:', projectId);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Based on apiFetch pattern: "/content" -> BASE_URL + "/content" = "https://.../make-server-31bfbcca/content"
      // Backend expects: BASE_PATH + "/content" = "/make-server-31bfbcca/content"
      // This means Supabase strips "/functions/v1" but keeps the function name in the path
      // So we should call: BASE_URL + "/make-server-31bfbcca/player/register"
      // But BASE_URL already includes function name, so we just add "/make-server-31bfbcca/player/register"
      // Actually wait - that would duplicate. Let me check: BASE_URL = "https://.../functions/v1/make-server-31bfbcca"
      // So full URL = "https://.../functions/v1/make-server-31bfbcca/make-server-31bfbcca/player/register"
      // That's wrong! Let me try without the duplicate:
      const fullUrl = `${BASE_URL}/player/register`;
      console.log('Full registration URL:', fullUrl);
      console.log('Expected backend route:', '/make-server-31bfbcca/player/register');
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ ipAddress }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Registration failed with status ${response.status}` };
        }
        console.error('Registration error response:', errorData);
        console.error('Response status:', response.status);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));

        // Provide more helpful error message
        if (response.status === 404) {
          throw new Error(`Endpoint not found. The Supabase Edge Function may not be deployed. URL: ${fullUrl}`);
        }

        throw new Error(errorData.error || errorData.message || `Registration failed with status ${response.status}`);
      }

      const res = await response.json();
      console.log('Registration successful:', res);

      // Store device ID and PIN
      localStorage.setItem('deviceId', res.deviceId);
      localStorage.setItem('devicePin', res.pin);
      setDeviceId(res.deviceId);
      setPin(res.pin);
      setViewState('not-connected');
      setLoading(false);
    } catch (error: any) {
      console.error('Registration failed:', error);
      setLoading(false);

      const errorMessage = error.name === 'AbortError' || error.name === 'TimeoutError'
        ? 'Registration timed out. Please check your internet connection.'
        : error.message || 'Unknown error occurred';

      setRegistrationError(errorMessage);

      // Clear any stale data
      localStorage.removeItem('deviceId');
      localStorage.removeItem('devicePin');
      setDeviceId(null);
      setPin(null);
      setViewState('not-connected');
    }
  }

  async function checkActivationStatus(devId: string) {
    try {
      // Use direct fetch for public endpoint
      const { projectId, publicAnonKey } = await import('../../../utils/supabase/info');
      const SUPABASE_ANON_KEY = publicAnonKey;
      const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-31bfbcca`;

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${BASE_URL}/player/status?deviceId=${devId}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status check failed with status ${response.status}`);
      }

      const res = await response.json();

      if (res.deleted) {
        // Device was deleted by admin, register new one
        localStorage.removeItem('deviceId');
        localStorage.removeItem('devicePin');
        setDeviceId(null);
        setPin(null);
        setViewState('not-connected');
        registerDevice();
        return;
      }

      if (res.activated) {
        console.log('✅ Device activated, content received:', res.content);
        console.log('📊 Content count:', res.content?.length || 0);
        setViewState('connected');
        setContent(res.content || []);
        setAccountName(res.accountName || 'User');
        setDeviceName(res.deviceName || "Samsung 55' Smart Display");
        // Clear PIN from localStorage once activated
        localStorage.removeItem('devicePin');
      } else {
        // Device exists but not activated - show PIN screen
        setViewState('not-connected');
        // Ensure PIN is set from localStorage
        const storedPin = localStorage.getItem('devicePin');
        if (storedPin) {
          setPin(storedPin);
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Status check failed:', error);
      setLoading(false);
      // On error, assume not activated and show PIN screen
      setViewState('not-connected');
      const storedPin = localStorage.getItem('devicePin');
      if (storedPin) {
        setPin(storedPin);
      }
    }
  }

  async function syncContent() {
    if (!deviceId) return;

    try {
      const res = await apiFetch(`/player/status?deviceId=${deviceId}`);
      console.log('🔄 Sync content received:', res.content);
      setContent(res.content || []);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  async function handleUpdateDeviceName() {
    if (!deviceId || !deviceName.trim()) return;

    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: deviceName.trim() })
      });

      // Update local state
      const res = await apiFetch(`/player/status?deviceId=${deviceId}`);
      setDeviceName(res.deviceName || deviceName);

      alert('Device name updated successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to update device name');
    }
  }

  async function handleRemoveDevice() {
    if (!deviceId) return;

    if (!confirm('Remove this device from your account? It will need to be re-activated with a new PIN.')) return;

    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: 'DELETE'
      });

      // Clear local state
      localStorage.removeItem('deviceId');
      localStorage.removeItem('devicePin');
      setDeviceId(null);
      setPin(null);
      setViewState('not-connected');

      // Register new device with new PIN
      await registerDevice();
    } catch (error: any) {
      alert(error.message || 'Failed to remove device');
    }
  }

  // Unregistered Screen - User must manually register device
  if (viewState === 'unregistered') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center p-8">
          <div className="mb-8 flex justify-center">
            <TapeLogo width={120} />
          </div>

          <h1 className="text-3xl font-semibold mb-4">
            Register This Device
          </h1>

          <p className="text-gray-600 mb-8">
            Click the button below to register this device and generate a PIN code. You'll need this PIN to add the device from your admin dashboard.
          </p>

          <Button
            onClick={registerDevice}
            disabled={loading}
            size="lg"
            className="w-full h-14 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Monitor className="w-5 h-5 mr-2" />
                Register Device
              </>
            )}
          </Button>

          {registrationError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{registrationError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Connection Screen (QR + PIN) - Show if not connected
  if (viewState === 'not-connected') {
    // If no PIN yet, show loading or register device
    if (!pin) {
      if (deviceId) {
        // Device exists but no PIN - might be loading
        return (
          <div className="h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Loading device information...</p>
              <Button onClick={() => {
                localStorage.removeItem('deviceId');
                setDeviceId(null);
                registerDevice();
              }} variant="outline">
                Retry Registration
              </Button>
            </div>
          </div>
        );
      } else {
        // No device, should register
        return (
          <div className="h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md">
              {loading ? (
                <>
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Registering device...</p>
                  <p className="text-sm text-gray-500 mb-4">This may take a few seconds</p>
                </>
              ) : registrationError ? (
                <>
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium mb-2">Registration Failed</p>
                    <p className="text-sm text-red-600">{registrationError}</p>
                  </div>
                  <Button onClick={() => {
                    setRegistrationError(null);
                    registerDevice();
                  }} variant="outline">
                    Retry Registration
                  </Button>
                </>
              ) : (
                <Button onClick={() => registerDevice()} variant="outline">
                  Start Registration
                </Button>
              )}
            </div>
          </div>
        );
      }
    }

    const qrUrl = `https://tape-screen.vercel.app/connect?pin=${pin}`;

    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-4xl w-full">
          <div className="mb-8 flex justify-center">
            <TapeLogo width={150} />
          </div>
          <h1 className="text-4xl font-semibold text-center mb-12">Connect to tape</h1>

          <div className="bg-white rounded-xl p-12 shadow-sm flex gap-8">
            {/* QR Code Section */}
            <div className="flex-1 flex flex-col items-center justify-center border-r border-gray-200 pr-8">
              <h2 className="text-xl font-medium mb-2">Scan the QR code</h2>
              <p className="text-gray-600 text-sm mb-6 text-center">
                Use your mobile camera to scan the QR code
              </p>
              <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
                <QRCodeSVG
                  value={qrUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-center mt-4 text-xl font-bold text-gray-400">OR</p>
            </div>

            {/* PIN Section */}
            <div className="flex-1 flex flex-col justify-center pl-8">
              <h2 className="text-xl font-medium mb-2">Enter PIN on Web</h2>
              <p className="text-gray-600 text-sm mb-6">
                Enter your screen PIN on the add screen page
              </p>
              <ol className="text-sm text-gray-600 space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">1</span>
                  Go to tape.io
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">2</span>
                  Sign in or create an account
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">3</span>
                  Enter the following code:
                </li>
              </ol>
              <div className="text-6xl font-bold text-center tracking-wider font-mono text-blue-600">
                {pin}
              </div>
              <p className="text-sm text-gray-500 text-center mt-2">
                Enter this code on the Devices page
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Device Menu
  if (viewState === 'connected') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl p-12 shadow-sm max-w-md w-full text-center">
          <div className="mb-8 flex justify-center">
            <TapeLogo width={120} />
          </div>

          <p className="text-gray-700 mb-8">
            This device is connected to <span className="font-semibold">{accountName}'s</span> dashboard
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => {
                if (content.length > 0) {
                  setViewState('playing');
                } else {
                  alert('No content assigned to this device. Please assign a screen with content from the admin dashboard.');
                }
              }}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Play
            </Button>

            <Button
              onClick={syncContent}
              className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Sync
            </Button>

            <Button
              onClick={() => setViewState('settings')}
              variant="outline"
              className="w-full h-12 rounded-lg flex items-center justify-center gap-2"
            >
              <SettingsIcon className="w-5 h-5" />
              Settings
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-8">© Copyright 2025 | tape All Rights Reserved</p>
        </div>
      </div>
    );
  }

  // Settings Page
  if (viewState === 'settings') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="bg-white rounded-xl p-8 shadow-sm max-w-2xl w-full">
          <h2 className="text-2xl font-semibold mb-2">Device Settings</h2>
          <p className="text-gray-600 text-sm mb-8">Manage device configuration and connected screens</p>

          {/* Device Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Device Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button
                onClick={handleUpdateDeviceName}
                size="sm"
                className="bg-blue-500 hover:bg-blue-600"
              >
                Save
              </Button>
            </div>
          </div>

          {/* Storage Allocation */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium">Storage Allocation</label>
              <span className="text-sm text-gray-600">24 / 32</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>

          {/* Connected Account */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3">Connected Account</label>
            <p className="text-xs text-gray-600 mb-3">Manage account connected to this device</p>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">{accountName}</p>
                  <p className="text-sm text-gray-600">Connected Account</p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="bg-red-500 hover:bg-red-600"
                onClick={handleRemoveDevice}
              >
                Remove Account
              </Button>
            </div>
          </div>

          <Button
            onClick={() => setViewState('connected')}
            variant="outline"
            className="w-full"
          >
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  // Playing Content
  if (viewState === 'playing') {
    console.log('🎬 Entering playing state');
    console.log('📦 Content array:', content);
    console.log('📊 Content length:', content.length);
    console.log('👉 Current index:', currentIndex);

    if (content.length === 0) {
      console.error('❌ No content to play!');
      return (
        <div className="h-screen w-full bg-black flex items-center justify-center">
          <div className="text-center text-white space-y-4">
            <p className="text-2xl font-bold">No Content Available</p>
            <p className="text-gray-400">This device has no content assigned.</p>
            <Button
              onClick={() => setViewState('connected')}
              variant="outline"
              className="mt-4"
            >
              Back to Menu
            </Button>
          </div>
        </div>
      );
    }

    const currentItem = content[currentIndex];
    console.log('▶️ Playing content item:', currentIndex, currentItem);

    if (!currentItem) {
      console.error('❌ Current item is undefined!');
      return (
        <div className="h-screen w-full bg-black flex items-center justify-center">
          <div className="text-center text-white space-y-4">
            <p className="text-2xl font-bold">Content Error</p>
            <p className="text-gray-400">Current content item is missing.</p>
            <Button
              onClick={() => setViewState('connected')}
              variant="outline"
              className="mt-4"
            >
              Back to Menu
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="h-screen w-full bg-black relative"
        onMouseMove={() => setShowControls(true)}
      >
        {/* Content */}
        {currentItem?.type === 'image' ? (
          <img
            src={currentItem.url}
            alt="Content"
            className="w-full h-full object-contain"
            onError={(e) => {
              console.error('❌ Image failed to load:', currentItem.url);
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white"%3EImage Load Failed%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : currentItem?.type === 'video' ? (
          <video
            src={currentItem.url}
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
            onEnded={() => setCurrentIndex((prev) => (prev + 1) % content.length)}
            onError={(e) => {
              console.error('❌ Video failed to load:', currentItem.url);
            }}
          />
        ) : (
          <div className="h-screen w-full flex items-center justify-center text-white">
            <div className="text-center">
              <p className="text-2xl">Unknown content type: {currentItem?.type}</p>
              <p className="text-gray-400 mt-2">URL: {currentItem?.url}</p>
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        {showControls && (
          <>
            {/* Logo */}
            <div className="absolute top-6 left-6">
              <TapeLogo width={80} />
            </div>

            {/* Controls */}
            <div className="absolute top-6 right-6 flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Sun className="w-5 h-5 text-white" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-24"
                />
              </div>

              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-white" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-24"
                />
              </div>

              <button
                onClick={() => setViewState('connected')}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Exit to menu"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // No content state
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Monitor className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p className="text-2xl font-bold text-gray-700">Device Connected</p>
        <p className="text-gray-500 mb-6">No content assigned</p>
        <Button onClick={() => setViewState('connected')}>
          Back to Menu
        </Button>
      </div>
    </div>
  );
}
