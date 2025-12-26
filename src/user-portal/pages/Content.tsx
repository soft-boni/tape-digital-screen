
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/shared/utils/api";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Search, Upload, FileImage, FileVideo, Trash2, Monitor, MoreVertical, X as XIcon, Music } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/components/ui/utils";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Eye } from "lucide-react";

interface ContentItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio";
  readUrl: string;
  createdAt: string;
  path?: string;
  size?: number;
}

interface Screen {
  id: string;
  name: string;
  content?: ContentItem[];
}

export function Content() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<ContentItem | null>(null);
  const [newName, setNewName] = useState("");

  // Preview modal
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);

  // Screens for assignment
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState("");

  useEffect(() => {
    loadContent();
    loadScreens();
  }, []);

  const loadContent = async () => {
    try {
      const data = await apiFetch("/content");
      const sorted = data.sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setContent(sorted);
    } catch (error) {
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const loadScreens = async () => {
    try {
      const data = await apiFetch("/programs");
      setScreens(data);
    } catch (error) {
      console.error("Failed to load screens", error);
    }
  };



  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");

    if (!isImage && !isVideo && !isAudio) {
      toast.error("Please select an image, video, or audio file");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Preparing upload...");

    try {
      // 1. Get Signed Upload URL
      const signRes = await apiFetch("/storage/sign", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type
        })
      });

      if (signRes.error) throw new Error(signRes.error);

      const { uploadUrl, path, token } = signRes;

      // 2. Upload File to Supabase Storage
      toast.loading("Uploading...", { id: toastId });

      const uploadHeaders: HeadersInit = {
        "Content-Type": file.type,
      };

      if (token) {
        uploadHeaders["Authorization"] = `Bearer ${token}`;
      }

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: uploadHeaders,
        body: file
      });

      if (!uploadRes.ok) {
        console.error("Storage upload failed", uploadRes.status, await uploadRes.text());
        throw new Error("Failed to upload file to storage");
      }

      // 3. Get Public/Read URL
      // Since we just uploaded it, we can generate a signed read URL
      const readUrlRes = await apiFetch("/storage/read-url", {
        method: "POST",
        body: JSON.stringify({ path })
      });

      if (readUrlRes.error) throw new Error(readUrlRes.error);
      const readUrl = readUrlRes.readUrl;

      // 4. Save Metadata
      toast.loading("Finalizing...", { id: toastId });

      await apiFetch("/content", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          type: isImage ? "image" : isVideo ? "video" : "audio",
          readUrl: readUrl, // Signed URL (valid for 1 year)
          path: path,
          size: file.size,
        }),
      });

      toast.success("Content uploaded successfully", { id: toastId });
      loadContent();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Upload failed", { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Multi-select functions
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk operations
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Delete ${selectedIds.size} item(s)?`)) return;

    const toastId = toast.loading(`Deleting ${selectedIds.size} items...`);

    try {
      await Promise.all(
        Array.from(selectedIds).map(id => apiFetch(`/content/${id}`, { method: "DELETE" }))
      );
      toast.success("Items deleted successfully", { id: toastId });
      loadContent();
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Failed to delete items", { id: toastId });
    }
  };

  const bulkAssign = async () => {
    if (!selectedScreenId) {
      toast.error("Please select a program");
      return;
    }

    const toastId = toast.loading(`Assigning ${selectedIds.size} items...`);

    try {
      const screen = await apiFetch(`/programs/${selectedScreenId}`);
      const existingContent = screen.content || [];
      const selectedContent = content.filter(item => selectedIds.has(item.id));

      // Filter out audio for playlist assignment if needed? 
      // For now, let's allow it but maybe warn? 
      // Actually, let's filter audio out of visual playlists for now to avoid confusion
      const visualContent = selectedContent.filter(c => c.type !== 'audio');

      if (visualContent.length !== selectedContent.length) {
        toast.message("Audio files skipped", {
          description: "Audio files cannot be added to the visual timeline directly. Use Program Settings > Background Music."
        });
      }

      if (visualContent.length === 0) {
        toast.dismiss(toastId);
        return;
      }

      await apiFetch(`/programs/${selectedScreenId}`, {
        method: "PUT",
        body: JSON.stringify({
          content: [...existingContent, ...visualContent]
        })
      });

      toast.success(`Assigned ${visualContent.length} items successfully`, { id: toastId });
      setAssignModalOpen(false);
      setSelectedIds(new Set());
      loadScreens();
    } catch (error) {
      toast.error("Failed to assign content", { id: toastId });
    }
  };

  // Individual operations
  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;

    try {
      await apiFetch(`/content/${id}`, { method: "DELETE" });
      toast.success("Content deleted");
      loadContent();
    } catch (error) {
      toast.error("Failed to delete content");
    }
  };

  const openRenameModal = (item: ContentItem) => {
    setItemToRename(item);
    setNewName(item.name);
    setRenameModalOpen(true);
  };

  const renameItem = async () => {
    if (!itemToRename || !newName.trim()) return;

    const toastId = toast.loading("Renaming content...");

    try {
      await apiFetch(`/content/${itemToRename.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName.trim() })
      });
      toast.success("Content renamed successfully", { id: toastId });
      await loadContent();
      setRenameModalOpen(false);
      setItemToRename(null);
      setNewName("");
    } catch (error: any) {
      console.error("Rename error:", error);
      toast.error(error.message || "Failed to rename content", { id: toastId });
    }
  };

  const assignSingle = async (itemId: string) => {
    setSelectedIds(new Set([itemId]));
    setAssignModalOpen(true);
  };

  // Helper functions
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getAssignedScreens = (contentId: string): string[] => {
    const assignedScreenNames: string[] = [];
    screens.forEach(screen => {
      if (screen.content && screen.content.some(c => c.id === contentId)) {
        assignedScreenNames.push(screen.name);
      }
    });
    return assignedScreenNames;
  };

  const filteredContent = content.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Content</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload, create and manage your content</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload Content"}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{selectedIds.size} selected</span>
        {selectedIds.size > 0 && (
          <>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-auto p-1 px-2">Clear</Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={() => setAssignModalOpen(true)} className="h-auto p-1 px-2 text-indigo-600">Assign to Program</Button>
            <Button variant="ghost" size="sm" onClick={bulkDelete} className="h-auto p-1 px-2 text-red-600">Delete</Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredContent.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const assignedTo = getAssignedScreens(item.id);

          return (
            <Card
              key={item.id}
              className={cn(
                "group relative overflow-hidden transition-all duration-200 cursor-pointer border-2",
                isSelected ? "border-indigo-500 shadow-md transform scale-[1.02]" : "border-transparent hover:border-slate-200"
              )}
              onClick={(e) => toggleSelection(item.id, e)}
            >
              <div className="aspect-square bg-slate-100 relative">
                {item.type === "image" ? (
                  <img src={item.readUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : item.type === "video" ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <video src={item.readUrl} className="w-full h-full object-cover opacity-80" />
                    <FileVideo className="absolute w-12 h-12 text-white/50" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                    <Music className="w-16 h-16 text-indigo-400" />
                  </div>
                )}

                {/* Overlay on hover / selected */}
                <div className={cn(
                  "absolute inset-0 bg-black/40 transition-opacity flex flex-col justify-end p-3",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <div className="flex items-center justify-between">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => { }}
                      className="w-5 h-5 rounded border-white/50 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex gap-1">
                      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}>
                        <Monitor className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRenameModal(item); }}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); assignSingle(item.id); }}>
                            Add to Timeline
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Type Badge - Top Left */}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] uppercase font-medium">
                  {item.type}
                </span>

                {/* File Size - Top Right (Moved as requested) */}
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium">
                  {formatFileSize(item.size)}
                </span>
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate" title={item.name}>{item.name}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>{item.type === 'image' ? formatFileSize(item.size) : formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                </div>
                {assignedTo.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {assignedTo.slice(0, 2).map((name, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] truncate max-w-[80px]">
                        {name}
                      </span>
                    ))}
                    {assignedTo.length > 2 && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">+{assignedTo.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {filteredContent.length === 0 && !loading && (
        <div className="text-center py-20 border-2 border-dashed rounded-lg bg-slate-50">
          <p className="text-muted-foreground">No content found</p>
          <Button variant="link" onClick={() => fileInputRef.current?.click()}>Upload something</Button>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewItem(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full bg-black rounded-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-white/70 hover:text-white z-10 hover:bg-white/10" onClick={() => setPreviewItem(null)}>
              <XIcon className="w-6 h-6" />
            </Button>

            <div className="flex items-center justify-center bg-black aspect-video">
              {previewItem.type === "image" ? (
                <img src={previewItem.readUrl} className="max-w-full max-h-[80vh] object-contain" />
              ) : previewItem.type === "video" ? (
                <video src={previewItem.readUrl} controls autoPlay className="max-w-full max-h-[80vh]" />
              ) : (
                <div className="text-center text-white">
                  <Music className="w-24 h-24 mx-auto mb-4 text-indigo-400" />
                  <h3 className="text-xl font-medium mb-4">{previewItem.name}</h3>
                  <audio src={previewItem.readUrl} controls autoPlay className="w-[300px]" />
                </div>
              )}
            </div>
            <div className="p-4 bg-zinc-900 border-t border-zinc-800 text-white">
              <h3 className="font-medium text-lg">{previewItem.name}</h3>
              <p className="text-sm text-zinc-400 flex gap-4 mt-1">
                <span>Type: {previewItem.type}</span>
                <span>Size: {formatFileSize(previewItem.size)}</span>
                <span>Added: {new Date(previewItem.createdAt).toLocaleDateString()}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      <DropdownMenu open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DropdownMenuContent className="w-full sm:w-80 p-0 transform -translate-x-1/2 left-1/2 fixed top-1/2 -translate-y-1/2 z-50 bg-white shadow-xl border rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Assign to Program</h3>
            <p className="text-xs text-muted-foreground">Add {selectedIds.size} item(s) to a timeline</p>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {screens.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">No programs found.</p>
            ) : (
              <div className="space-y-1">
                {screens.map(screen => (
                  <button
                    key={screen.id}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between",
                      selectedScreenId === screen.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-50"
                    )}
                    onClick={() => setSelectedScreenId(screen.id)}
                  >
                    <span>{screen.name}</span>
                    {selectedScreenId === screen.id && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={bulkAssign} disabled={!selectedScreenId}>Assign</Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Modal - Switched to Dialog for Centering */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-input">New Name</Label>
              <Input
                id="rename-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Enter new name"
                onKeyDown={(e) => e.key === 'Enter' && renameItem()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModalOpen(false)}>Cancel</Button>
            <Button onClick={renameItem}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


