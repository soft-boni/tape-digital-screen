
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Search, Upload, FileImage, FileVideo, Trash2, Monitor, MoreVertical, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

interface ContentItem {
  id: string;
  name: string;
  type: "image" | "video";
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
      const data = await apiFetch("/screens");
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

    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Uploading to Cloudinary...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "digital_signage_unsigned");

      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const resourceType = isImage ? "image" : "video";

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error?.message || "Cloudinary upload failed");
      }

      const cloudinaryData = await uploadResponse.json();

      await apiFetch("/content", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          type: isImage ? "image" : "video",
          readUrl: cloudinaryData.secure_url,
          path: cloudinaryData.public_id,
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
      toast.error("Please select a screen");
      return;
    }

    const toastId = toast.loading(`Assigning ${selectedIds.size} items...`);

    try {
      const screen = await apiFetch(`/screens/${selectedScreenId}`);
      const existingContent = screen.content || [];
      const selectedContent = content.filter(item => selectedIds.has(item.id));

      await apiFetch(`/screens/${selectedScreenId}`, {
        method: "PUT",
        body: JSON.stringify({
          content: [...existingContent, ...selectedContent]
        })
      });

      toast.success("Content assigned successfully", { id: toastId });
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
            accept="image/*,video/*"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 z-50">
          <span className="font-medium">{selectedIds.size} item(s) selected</span>
          <Button size="sm" variant="secondary" onClick={() => setAssignModalOpen(true)}>
            <Monitor className="w-4 h-4 mr-2" />
            Assign
          </Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <button
            className="ml-2 text-primary-foreground hover:text-primary-foreground/80"
            onClick={clearSelection}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div>Loading content...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredContent.map((item) => {
            const assignedScreens = getAssignedScreens(item.id);

            return (
              <Card key={item.id} className={cn(
                "overflow-visible group transition-all relative",
                selectedIds.has(item.id) && "ring-2 ring-primary"
              )}>
                <div
                  className="aspect-[4/3] bg-slate-100 relative overflow-hidden cursor-pointer"
                  onClick={() => setPreviewItem(item)}
                >
                  {/* Checkbox - only way to select */}
                  <div className="absolute top-2 left-2 z-10" onClick={(e) => toggleSelection(item.id, e)}>
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer",
                      selectedIds.has(item.id)
                        ? "bg-primary border-primary"
                        : "bg-white/90 border-gray-300 hover:border-primary"
                    )}>
                      {selectedIds.has(item.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                  </div>

                  {item.type === "image" ? (
                    <img
                      src={item.readUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.readUrl}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* File type badge */}
                  <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-xs flex items-center gap-1">
                    {item.type === "image" ? <FileImage className="w-3 h-3 text-blue-600" /> : <FileVideo className="w-3 h-3 text-purple-600" />}
                    <span className="capitalize">{item.type}</span>
                  </div>
                </div>

                <CardContent className="p-3 space-y-1">
                  {/* Name and three-dot menu on same row */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate flex-1" title={item.name}>
                      {item.name}
                    </p>

                    {/* Three-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-50">
                        <DropdownMenuItem onClick={() => openRenameModal(item)}>
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => assignSingle(item.id)}>
                          Assign to Screen
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          onClick={() => deleteItem(item.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(item.size)} • {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Assigned To</span>
                    <br />
                    {assignedScreens.length > 0 ? (
                      <span>{assignedScreens.join(", ")}</span>
                    ) : (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredContent.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No content found. Upload some images or videos!
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setPreviewItem(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
            >
              <XIcon className="w-8 h-8" />
            </button>
            {previewItem.type === "image" ? (
              <img
                src={previewItem.readUrl}
                alt={previewItem.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                src={previewItem.readUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}
            <div className="mt-4 text-white text-center">
              <p className="font-medium">{previewItem.name}</p>
              <p className="text-sm text-gray-300 mt-1">
                {formatFileSize(previewItem.size)} • Uploaded {formatDistanceToNow(new Date(previewItem.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAssignModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Assign to Screen</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Screen</label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={selectedScreenId}
                  onChange={(e) => setSelectedScreenId(e.target.value)}
                >
                  <option value="">Choose a screen...</option>
                  {screens.map(screen => (
                    <option key={screen.id} value={screen.id}>{screen.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} item(s) will be assigned
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
                <Button onClick={bulkAssign}>Assign</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRenameModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Rename Content</h2>
            <div className="space-y-4">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name..."
                onKeyDown={(e) => e.key === 'Enter' && renameItem()}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRenameModalOpen(false)}>Cancel</Button>
                <Button onClick={renameItem}>Rename</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
