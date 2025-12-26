import { useEffect, useState, useRef } from "react";
import { Loader2, Monitor, Play, Pause, RefreshCw, Volume2, Music, X, Settings, ArrowLeft } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { Button } from "@/shared/components/ui/button";
import { TapeLogo } from "@/shared/components/TapeLogo";
import { cn } from "@/shared/components/ui/utils";

type ViewState = 'unregistered' | 'not-connected' | 'connected' | 'playing' | 'settings';

export function Player() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>('unregistered');
  const [loading, setLoading] = useState(true);

  // Player Data
  const [content, setContent] = useState<any[]>([]);
  const [globalTransition, setGlobalTransition] = useState<string>("fade");
  const [transitionDuration, setTransitionDuration] = useState<number>(500);
  const [backgroundMusic, setBackgroundMusic] = useState<string | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevIndexRef = useRef<number>(0);

  // Update prevIndexRef whenever currentIndex changes
  useEffect(() => {
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Device Info
  const [deviceName, setDeviceName] = useState("Samsung 55' Smart Display");
  const [accountName, setAccountName] = useState("User");
  const [accountAvatar, setAccountAvatar] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(50);

  // --- Initialization & Polling ---

  useEffect(() => {
    const storedDeviceId = localStorage.getItem('deviceId');
    const storedPin = localStorage.getItem('devicePin');

    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
      if (storedPin) setPin(storedPin);
      setViewState('not-connected');
      setLoading(true); // Ensure loading is true while checking
      checkActivationStatus(storedDeviceId);
    } else {
      setViewState('unregistered');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!deviceId || viewState === 'playing') return;
    const interval = setInterval(() => checkActivationStatus(deviceId), 5000);
    return () => clearInterval(interval);
  }, [deviceId, viewState]);

  // --- Real Player Engine (Loop) ---

  const totalDuration = content.reduce((acc: number, item: any) => acc + (item.duration * 1000), 0) || 0;

  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;
      setGlobalTime((prevTime) => {
        let newTime = prevTime + deltaTime;
        if (newTime >= totalDuration) {
          newTime = newTime % totalDuration;
        }
        return newTime;
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying && totalDuration > 0) {
      requestRef.current = requestAnimationFrame(animate);
      if (audioRef.current) audioRef.current.play().catch(e => console.warn("Autoplay blocked", e));
    } else {
      lastTimeRef.current = undefined;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioRef.current) audioRef.current.pause();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, totalDuration, backgroundMusic]);

  // Sync Current Index
  useEffect(() => {
    let accumulatedTime = 0;
    let foundIndex = 0;

    for (let i = 0; i < content.length; i++) {
      const itemDuration = content[i].duration * 1000;
      if (globalTime >= accumulatedTime && globalTime < accumulatedTime + itemDuration) {
        foundIndex = i;
        break;
      }
      accumulatedTime += itemDuration;
    }
    setCurrentIndex(foundIndex);
  }, [globalTime, content]);

  // Audio Volume Sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: any;
    const resetControls = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (viewState === 'playing') {
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };
    window.addEventListener('mousemove', resetControls);
    window.addEventListener('click', resetControls);
    return () => {
      window.removeEventListener('mousemove', resetControls);
      window.removeEventListener('click', resetControls);
      clearTimeout(timeout);
    }
  }, [viewState]);


  // --- API Functions ---

  async function registerDevice() {
    try {
      setLoading(true);
      // ... (IP detection logic derived from previous implementation)
      let ipAddress = 'unknown';
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        ipAddress = (await res.json()).ip;
      } catch (e) { }

      const { projectId, publicAnonKey } = await import('@/shared/utils/supabase/info');
      const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-31bfbcca`;

      const response = await fetch(`${BASE_URL}/player/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ ipAddress })
      });

      if (!response.ok) throw new Error("Registration failed");
      const res = await response.json();

      localStorage.setItem('deviceId', res.deviceId);
      localStorage.setItem('devicePin', res.pin);
      setDeviceId(res.deviceId);
      setPin(res.pin);
      setViewState('not-connected');
      setLoading(false);
    } catch (error: any) {
      console.error(error);
      setRegistrationError(error.message);
      setLoading(false);
    }
  }

  async function checkActivationStatus(devId: string) {
    try {
      const { projectId, publicAnonKey } = await import('@/shared/utils/supabase/info');
      const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-31bfbcca`;

      const response = await fetch(`${BASE_URL}/player/status?deviceId=${devId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (!response.ok) return; // Silent fail on polling
      const res = await response.json();

      if (res.deleted) {
        localStorage.clear();
        window.location.reload();
        return;
      }

      if (res.activated) {
        setAccountName(res.accountName);
        setAccountAvatar(res.accountAvatar);
        setDeviceName(res.deviceName);

        // Updates content and settings
        if (res.content) setContent(res.content);
        if (res.backgroundMusic) setBackgroundMusic(res.backgroundMusic);
        if (res.transition) setGlobalTransition(res.transition);
        if (res.transitionDuration) setTransitionDuration(res.transitionDuration);

        // Only switch view if not already playing or manually stopped
        setViewState('connected');
        localStorage.removeItem('devicePin');
        setPin(null);
      }
      setLoading(false);
    } catch (error) {
      console.error("Status check error", error);
      // Fallback if check fails (e.g. offline) - show last known state or connection screen
      if (viewState === 'unregistered' || viewState === 'not-connected') {
        setViewState('not-connected');
        setLoading(false);
      }
    }
  }

  const handlePlay = () => {
    if (content.length === 0) {
      alert("No content assigned to this screen.");
      return;
    }
    setViewState('playing');
    setIsPlaying(true);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  // --- Render ---

  if (viewState === 'unregistered') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="mb-6 flex justify-center"><TapeLogo width={120} /></div>
          <h1 className="text-2xl font-bold mb-4">New Device</h1>
          <Button onClick={registerDevice} disabled={loading} size="lg">
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Monitor className="mr-2" />}
            Register Device
          </Button>
          {registrationError && <p className="text-red-500 mt-4">{registrationError}</p>}
        </div>
      </div>
    );
  }

  if (viewState === 'not-connected') {
    if (loading) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">Connecting to server...</h2>
        </div>
      );
    }

    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-4xl w-full bg-white rounded-xl shadow-sm p-12 flex gap-12">
          <div className="flex-1 border-r pr-12 flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-6">Scan to Connect</h2>
            <div className="p-4 bg-white border-2 rounded-lg">
              <QRCodeSVG value={`https://tape-screen.vercel.app/connect?pin=${pin}`} size={200} />
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-xl font-bold mb-4">Or Enter PIN</h2>
            <div className="text-6xl font-mono font-bold text-blue-600 tracking-wider bg-blue-50 p-6 rounded-lg text-center mb-4">
              {pin || "..."}
            </div>
            <p className="text-gray-500 text-center">Add this ID in your dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'settings') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full relative">
          <Button variant="ghost" size="icon" className="absolute left-4 top-4" onClick={() => setViewState('connected')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center mb-8 mt-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-gray-600" />
            </div>
            <h1 className="text-xl font-bold">Player Settings</h1>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-xs text-gray-400 uppercase font-bold mb-1">Device Name</p>
              <p className="font-medium">{deviceName}</p>
            </div>

            <Button variant="destructive" className="w-full" onClick={() => {
              if (confirm("Unregister this device? You will need to re-register carefully.")) {
                localStorage.clear();
                window.location.reload();
              }
            }}>
              Unregister Device
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'connected') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-12 rounded-2xl shadow-sm text-center max-w-md w-full">
          <div className="flex justify-center mb-6"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center"><Monitor className="w-10 h-10 text-green-600" /></div></div>
          <h1 className="text-2xl font-bold mb-2">Ready to Play</h1>
          <p className="text-gray-500 mb-8">Connected to {accountName}'s Dashboard</p>

          <div className="space-y-3">
            <Button onClick={handlePlay} size="lg" className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700">
              <Play className="w-5 h-5 mr-2" /> Start Playback
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => checkActivationStatus(deviceId!)} variant="outline" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" /> Sync
              </Button>
              <Button onClick={() => setViewState('settings')} variant="outline" className="w-full">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <p className="font-semibold text-gray-600">{deviceName}</p>
              <span>•</span>
              <p>{Math.round(totalDuration / 1000 / 60)} min loop</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Playing View ---
  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Content Renderer */}
      {content.map((item: any, idx: number) => {
        const isActive = idx === currentIndex;
        // Check if this item was the previous one (exiting)
        // CRITICAL: Ensure an item is not both active and exiting at the same time
        const isExiting = idx === (prevIndexRef.current ?? -1) && idx !== currentIndex;

        let style: React.CSSProperties = {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          opacity: isActive || isExiting ? 1 : 0, // Keep exiting item visible
          zIndex: isActive ? 10 : (isExiting ? 5 : 0),
          pointerEvents: 'none',
          // Only transition active and exiting items to avoiding "flying" artifacts for others
          transition: (isActive || isExiting) ? `all ${transitionDuration}ms ease-in-out` : 'none',
        };

        if (globalTransition === 'slide-left') {
          // Slide Left: Enter from Right (100%), Leave to Left (-100%)
          let translateX = '100%'; // Default: Staged on Right
          if (isActive) translateX = '0%';
          if (isExiting) translateX = '-100%';

          style = {
            ...style,
            transform: `translateX(${translateX})`,
          }
        } else if (globalTransition === 'slide-right') {
          // Slide Right: Enter from Left (-100%), Leave to Right (100%)
          let translateX = '-100%'; // Default: Staged on Left
          if (isActive) translateX = '0%';
          if (isExiting) translateX = '100%';

          style = {
            ...style,
            transform: `translateX(${translateX})`,
          }
        } else if (globalTransition === 'zoom') {
          style = {
            ...style,
            transform: isActive ? 'scale(1)' : 'scale(1.1)',
            opacity: isActive ? 1 : 0 // Zoom usually fades
          }
        } else {
          // Default Fade
          style = { ...style, transition: `opacity ${transitionDuration}ms ease-in-out`, opacity: isActive ? 1 : 0 }
        }

        return item.type === 'video' ? (
          <PlayerVideo
            key={`${item.id}-${idx}`}
            item={item}
            isActive={isActive}
            style={style}
            isMuted={true}
          />
        ) : (
          <img
            key={`${item.id}-${idx}`}
            src={item.readUrl || item.url} // Handle both formats
            style={style}
          />
        );
      })}

      {/* Floating Control Bar */}
      <div className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 text-white rounded-full px-6 py-3 flex items-center gap-6 transition-all duration-300 z-50",
        showControls ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      )}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white rounded-full hover:bg-white/10" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>

          <div className="h-8 w-px bg-white/20" />

          <div className="flex flex-col">
            <span className="text-[10px] text-white/50 uppercase tracking-wider font-bold">Timeline</span>
            <span className="font-mono text-sm">{formatTime(globalTime)} / {formatTime(totalDuration)}</span>
          </div>
        </div>

        {backgroundMusic && (
          <>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-3">
              <div className={cn("p-1.5 rounded-full", isPlaying ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40")}>
                <Music className={cn("w-4 h-4", isPlaying && "animate-pulse")} />
              </div>
              <div className="max-w-[100px] truncate hidden md:block">
                <p className="text-xs font-medium">Background Music</p>
                <p className="text-[10px] text-white/50">Active</p>
              </div>
            </div>
          </>
        )}

        <div className="h-8 w-px bg-white/20" />

        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setViewState('connected')}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Audio Element */}
      {backgroundMusic && <audio ref={audioRef} src={backgroundMusic} loop />}

      {/* Progress Bar (Top) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <div className="h-full bg-blue-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(59,130,246,0.8)]"
          style={{ width: `${(globalTime / totalDuration) * 100}%` }}
        />
      </div>
    </div>
  );
}

// Helper Component for Video Reliability
function PlayerVideo({ item, isActive, style, isMuted }: { item: any, isActive: boolean, style: any, isMuted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Auto-play prevented:", error);
        });
      }
    } else if (!isActive && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isActive]);

  return (
    <video
      ref={videoRef}
      src={item.readUrl || item.url}
      style={style}
      muted={isMuted}
      playsInline
      className="object-contain w-full h-full"
    />
  );
}
