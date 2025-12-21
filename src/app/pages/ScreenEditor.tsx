
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { apiFetch } from "../utils/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Play, Pause, SkipBack, SkipForward, Plus, Trash2, GripVertical, Save, Monitor, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";

// --- Draggable Item Component ---
const DraggableItem = ({ item, index, moveItem, removeItem, updateDuration, contentDetails }: any) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
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

  drag(drop(ref));

  const details = contentDetails.find((c: any) => c.id === item.contentId);
  if (!details) return null;

  return (
    <div
      ref={ref}
      className={`flex items-center gap-3 p-3 bg-white border rounded-lg mb-2 shadow-sm ${isDragging ? "opacity-50" : "opacity-100"
        }`}
    >
      <div className="cursor-move text-slate-400 hover:text-slate-600">
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0">
        {details.type === "image" ? (
          <img src={details.readUrl} className="w-full h-full object-cover" />
        ) : (
          <video src={details.readUrl} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{details.name}</p>
        <p className="text-xs text-muted-foreground uppercase">{details.type}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="w-20 h-8 text-right"
          value={item.duration}
          onChange={(e) => updateDuration(index, parseInt(e.target.value) || 5)}
          min={1}
        />
        <span className="text-xs text-muted-foreground w-6">sec</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(index)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};


// --- Preview Player Component ---
const PreviewPlayer = ({ playlist, contentDetails }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<any>(null);

  const currentItem = playlist[currentIndex];
  const currentDetails = currentItem
    ? contentDetails.find((c: any) => c.id === currentItem.contentId)
    : null;

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
    setProgress(0);
  }, [playlist.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    setProgress(0);
  };

  useEffect(() => {
    if (isPlaying && currentItem) {
      const duration = currentItem.duration * 1000;
      const interval = 100;

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          const next = prev + (interval / duration) * 100;
          if (next >= 100) {
            handleNext();
            return 0;
          }
          return next;
        });
      }, interval);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, currentItem, handleNext]);

  if (!playlist.length || !currentDetails) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-white/50">
        No content to preview
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-xl border border-slate-800">
        {currentDetails.type === "image" ? (
          <img src={currentDetails.readUrl} className="w-full h-full object-contain" />
        ) : (
          <video
            src={currentDetails.readUrl}
            className="w-full h-full object-contain"
            autoPlay={isPlaying}
            muted
            loop={false}
            onEnded={handleNext}
          />
        )}

        {/* Progress Bar Overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-red-600 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={handlePrev}><SkipBack className="w-4 h-4" /></Button>
        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
        </Button>
        <Button variant="outline" size="icon" onClick={handleNext}><SkipForward className="w-4 h-4" /></Button>
      </div>
      <div className="text-center text-sm text-muted-foreground">
        Now Playing: <span className="font-medium text-foreground">{currentDetails.name}</span>
      </div>
    </div>
  );
};


// --- Main Editor Component ---
export function ScreenEditor() {
  const { id } = useParams();
  const [screen, setScreen] = useState<any>(null);
  const [allContent, setAllContent] = useState<any[]>([]);
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<any[]>([]); // Local state for drag/drop
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"existing" | "new">("existing"); // Toggle between add modes
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDevicePin, setNewDevicePin] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [sData, cData, dData] = await Promise.all([
        apiFetch(`/screens/${id}`),
        apiFetch("/content"),
        apiFetch("/devices"),
      ]);
      setScreen(sData);
      setAllContent(cData);
      setAllDevices(dData);
      setPlaylist(sData.content || []);

      // Filter devices assigned to this screen
      const assigned = dData.filter((d: any) => d.screenId === id);
      setAssignedDevices(assigned);
    } catch (error) {
      toast.error("Failed to load screen");
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    try {
      const updatedScreen = {
        ...screen,
        content: playlist,
      };
      await apiFetch(`/screens/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedScreen),
      });
      setScreen(updatedScreen);
      toast.success("Changes saved!");
    } catch (error) {
      toast.error("Failed to save changes");
    }
  };

  const handleDeleteScreen = async () => {
    if (!screen) return;

    // Confirmation dialog
    const confirmMessage = `Are you sure you want to delete "${screen.name}"?\n\nThis action cannot be undone. All content assignments and settings will be lost.`;

    if (!confirm(confirmMessage)) return;

    // Double confirmation for safety
    const doubleConfirm = prompt(
      `Type "${screen.name}" to confirm deletion:`
    );

    if (doubleConfirm !== screen.name) {
      toast.error("Screen name doesn't match. Deletion cancelled.");
      return;
    }

    try {
      await apiFetch(`/screens/${screen.id}`, {
        method: "DELETE"
      });
      toast.success("Screen deleted successfully");
      // Navigate back to screens list
      window.location.href = "/screens";
    } catch (error) {
      toast.error("Failed to delete screen");
    }
  };

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

  const removeItem = (index: number) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index));
  };

  const addContentToPlaylist = (contentId: string) => {
    setPlaylist(prev => [
      ...prev,
      { contentId, duration: 10, order: prev.length }
    ]);
    toast.success("Added to timeline");
  };

  // Device management functions
  const assignExistingDevice = async (deviceId: string) => {
    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({ screenId: id }),
      });
      toast.success("Device assigned to screen");
      loadData();
      setIsAddDeviceOpen(false);
    } catch (error) {
      toast.error("Failed to assign device");
    }
  };

  const createNewDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Use the claim endpoint to add a new device
      await apiFetch("/devices/claim", {
        method: "POST",
        body: JSON.stringify({ pin: newDevicePin, name: newDeviceName }),
      });
      // Then assign it to this screen
      const devices = await apiFetch("/devices");
      const newDevice = devices.find((d: any) => d.name === newDeviceName);
      if (newDevice) {
        await apiFetch(`/devices/${newDevice.id}`, {
          method: "PUT",
          body: JSON.stringify({ screenId: id }),
        });
      }
      toast.success("Device created and assigned");
      setNewDeviceName("");
      setNewDevicePin("");
      loadData();
      setIsAddDeviceOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create device");
    }
  };

  const removeDeviceFromScreen = async (deviceId: string) => {
    try {
      await apiFetch(`/devices/${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({ screenId: null }),
      });
      toast.success("Device removed from screen");
      loadData();
    } catch (error) {
      toast.error("Failed to remove device");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h1 className="text-2xl font-bold">{screen.name}</h1>
            <p className="text-sm text-muted-foreground">{screen.resolution}</p>
          </div>
          <Button onClick={saveChanges}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
          {/* Left Column: Timeline & Settings */}
          <div className="flex flex-col min-h-0">
            <Tabs defaultValue="timeline" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="flex-1 overflow-y-auto min-h-0 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Playlist ({playlist.length})</h3>
                  <Dialog open={isAddContentOpen} onOpenChange={setIsAddContentOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2" />Add Content</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader><DialogTitle>Add Content to Timeline</DialogTitle></DialogHeader>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto p-2">
                        {allContent.map(c => (
                          <div key={c.id}
                            className="cursor-pointer group relative aspect-square bg-slate-100 rounded-md overflow-hidden border hover:ring-2 hover:ring-indigo-500"
                            onClick={() => addContentToPlaylist(c.id)}
                          >
                            {c.type === "image" ? (
                              <img src={c.readUrl} className="w-full h-full object-cover" />
                            ) : (
                              <video src={c.readUrl} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <Plus className="text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2 pb-20">
                  {playlist.map((item, index) => (
                    <DraggableItem
                      key={`${item.contentId}-${index}`}
                      item={item}
                      index={index}
                      moveItem={moveItem}
                      removeItem={removeItem}
                      updateDuration={updateDuration}
                      contentDetails={allContent}
                    />
                  ))}
                  {playlist.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                      Playlist is empty. Add content to start.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <Label>Screen Name</Label>
                      <Input
                        value={screen.name}
                        onChange={(e) => setScreen({ ...screen, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={screen.description}
                        onChange={(e) => setScreen({ ...screen, description: e.target.value })}
                      />
                    </div>

                    {/* Device Management Section */}
                    <div className="space-y-2 pt-4">
                      <Label className="text-base">Assigned Devices</Label>
                      <div className="border rounded-lg p-4 space-y-3">
                        {assignedDevices.length > 0 ? (
                          assignedDevices.map((device) => (
                            <div
                              key={device.id}
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-md"
                            >
                              <div className="flex items-center gap-3">
                                <Monitor className="w-5 h-5 text-slate-600" />
                                <div>
                                  <p className="font-medium">{device.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {device.status === "online" ? "🟢 Online" : "⚫ Offline"}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDeviceFromScreen(device.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No devices assigned to this screen
                          </p>
                        )}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsAddDeviceOpen(true)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Device
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Delete Screen - Danger Zone */}
                <Card className="border-destructive mt-6">
                  <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this screen and all its settings
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteScreen}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Screen
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Preview */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold">Live Preview</h3>
            <PreviewPlayer playlist={playlist} contentDetails={allContent} />
          </div>
        </div>
      </div>

      {/* Add Device Modal */}
      <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Device to Screen</DialogTitle>
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
                  onChange={(e) => setNewDevicePin(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
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
    </DndProvider>
  );
}
