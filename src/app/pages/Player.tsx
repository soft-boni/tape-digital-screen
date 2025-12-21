import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { Loader2, Monitor, Settings as SettingsIcon, Play, RefreshCw, Sun, Volume2, Cast } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { Button } from "../components/ui/button";

type ViewState = 'not-connected' | 'connected' | 'playing' | 'settings';

export default function Player() {
  const [pin, setPin] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>('not-connected');
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deviceName, setDeviceName] = useState("Samsung 55' Smart Display");
  const [accountName, setAccountName] = useState("User");
  const [showControls, setShowControls] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(50);

  // Register device and get PIN on mount
  useEffect(() => {
    registerDevice();
  }, []);

  // Poll for activation status
  useEffect(() => {
    if (!pin || viewState !== 'not-connected') return;

    const interval = setInterval(checkActivationStatus, 5000);
    return () => clearInterval(interval);
  }, [pin, viewState]);

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
      let ipAddress = 'unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn('Could not detect IP');
      }

      const res = await apiFetch('/player/register', {
        method: 'POST',
        body: JSON.stringify({ ipAddress })
      });

      setPin(res.pin);
      if (res.activated) {
        setViewState('connected');
        setAccountName(res.accountName || 'User');
        setDeviceName(res.deviceName || "Samsung 55' Smart Display");
      }
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkActivationStatus() {
    if (!pin) return;

    try {
      const res = await apiFetch(`/player/status?pin=${pin}`);

      if (res.activated && viewState === 'not-connected') {
        setViewState('connected');
        setContent(res.content || []);
        setAccountName(res.accountName || 'User');
        setDeviceName(res.deviceName || "Samsung 55' Smart Display");
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  }

  async function syncContent() {
    if (!pin) return;

    try {
      const res = await apiFetch(`/player/status?pin=${pin}`);
      setContent(res.content || []);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Connection Screen (QR + PIN)
  if (viewState === 'not-connected' && pin) {
    const qrUrl = `https://tape-screen.vercel.app/connect?pin=${pin}`;

    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-4xl w-full">
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
              <div className="text-6xl font-bold text-center tracking-wider font-mono">
                {pin}
              </div>
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
          <div className="text-5xl font-bold text-blue-500 mb-8">tape</div>

          <p className="text-gray-700 mb-8">
            This device is connected to <span className="font-semibold">{accountName}'s</span> dashboard
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => {
                if (content.length > 0) setViewState('playing');
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
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
                  <p className="text-sm text-gray-600">LK,USA</p>
                </div>
              </div>
              <Button variant="destructive" size="sm" className="bg-red-500 hover:bg-red-600">
                Remove
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
  if (viewState === 'playing' && content.length > 0) {
    const currentItem = content[currentIndex];

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
          />
        ) : (
          <video
            src={currentItem?.url}
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
            onEnded={() => setCurrentIndex((prev) => (prev + 1) % content.length)}
          />
        )}

        {/* Controls Overlay */}
        {showControls && (
          <>
            {/* Logo */}
            <div className="absolute top-6 left-6 text-4xl font-bold text-white">
              tape
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
              >
                <Cast className="w-5 h-5 text-white" />
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
