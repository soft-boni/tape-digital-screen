
import { useEffect, useState, useRef, useCallback } from "react";
// import { useParams } from "react-router-dom"; // Removed duplicate
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { apiFetch } from "@/shared/utils/api";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Play, Pause, SkipBack, SkipForward, Plus, Trash2, GripVertical, Save, Monitor, X, Clock, Volume2, Music, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/shared/components/ui/utils";

// --- Draggable Item Component ---
const DraggableItem = ({ item, index, moveItem, removeItem, updateDuration, updateVolume, contentDetails }: any) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: "CONTENT",
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: "CONTENT",
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  // Attach drop and preview to the main container
  preview(drop(ref));

  const details = contentDetails.find((c: any) => c.id === item.contentId);
  if (!details) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 p-3 bg-white border rounded-lg mb-2 shadow-sm transition-all hover:shadow-md",
        isDragging ? "opacity-50 scale-95" : "opacity-100"
      )}
    >
      <div ref={(node) => { drag(node) }} className="cursor-move text-slate-400 hover:text-slate-600 p-1">
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Thumbnail */}
      <div className="relative w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border">
        {details.type === "image" ? (
          <img src={details.readUrl} className="w-full h-full object-cover" />
        ) : (
          <video src={details.readUrl} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate text-center">
          {index + 1}
        </div>
      </div>

      {/* Info & Duration */}
      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" title={details.name}>{details.name}</p>
          <p className="text-xs text-muted-foreground uppercase">{details.type}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Duration */}
          <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded border">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <Input
              type="number"
              className="w-12 h-6 text-center p-0 text-sm border-0 bg-transparent focus-visible:ring-0"
              value={item.duration}
              onChange={(e) => updateDuration(index, parseInt(e.target.value) || 5)}
              min={1}
            />
            <span className="text-xs text-muted-foreground">s</span>
          </div>

          {/* Volume (Video Only) */}
          {details.type === 'video' && (
            <div className="flex items-center gap-2 flex-1 min-w-[80px]">
              <Volume2 className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={item.volume ?? 100}
                onChange={(e) => updateVolume(index, parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
              />
            </div>
          )}
        </div>
      </div>

      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeItem(index)}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
};


// --- Global Preview Player Component ---
const PreviewPlayer = ({ playlist, contentDetails, backgroundMusic, globalTransition, transitionDuration = 500 }: any) => {
  const [globalTime, setGlobalTime] = useState(0); // in milliseconds
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef<number>(0);

  // Update prevIndexRef
  useEffect(() => {
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Calculate total playlist duration
  const totalDuration = playlist.reduce((acc: number, item: any) => acc + (item.duration * 1000), 0) || 0;

  // Sync Audio Playback
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && totalDuration > 0) {
        audioRef.current.play().catch(() => { });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, totalDuration, backgroundMusic]);

  // Main Animation Loop
  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;
      setGlobalTime((prevTime) => {
        let newTime = prevTime + deltaTime;
        if (newTime >= totalDuration) {
          newTime = newTime % totalDuration; // Loop
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
    } else {
      lastTimeRef.current = undefined;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Determine Current Item based on Global Time
  useEffect(() => {
    let accumulatedTime = 0;
    let foundIndex = 0;

    for (let i = 0; i < playlist.length; i++) {
      const itemDuration = playlist[i].duration * 1000;
      if (globalTime >= accumulatedTime && globalTime < accumulatedTime + itemDuration) {
        foundIndex = i;
        break;
      }
      accumulatedTime += itemDuration;
    }
    setCurrentIndex(foundIndex);
  }, [globalTime, playlist]);

  // Handle Play/Pause
  const togglePlay = () => setIsPlaying(!isPlaying);

  // Reset if playlist empty
  useEffect(() => {
    if (playlist.length === 0) {
      setIsPlaying(false);
      setGlobalTime(0);
    }
  }, [playlist.length]);

  if (!playlist.length) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg flex flex-col items-center justify-center text-slate-500 border border-slate-800 shadow-inner">
        <Monitor className="w-12 h-12 mb-2 opacity-20" />
        <p>No content to play</p>
      </div>
    );
  }

  const currentItem = playlist[currentIndex];
  const nextIndex = (currentIndex + 1) % playlist.length;
  const nextItem = playlist[nextIndex];

  const currentDetails = contentDetails.find((c: any) => c.id === currentItem.contentId);
  const nextDetails = contentDetails.find((c: any) => c.id === nextItem.contentId);

  // format time mm:ss
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  // Transition Logic
  // We need to determine if we are in the "transition window" (end of current item)
  // But strictly, with CSS transitions, we just render the Current Item. 
  // Custom transition logic requires rendering BOTH Current and Next during the transition period?
  // User requested "Slide Left-Right".
  // A simple approach for "Global Transition" is using a key-based animation engine (like Framer Motion or simple CSS keyframes).
  // Here, we'll use a CSS-based approach triggered by `currentIndex` change.

  return (
    <div className="space-y-4">
      {/* Screen Container */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-slate-800 group">

        {/* Render ALL items but control visibility/position based on CurrentIndex */}
        {/* This allows absolute positioning for transitions */}
        {/* Render ALL items but control visibility/position based on CurrentIndex */}
        {/* Key changes on transition to force re-render if needed */}
        <div key={globalTransition} className="relative w-full h-full overflow-hidden">
          {/* 
                Simplified Global Transition Implementation:
                We render the current item. When index changes, we animate.
                Actually, simpler: Just render current item with a key.
             */}
          {contentDetails.length > 0 && playlist.map((item: any, idx: number) => {
            const details = contentDetails.find((c: any) => c.id === item.contentId);
            if (!details) return null;

            const isActive = idx === currentIndex;
            // CRITICAL: Ensure an item is not both active and exiting at the same time
            const isExiting = idx === (prevIndexRef.current ?? -1) && idx !== currentIndex;

            // Basic styles
            let style: React.CSSProperties = {
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: isActive || isExiting ? 1 : 0,
              zIndex: isActive ? 10 : (isExiting ? 5 : 0),
              pointerEvents: 'none',
              transition: (isActive || isExiting) ? `all ${transitionDuration}ms ease-in-out` : 'none',
            };

            if (globalTransition === 'slide-left') {
              let translateX = '100%';
              if (isActive) translateX = '0%';
              if (isExiting) translateX = '-100%';
              style = { ...style, transform: `translateX(${translateX})` };
            } else if (globalTransition === 'slide-right') {
              let translateX = '-100%';
              if (isActive) translateX = '0%';
              if (isExiting) translateX = '100%';
              style = { ...style, transform: `translateX(${translateX})` };
            } else if (globalTransition === 'zoom') {
              style = { ...style, transform: isActive ? 'scale(1)' : 'scale(1.1)', opacity: isActive ? 1 : 0 };
            } else {
              style = { ...style, transition: `opacity ${transitionDuration}ms ease-in-out`, opacity: isActive ? 1 : 0 };
            }

            return details.type === 'image' ? (
              <img key={`${item.id}-${idx}`} src={details.readUrl} style={style} />
            ) : (
              <PreviewVideo
                key={`${item.id}-${idx}`}
                src={details.readUrl}
                style={style}
                isActive={isActive}
                isPlaying={isPlaying}
              />
            );
          })}
        </div>

        {/* Global Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
          <div
            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-75 ease-linear"
            style={{ width: `${(globalTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* Overlay Controls (Hover) */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity">
            <Button onClick={togglePlay} size="icon" className="h-16 w-16 rounded-full bg-white/90 text-black hover:bg-white hover:scale-105 transition-all">
              <Play className="w-8 h-8 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white rounded-lg shadow-lg border border-slate-800">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => setCurrentIndex((currentIndex - 1 + playlist.length) % playlist.length)}>
            <SkipBack className="w-5 h-5" />
          </Button>

          <Button variant="ghost" size="icon" className={cn("rounded-full", isPlaying ? "text-blue-400 bg-blue-500/10" : "text-white")} onClick={togglePlay}>
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>

          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => setCurrentIndex((currentIndex + 1) % playlist.length)}>
            <SkipForward className="w-5 h-5" />
          </Button>

          <div className="h-8 w-px bg-slate-700 mx-2" />

          <div className="flex flex-col">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Time</span>
            <span className="font-mono text-sm leading-none">{formatTime(globalTime)} <span className="text-slate-500">/ {formatTime(totalDuration)}</span></span>
          </div>
        </div>

        {/* Right Side: Music Indicator */}
        {backgroundMusic && (
          <div className="flex items-center gap-3 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            <Music className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <div className="flex flex-col hidden md:flex">
              <span className="text-[10px] text-slate-400 leading-none">Music Active</span>
              {/* We might not know the name here unless we pass it */}
            </div>
            {/* Hidden Audio Element */}
            <audio ref={audioRef} src={backgroundMusic} loop />
          </div>
        )}
      </div>
    </div>
  );
};


// --- Audio Picker Component ---
// --- Audio Picker Component ---
const AudioPicker = ({ open, onOpenChange, onSelect, allContent }: any) => {
  // Strict filter for audio type only as requested
  const audioContent = allContent.filter((c: any) => c.type === 'audio');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Background Music</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-[300px] p-2">
          {audioContent.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Music className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No audio content found.</p>
              <p className="text-xs">Upload .mp3 files in the Content Library first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {audioContent.map((c: any) => (
                <div key={c.id}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSelect(c)}
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded flex items-center justify-center text-indigo-600">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{c.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{c.type}</span>
                      {c.size && <span>• {Math.round(c.size / 1024 / 1024 * 100) / 100} MB</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost"><Plus className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


// --- Main Editor Component ---
import { useNavigate, useParams } from "react-router-dom";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Checkbox } from "@/shared/components/ui/checkbox";
// ... imports

// Skeleton Component
const ProgramEditorSkeleton = () => (
  <div className="h-auto lg:h-[calc(100vh-100px)] flex flex-col gap-4">
    {/* Header Skeleton */}
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b gap-4 md:gap-0">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-2 w-full md:w-auto">
        <Skeleton className="h-10 w-full md:w-32" />
      </div>
    </div>

    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
      {/* Left Column Skeleton */}
      <div className="w-full lg:w-1/2 order-2 lg:order-1 flex flex-col gap-4">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Right Column Skeleton (Preview) */}
      <div className="w-full lg:w-1/2 order-1 lg:order-2">
        <Skeleton className="w-full aspect-video rounded-xl mb-4" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  </div>
);

// ... inside ScreenEditor component
export function ScreenEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  // ... other states
  const [allContent, setAllContent] = useState<any[]>([]);
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);

  const [deviceMode, setDeviceMode] = useState<"existing" | "new">("existing");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDevicePin, setNewDevicePin] = useState("");

  // Global Settings State
  const [backgroundMusic, setBackgroundMusic] = useState<string | null>(null);
  const [backgroundMusicName, setBackgroundMusicName] = useState<string | null>(null);
  const [globalTransition, setGlobalTransition] = useState<string>("fade");
  const [transitionDuration, setTransitionDuration] = useState<number>(500);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [sData, cData, dData] = await Promise.all([
        apiFetch(`/programs/${id}`),
        apiFetch("/content"),
        apiFetch("/devices"),
      ]);
      setScreen(sData);
      setAllContent(cData);
      setAllDevices(dData);
      setPlaylist(sData.content || []);

      if (sData.backgroundMusic || sData.background_music) {
        setBackgroundMusic(sData.backgroundMusic || sData.background_music);
        setBackgroundMusicName(sData.backgroundMusicName || sData.background_music_name || 'Background Music');
      }

      // Load Transition Settings
      if (sData.transition) setGlobalTransition(sData.transition);
      if (sData.transitionDuration) setTransitionDuration(sData.transitionDuration);

      const assigned = dData.filter((d: any) => d.screenId === id);
      setAssignedDevices(assigned);
    } catch (error) {
      toast.error("Failed to load screen");
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updatedScreen = {
        ...screen,
        content: playlist,
        backgroundMusic,
        backgroundMusicName,
        background_music: backgroundMusic,
        transition: globalTransition,
        transitionDuration,
      };

      await apiFetch(`/programs/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedScreen),
      });
      setScreen(updatedScreen);
      toast.success("Changes saved!");
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScreen = async () => {
    if (!screen) return;
    if (!confirm(`Delete "${screen.name}"?`)) return;

    try {
      await apiFetch(`/programs/${screen.id}`, { method: "DELETE" });
      toast.success("Program deleted");
      navigate("/programs");
    } catch (error) {
      toast.error("Failed to delete screen");
    }
  };

  // Playlist Management
  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    setPlaylist((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const updateDuration = (index: number, duration: number) => {
    setPlaylist(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], duration };
      return updated;
    });
  };

  const updateVolume = (index: number, volume: number) => {
    setPlaylist(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], volume };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index));
  };

  const addContentToPlaylist = (contentId: string) => {
    setPlaylist(prev => [
      ...prev,
      {
        contentId,
        duration: 10,
        volume: 100
        // No per-item transition anymore
      }
    ]);
    toast.success("Added to timeline");
  };

  // Music Selection
  const handleMusicSelect = (content: any) => {
    setBackgroundMusic(content.readUrl);
    setBackgroundMusicName(content.name);
    setIsMusicPickerOpen(false);
    toast.success(`Selected "${content.name}"`);
  };

  // Device Management (Existing Logic Kept)
  const assignExistingDevice = async (deviceId: string) => {
    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({ screenId: id }),
      });
      toast.success("Device assigned");
      loadData();
      setIsAddDeviceOpen(false);
    } catch (error) {
      toast.error("Failed to assign device");
    }
  };

  const createNewDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newDevice = await apiFetch("/devices/claim", {
        method: "POST",
        body: JSON.stringify({ pin: newDevicePin, name: newDeviceName }),
      });

      if (newDevice && newDevice.id) {
        await apiFetch(`/devices/${newDevice.id}`, {
          method: "PUT",
          body: JSON.stringify({ screenId: id }),
        });
        toast.success("Device created and assigned");
        setNewDeviceName("");
        setNewDevicePin("");
        loadData();
        setIsAddDeviceOpen(false);
      } else {
        throw new Error("Failed to claim device");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create device");
    }
  };

  // ... (removeDeviceFromScreen kept as is)

  // ... (inside Dialog content)
  <Input
    id="devicePin"
    value={newDevicePin}
    onChange={(e) => setNewDevicePin(e.target.value.toUpperCase())}
    placeholder="ABCD-1234"
    maxLength={9}
    className="text-center text-2xl tracking-widest uppercase"
    required
  />

  const removeDeviceFromScreen = async (deviceId: string) => {
    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({ screenId: null }),
      });
      toast.success("Device removed");
      loadData();
    } catch (error) {
      toast.error("Failed to remove device");
    }
  };

  if (loading) {
    return <ProgramEditorSkeleton />;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-auto lg:h-[calc(100vh-100px)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10 p-2 gap-4 md:gap-0">
          <div className="w-full md:w-auto">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/programs")} className="-ml-2 mr-1 h-8 w-8 md:h-10 md:w-10">
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </Button>
              <Monitor className="w-5 h-5 md:w-6 h-6 text-blue-600 flex-shrink-0" />
              <span className="truncate">{screen.name}</span>
            </h1>
            <p className="text-xs text-muted-foreground ml-9 md:ml-12 truncate max-w-[200px] md:max-w-none">ID: {screen.id}</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={saveChanges} disabled={saving} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto min-w-[140px]">
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

          {/* Left: Editor & Settings */}
          {/* Order 2 on mobile (bottom), Order 1 on desktop (left) */}
          <Card className="flex flex-col border-0 shadow-none bg-transparent w-full lg:w-1/2 order-2 lg:order-1 h-auto lg:h-full lg:min-h-0">
            <Tabs defaultValue="timeline" className="flex-col min-h-0 lg:flex-1 lg:flex h-auto">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-50 z-10 py-2">
                <TabsList className="bg-slate-100 border rounded-full p-1">
                  <TabsTrigger
                    value="timeline"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
                  >
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
                  >
                    Settings
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Dialog open={isAddContentOpen} onOpenChange={(open: boolean) => {
                    setIsAddContentOpen(open);
                    if (!open) setSelectedContentIds([]); // Clear selection on close
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="border-dashed border-slate-300">
                        <Plus className="w-4 h-4 mr-2" /> Content
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
                      <DialogHeader className="p-4 border-b">
                        <DialogTitle>Add Content to Timeline</DialogTitle>
                      </DialogHeader>

                      <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-slate-50/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {allContent.map(c => {
                            const isSelected = selectedContentIds.includes(c.id);
                            return (
                              <div key={c.id}
                                className={cn(
                                  "group relative aspect-square bg-white rounded-xl overflow-hidden cursor-pointer border-2 transition-all shadow-sm",
                                  isSelected ? "border-blue-600 ring-2 ring-blue-100" : "border-transparent hover:border-blue-300"
                                )}
                                onClick={() => setPreviewContent(c)}
                              >
                                {c.type === "image" ? (
                                  <img src={c.readUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <video src={c.readUrl} className="w-full h-full object-cover" />
                                )}

                                <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked: boolean) => {
                                      if (checked) {
                                        setSelectedContentIds(prev => [...prev, c.id]);
                                      } else {
                                        setSelectedContentIds(prev => prev.filter(id => id !== c.id));
                                      }
                                    }}
                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-white/80 bg-black/20"
                                  />
                                </div>

                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />

                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 pointer-events-none">
                                  <p className="text-white text-[11px] font-medium truncate leading-tight">{c.name}</p>
                                  <p className="text-white/70 text-[10px] uppercase tracking-wider mt-0.5">{c.type}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-4 border-t bg-white flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {selectedContentIds.length} item{selectedContentIds.length !== 1 && 's'} selected
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setIsAddContentOpen(false)}>Cancel</Button>
                          <Button
                            onClick={() => {
                              selectedContentIds.forEach(id => addContentToPlaylist(id));
                              setIsAddContentOpen(false);
                              setSelectedContentIds([]);
                            }}
                            disabled={selectedContentIds.length === 0}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Add to Timeline
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Content Preview Dialog */}
                <Dialog open={!!previewContent} onOpenChange={(open) => !open && setPreviewContent(null)}>
                  <DialogContent className="max-w-3xl bg-black border-slate-800 p-0 overflow-hidden">
                    <DialogHeader className="sr-only"><DialogTitle>Preview</DialogTitle></DialogHeader>
                    <div className="relative flex items-center justify-center bg-black aspect-video">
                      {previewContent?.type === "image" ? (
                        <img src={previewContent.readUrl} className="max-w-full max-h-[80vh] object-contain" />
                      ) : (
                        <video src={previewContent?.readUrl} controls autoPlay className="max-w-full max-h-[80vh]" />
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2 text-white/50 hover:text-white hover:bg-white/10"
                        onClick={() => setPreviewContent(null)}
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-white">
                      <div>
                        <p className="font-medium">{previewContent?.name}</p>
                        <p className="text-sm text-slate-400 capitalize">{previewContent?.type}</p>
                      </div>
                      <Button onClick={() => {
                        if (previewContent) {
                          addContentToPlaylist(previewContent.id);
                          setPreviewContent(null);
                          setIsAddContentOpen(false); // Optional: close main too? Let's keep main open or close it? User didn't specify. Standard is add and close or stay. "Add to Timeline" implies done. But separate preview add... let's just add and close preview, keep main open.
                          // Actually let's just Add and Close Preview, keeping Main selection flow open.
                        }
                      }}>
                        Add this Item
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <TabsContent value="timeline" className="overflow-visible lg:overflow-y-auto lg:flex-1 lg:min-h-0 pr-2">
                <div className="space-y-2 pb-10">
                  {playlist.map((item, index) => (
                    <DraggableItem
                      key={`${item.contentId}-${index}`}
                      item={item}
                      index={index}
                      moveItem={moveItem}
                      removeItem={removeItem}
                      updateDuration={updateDuration}
                      updateVolume={updateVolume}
                      contentDetails={allContent}
                    />
                  ))}
                  {playlist.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed rounded-xl text-slate-400 bg-slate-50">
                      <Plus className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Timeline is empty</p>
                      <Button variant="link" onClick={() => setIsAddContentOpen(true)}>Add your first content</Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="overflow-visible lg:overflow-y-auto lg:flex-1 lg:min-h-0">
                <div className="space-y-6">

                  {/* Program Info */}
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3"><CardTitle className="text-base">General</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Program Name</Label>
                        <Input value={screen.name} onChange={(e) => setScreen({ ...screen, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input value={screen.description} onChange={(e) => setScreen({ ...screen, description: e.target.value })} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Global Transitions */}
                  <Card className="border-indigo-100 bg-indigo-50/30 shadow-sm">
                    <CardHeader className="pb-3"><CardTitle className="text-base text-indigo-900">Global Transition</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Effect</Label>
                          <Select value={globalTransition} onValueChange={setGlobalTransition}>
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fade">✨ Fade</SelectItem>
                              <SelectItem value="slide-left">⬅️ Slide Left</SelectItem>
                              <SelectItem value="slide-right">➡️ Slide Right</SelectItem>
                              <SelectItem value="zoom">🔍 Zoom</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (ms)</Label>
                          <div className="flex items-center gap-2">
                            <Input type="number" value={transitionDuration} onChange={(e) => setTransitionDuration(parseInt(e.target.value))} className="bg-white" step={100} min={100} max={5000} />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">milliseconds</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Background Music */}
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Background Music</CardTitle>
                      {backgroundMusic && (
                        <Button variant="ghost" size="sm" className="h-6 text-red-500" onClick={() => { setBackgroundMusic(null); setBackgroundMusicName(null); }}>
                          Clear
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {backgroundMusic ? (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <Music className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{backgroundMusicName}</p>
                            <p className="text-xs text-muted-foreground">Playing in loop</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => setIsMusicPickerOpen(true)}
                        >
                          <Music className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm font-medium text-slate-600">Select Music from Library</p>
                        </div>
                      )}
                      <AudioPicker
                        open={isMusicPickerOpen}
                        onOpenChange={setIsMusicPickerOpen}
                        allContent={allContent}
                        onSelect={handleMusicSelect}
                      />
                    </CardContent>
                  </Card>

                  {/* Devices */}
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Assigned Devices</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {assignedDevices.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium">{d.name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => removeDeviceFromScreen(d.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setIsAddDeviceOpen(true)}>
                        <Plus className="w-3 h-3 mr-2" /> Add Device
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="pt-4">
                    <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDeleteScreen}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Program
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Right: Live Preview */}
          {/* Order 1 on mobile (top), Order 2 on desktop (right) */}
          <div className="flex flex-col gap-4 w-full lg:w-1/2 order-1 lg:order-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Play className="w-4 h-4 text-green-600" /> Live Preview
              </h3>
              <span className="text-xs text-muted-foreground">Real-time simulation</span>
            </div>

            <PreviewPlayer
              playlist={playlist}
              contentDetails={allContent}
              backgroundMusic={backgroundMusic}
              globalTransition={globalTransition}
              transitionDuration={transitionDuration}
            />

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
              <p className="font-medium mb-1">Pro Tip</p>
              <p>The preview above shows exactly how your content will appear on the device, including transitions and timing.</p>
            </div>
          </div>

        </div>

        {/* Keeping Add Device Dialog from original code ... */}
        <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Device to Program</DialogTitle>
            </DialogHeader>

            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${deviceMode === "existing"
                  ? "bg-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
                onClick={() => setDeviceMode("existing")}
              >
                Add Existing
              </button>
              <button
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${deviceMode === "new"
                  ? "bg-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
                onClick={() => setDeviceMode("new")}
              >
                Add New
              </button>
            </div>

            {deviceMode === "existing" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select an unassigned device to add to this screen:
                </p>
                {allDevices.filter((d) => !d.screenId).length > 0 ? (
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {allDevices
                      .filter((d) => !d.screenId)
                      .map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                          onClick={() => assignExistingDevice(device.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Monitor className="w-5 h-5 text-slate-600" />
                            <div>
                              <p className="font-medium">{device.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {device.status === "pending" ? "Pending" : device.status}
                              </p>
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-slate-400" />
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-center text-muted-foreground py-8">
                    No unassigned devices available. Create a new one instead.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={createNewDevice} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the name and PIN to claim and assign a new device:
                </p>
                <div className="space-y-2">
                  <Label htmlFor="deviceName">Device Name</Label>
                  <Input
                    id="deviceName"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="e.g., Lobby TV"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="devicePin">6-Digit PIN</Label>
                  <Input
                    id="devicePin"
                    value={newDevicePin}
                    onChange={(e) => setNewDevicePin(e.target.value.toUpperCase())}
                    placeholder="ABCD-1234"
                    maxLength={9}
                    className="text-center text-2xl tracking-widest uppercase"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Find the PIN displayed on the device screen (visit /player)
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Create & Assign Device
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DndProvider>
  );
}

// Helper for Preview Video
function PreviewVideo({ src, style, isActive, isPlaying }: { src: string, style: any, isActive: boolean, isPlaying: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isActive && isPlaying && videoRef.current) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { });
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [isActive, isPlaying]);

  return (
    <video
      ref={videoRef}
      src={src}
      style={style}
      muted
      playsInline
      className="w-full h-full object-contain"
    />
  );
}
