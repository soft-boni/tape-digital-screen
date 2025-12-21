

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { Loader2, Monitor, Globe } from "lucide-react";

interface DeviceState {
  id: string;
  pin: string | null;
  status: "pending" | "online" | "offline";
  screenId: string | null;
  name: string;
}

interface PlaylistItem {
  contentId: string;
  duration: number;
}

interface ContentDetail {
  id: string;
  type: "image" | "video";
  readUrl: string;
}

export function Player() {
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [contentMap, setContentMap] = useState<Record<string, ContentDetail>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Polling Refs
  const pollInterval = useRef<any>(null);

  // Player Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackTimeout = useRef<any>(null);

  useEffect(() => {
    initDevice();
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (playbackTimeout.current) clearTimeout(playbackTimeout.current);
    };
  }, []);

  const initDevice = async () => {
    try {
      // Generate or retrieve device UUID (permanent identity)
      let deviceUUID = localStorage.getItem('device_uuid');
      if (!deviceUUID) {
        deviceUUID = crypto.randomUUID();
        localStorage.setItem('device_uuid', deviceUUID);
        console.log('New device UUID generated:', deviceUUID);
      } else {
        console.log('Existing device UUID found:', deviceUUID);
      }

      // Fetch client IP from frontend (more reliable than backend headers)
      let clientIP = 'unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        clientIP = ipData.ip;
        console.log('Client IP detected:', clientIP);
      } catch (e) {
        console.warn('Could not detect IP, using unknown');
      }

      // Send both UUID (primary) and IP (fallback) to backend
      const device = await apiFetch("/devices/register", {
        method: "POST",
        body: JSON.stringify({ deviceUUID, clientIP })
      });
      setDevice(device);

      console.log('Device initialized:', device.status, 'UUID:', deviceUUID, 'IP:', device.ipAddress);

      // Start polling for updates
      startPolling(device.id);
    } catch (e) {
      console.error("Device init failed", e);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (deviceId: string) => {
    pollInterval.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/devices/${deviceId}/status`);
        handleStatusUpdate(res);
      } catch (e) {
        console.error("Poll failed", e);
      }
    }, 10000); // Poll every 10s
  };

  const handleStatusUpdate = (res: any) => {
    setDevice(res.device);

    // Check if playlist changed
    if (res.screen) {
      // For simplicity, we just update playlist if we have a screen
      // In a real app, we'd diff it to avoid restarting playback
      const newPlaylist = res.screen.content || [];

      // Fetch content details if needed
      // Optimisation: only fetch if we don't have them
      // For prototype, we fetch all content periodically or we could rely on the backend returning populated content
      // My backend returns screen object with raw content array.
      // I need to fetch actual content details.
      // Let's fetch all content map if we haven't.
      fetchContentDetails(newPlaylist);

      // Simple playlist update logic: if length changed, update.
      setPlaylist(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newPlaylist)) {
          console.log("Playlist updated", newPlaylist);
          return newPlaylist;
        }
        return prev;
      });
    } else {
      setPlaylist([]);
    }
  };

  const fetchContentDetails = async (playlist: PlaylistItem[]) => {
    // Optimisation: check if we have all keys
    // Actually, simplest is to fetch all content once or on change.
    // My backend has /content list.
    const allContent = await apiFetch("/content");
    const map: Record<string, ContentDetail> = {};
    allContent.forEach((c: any) => map[c.id] = c);
    setContentMap(map);
  };

  // Playback Logic
  useEffect(() => {
    if (!playlist.length || !device || device.status === "pending") return;

    const playNext = () => {
      if (playbackTimeout.current) clearTimeout(playbackTimeout.current);

      const item = playlist[currentIndex];
      const detail = contentMap[item.contentId];

      if (!detail) {
        // Skip invalid content
        setCurrentIndex((prev) => (prev + 1) % playlist.length);
        return;
      }

      if (detail.type === "image") {
        playbackTimeout.current = setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % playlist.length);
        }, item.duration * 1000);
      } else {
        // Video handling is done via onEnded prop
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(e => console.error("Autoplay failed", e));
        }
      }
    };

    playNext();

    return () => {
      if (playbackTimeout.current) clearTimeout(playbackTimeout.current);
    };
  }, [currentIndex, playlist, contentMap, device?.status]);


  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-black text-white"><Loader2 className="animate-spin w-10 h-10" /></div>;
  }

  // Pending State (PIN)
  if (device?.status === "pending") {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-center space-y-8 p-4">
        <div className="text-center space-y-4">
          <Monitor className="w-24 h-24 mx-auto text-indigo-400 drop-shadow-lg" />
          <h1 className="text-5xl font-light tracking-tight">Register this Device</h1>
          <p className="text-slate-300 text-xl max-w-md mx-auto">
            Go to Admin Dashboard → Devices → Add Device
          </p>
        </div>

        {/* PIN Display */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 px-16 py-12 rounded-3xl shadow-2xl border border-white/10">
          <p className="text-sm uppercase tracking-widest text-center mb-4 font-bold text-white/90">
            Device PIN
          </p>
          <p className="text-9xl font-mono font-black tracking-widest text-white drop-shadow-2xl">
            {device.pin}
          </p>
          <p className="text-center mt-6 text-white/90 text-lg">
            Enter this code in the admin dashboard
          </p>
        </div>

        {/* Device Info */}
        <div className="mt-8 text-center space-y-3 bg-slate-800/50 px-8 py-6 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-sm uppercase tracking-wide font-semibold">Device Information</p>
          <div className="space-y-2 text-slate-300">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <p className="text-slate-400">IP: <span className="font-mono">{device.ipAddress || 'Unknown'}</span></p>
            </div>
            <p className="flex items-center justify-center gap-2">
              <span className="text-slate-500">Device:</span>
              <span className="font-medium">{device.name}</span>
            </p>
          </div>
        </div>

        <p className="text-slate-500 animate-pulse mt-8 flex items-center gap-2">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
          Waiting for connection...
        </p>
      </div>
    );
  }

  // Online but no content
  if (playlist.length === 0) {
    return (
      <div className="h-screen w-full bg-black text-white flex flex-col items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Monitor className="w-12 h-12 text-slate-500" />
          <p className="text-xl font-light text-slate-400">Device Connected: {device?.name}</p>
          <p className="text-2xl font-bold">No Content Scheduled</p>
        </div>
      </div>
    );
  }

  // Playback
  const currentItem = playlist[currentIndex];
  const currentDetail = contentMap[currentItem?.contentId];

  if (!currentDetail) return <div className="h-screen bg-black" />;

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative">
      {currentDetail.type === "image" ? (
        <img
          key={currentDetail.id} // Key forces re-render for animation if needed
          src={currentDetail.readUrl}
          className="w-full h-full object-contain animate-fade-in"
        />
      ) : (
        <video
          ref={videoRef}
          src={currentDetail.readUrl}
          className="w-full h-full object-contain"
          muted // Muted needed for autoplay usually, or user interaction
          playsInline
          autoPlay
          onEnded={() => setCurrentIndex((prev) => (prev + 1) % playlist.length)}
        />
      )}

      {/* Debug Info Overlay (Hidden in prod usually) */}
      {/* <div className="absolute top-0 left-0 bg-black/50 text-white text-xs p-2">
            Playing: {currentDetail.name} ({currentItem.duration}s)
        </div> */}
    </div>
  );
}
