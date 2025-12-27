
import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch } from "@/shared/utils/api";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress"; // Need to ensure this exists or use standard HTML5 progress
import { Search, Upload, FileImage, FileVideo, Trash2, Monitor, MoreVertical, X as XIcon, Music, File as FileIcon, Loader2 } from "lucide-react";
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

interface ContentItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio";
  readUrl: string;
  createdAt: string;
  path?: string;
  size?: number;
}

interface UploadingItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
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
  // const [uploading, setUploading] = useState(false); // Deprecated in favor of uploads queue
  const [uploads, setUploads] = useState<UploadingItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

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

  // Process Upload Queue
  useEffect(() => {
    const pending = uploads.find(u => u.status === 'pending');
    if (pending) {
      processUpload(pending);
    }
  }, [uploads]);

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

  // --- Upload Logic ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const type = file.type.split('/')[0];
      return ['image', 'video', 'audio'].includes(type);
    });

    if (validFiles.length === 0) {
      toast.error("No valid image, video, or audio files found.");
      return;
    }

    const newUploads: UploadingItem[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'pending'
    }));

    setUploads(prev => [...prev, ...newUploads]);
  };

  const processUpload = async (item: UploadingItem) => {
    setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading' } : u));

    try {
      const { file } = item;

      // 1. Get Signed URL
      const signRes = await apiFetch("/storage/sign", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileType: file.type })
      });

      if (signRes.error) throw new Error(signRes.error);
      const { uploadUrl, path, token } = signRes;

      // 2. Upload with XHR for Progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploads(prev => prev.map(u =>
              u.id === item.id ? { ...u, progress: percentComplete } : u
            ));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      // 3. Get Public URL
      const readUrlRes = await apiFetch("/storage/read-url", {
        method: "POST",
        body: JSON.stringify({ path })
      });
      if (readUrlRes.error) throw new Error(readUrlRes.error);

      // 4. Save Metadata
      await apiFetch("/content", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          type: file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'audio',
          readUrl: readUrlRes.readUrl,
          path: path,
          size: file.size,
        }),
      });

      // Success
      setUploads(prev => prev.filter(u => u.id !== item.id)); // Remove from list on success
      toast.success(`${file.name} uploaded`);
      loadContent();

    } catch (error: any) {
      console.error("Upload error:", error);
      setUploads(prev => prev.map(u =>
        u.id === item.id ? { ...u, status: 'error', error: error.message } : u
      ));
      toast.error(`Failed to upload ${item.file.name}`);
    }
  };

  // ... (Keep existing Multi-select, Bulk, Delete functions - toggleSelection, clearSelection, bulkDelete, bulkAssign, deleteItem, openRenameModal, renameItem, assignSingle, formatFileSize, getAssignedScreens, filteredContent)

  // NOTE: Reusing existing helper functions from previous file to avoid duplication in prompt, 
  // but in real code replace this comment with actual implementations or ensure they are preserved.
  // For this 'write_to_file', I need to include them to keep the file valid.

  // --- Helper Implementations (Copied/Adapted) ---
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} item(s)?`)) return;
    const toastId = toast.loading(`Deleting ${selectedIds.size} items...`);
    try {
      await Promise.all(Array.from(selectedIds).map(id => apiFetch(`/content/${id}`, { method: "DELETE" })));
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
      const visualContent = selectedContent.filter(c => c.type !== 'audio');

      if (visualContent.length === 0) {
        toast.dismiss(toastId);
        toast.warning("No visual content to assign (Audio skipped)");
        return;
      }

      // Format as Playlist Items
      const newPlaylistItems = visualContent.map(c => ({
        contentId: c.id,
        duration: 10,
        volume: 100
      }));

      await apiFetch(`/programs/${selectedScreenId}`, {
        method: "PUT",
        body: JSON.stringify({ content: [...existingContent, ...newPlaylistItems] })
      });
      toast.success(`Assigned ${visualContent.length} items`, { id: toastId });
      setAssignModalOpen(false);
      setSelectedIds(new Set());
      loadScreens();
    } catch (error) {
      toast.error("Failed to assign content", { id: toastId });
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    try {
      await apiFetch(`/content/${id}`, { method: "DELETE" });
      toast.success("Content deleted");
      loadContent();
    } catch (error) { toast.error("Failed to delete content"); }
  };

  const openRenameModal = (item: ContentItem) => {
    setItemToRename(item);
    setNewName(item.name);
    setRenameModalOpen(true);
  };

  const renameItem = async () => {
    if (!itemToRename || !newName.trim()) return;
    const toastId = toast.loading("Renaming...");
    try {
      await apiFetch(`/content/${itemToRename.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName.trim() })
      });
      toast.success("Renamed", { id: toastId });
      loadContent();
      setRenameModalOpen(false);
    } catch (error) { toast.error("Failed to rename", { id: toastId }); }
  };

  const assignSingle = (itemId: string) => {
    setSelectedIds(new Set([itemId]));
    setAssignModalOpen(true);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
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
          <p className="text-sm text-muted-foreground mt-1">Upload, create and manage your media</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple // Enable multiple select
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Upload Progress Area */}
      {uploads.length > 0 && (
        <Card className="mb-6 border-blue-100 bg-blue-50/50">
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-blue-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Uploading {uploads.length} file(s)...
            </h3>
            <div className="space-y-2">
              {uploads.map(u => (
                <div key={u.id} className="bg-white p-3 rounded border border-blue-100 shadow-sm flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded">
                    {u.file.type.startsWith('image') ? <FileImage className="w-5 h-5 text-blue-500" /> : <FileVideo className="w-5 h-5 text-purple-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate">{u.file.name}</span>
                      <span className="text-muted-foreground">{Math.round(u.progress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-300", u.status === 'error' ? "bg-red-500" : "bg-blue-600")}
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                    {u.error && <p className="text-xs text-red-600 mt-1">{u.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Main Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative min-h-[400px] transition-colors rounded-xl border-2 border-transparent",
          isDragging ? "border-blue-500 bg-blue-50/30" : ""
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/80 backdrop-blur-[1px] rounded-xl border-2 border-blue-500 border-dashed">
            <div className="text-center animate-bounce">
              <Upload className="w-12 h-12 text-blue-600 mx-auto mb-2" />
              <p className="text-xl font-bold text-blue-700">Drop files to upload</p>
            </div>
          </div>
        )}

        {/* Keeping existing Selection Toolbar */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 px-2">
          <span>{selectedIds.size} selected</span>
          {selectedIds.size > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-auto p-1 px-2">Clear</Button>
              <div className="h-4 w-px bg-border" />
              <Button variant="ghost" size="sm" onClick={() => setAssignModalOpen(true)} className="h-auto p-1 px-2 text-indigo-600">Assign</Button>
              <Button variant="ghost" size="sm" onClick={bulkDelete} className="h-auto p-1 px-2 text-red-600">Delete</Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-20">
          {filteredContent.map((item) => {
            // ... (Existing Card Logic - Copied for completeness)
            const isSelected = selectedIds.has(item.id);
            const assignedTo = getAssignedScreens(item.id);

            return (
              <div
                className={cn(
                  "group relative overflow-hidden transition-all duration-200 cursor-pointer border-2 bg-slate-50",
                  isSelected ? "border-indigo-500 shadow-md ring-2 ring-indigo-100" : "border-transparent hover:border-slate-200"
                )}
                onClick={() => setPreviewItem(item)} // Click thumbnail to Preview
              >
                <div className="aspect-square relative">
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

                  {/* Checkbox Overlay (Always visible if selected, otherwise hover) */}
                  <div className={cn(
                    "absolute top-2 right-2 z-10 transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelection(item.id, e as any)}
                      className="w-5 h-5 rounded border-2 border-white/50 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm"
                    />
                  </div>

                  <div className={cn(
                    "absolute inset-0 bg-black/40 transition-opacity flex flex-col justify-end p-3 pointer-events-none",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    <div className="flex items-center justify-between pointer-events-auto">
                      <div /> {/* Spacer for checkbox */}
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRenameModal(item); }}>Rename</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); assignSingle(item.id); }}>Add to Timeline</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] uppercase font-medium">{item.type}</span>
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium">{formatFileSize(item.size)}</span>
                </div>

                {/* Meta Info Below Card */}
                <div className="p-3 bg-white border-t border-slate-100">
                  <p className="font-medium text-sm truncate text-slate-700" title={item.name}>{item.name}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                  </div>
                  {assignedTo.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {assignedTo.slice(0, 2).map((name, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] truncate max-w-[80px]">{name}</span>
                      ))}
                      {assignedTo.length > 2 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">+{assignedTo.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredContent.length === 0 && !loading && (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-slate-50">
            <p className="text-muted-foreground">No content found</p>
            <Button variant="link" onClick={() => fileInputRef.current?.click()}>Upload something</Button>
          </div>
        )}
      </div>

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
            {screens.length === 0 ? <p className="p-4 text-sm text-center text-muted-foreground">No programs found.</p> : (
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

      {/* Rename Modal */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rename Content</DialogTitle></DialogHeader>
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
