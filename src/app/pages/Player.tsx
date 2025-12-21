import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { Loader2, Monitor, Globe } from "lucide-react";

export default function Player() {
  const [pin, setPin] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Register device and get PIN on mount
  useEffect(() => {
    registerDevice();
  }, []);

  // Poll for activation status
  useEffect(() => {
    if (!pin || activated) return;

    const interval = setInterval(checkActivationStatus, 5000);
    return () => clearInterval(interval);
  }, [pin, activated]);

  // Auto-advance content
  useEffect(() => {
    if (!activated || content.length === 0) return;

    const timeout = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % content.length);
    }, 10000); // 10 seconds per item

    return () => clearTimeout(timeout);
  }, [currentIndex, content, activated]);

  async function registerDevice() {
    try {
      // Get IP address
      let ipAddress = 'unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn('Could not detect IP');
      }

      // Register device
      const res = await apiFetch('/player/register', {
        method: 'POST',
        body: JSON.stringify({ ipAddress })
      });

      setPin(res.pin);
      setActivated(res.activated);
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

      if (res.activated) {
        setActivated(true);
        setContent(res.content || []);
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  // Show PIN screen if not activated
  if (!activated && pin) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <Monitor className="w-24 h-24 mx-auto mb-8 text-purple-400" />

          <h1 className="text-5xl font-bold mb-4">Device Registration</h1>
          <p className="text-xl text-slate-300 mb-12">
            Enter this PIN in the admin dashboard to activate
          </p>

          {/* PIN Display */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-16 py-12 rounded-3xl shadow-2xl mb-8">
            <p className="text-sm uppercase tracking-widest mb-4 text-white/80">
              PIN CODE
            </p>
            <p className="text-9xl font-mono font-black tracking-widest text-white">
              {pin}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6">
            <p className="text-slate-400 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              Waiting for activation...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show content if activated
  if (activated && content.length > 0) {
    const currentItem = content[currentIndex];

    return (
      <div className="h-screen w-full bg-black">
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
      </div>
    );
  }

  // Activated but no content
  return (
    <div className="h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <Monitor className="w-16 h-16 mx-auto mb-4 text-slate-600" />
        <p className="text-2xl font-bold">Device Connected</p>
        <p className="text-slate-500">No content assigned</p>
      </div>
    </div>
  );
}
