
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Search, Upload, FileImage, FileVideo, Trash2, CheckSquare, Square, Edit2, Monitor, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";
import { formatDistanceToNow } from "date-fns";

interface ContentItem {
  id: string;
  name: string;
  type: "image" | "video";
  readUrl: string;
  createdAt: string;
  path?: string;
}

export function Content() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<ContentItem | null>(null);
  const [newName, setNewName] = useState("");

  // Screens for assignment
  const [screens, setScreens] = useState<any[]>([]);
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
      formData.append("cloud_name", import.meta.env.VITE_CLOUDINARY_CLOUD_NAME);

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
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredContent.map(item => item.id)));
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
      setIsSelectionMode(false);
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
      setIsSelectionMode(false);
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

    try {
      await apiFetch(`/content/${itemToRename.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName.trim() })
      });
      toast.success("Content renamed");
      loadContent();
      setRenameModalOpen(false);
    } catch (error) {
      toast.error("Failed to rename content");
    }
  };

  const assignSingle = async (item: ContentItem) => {
    if (!selectedScreenId) {
      toast.error("Please select a screen");
      return;
    }

    try {
      const screen = await apiFetch(`/screens/${selectedScreenId}`);
      const existingContent = screen.content || [];

      await apiFetch(`/screens/${selectedScreenId}`, {
        method: "PUT",
        body: JSON.stringify({
          content: [...existingContent, item]
        })
      });

      toast.success("Content assigned to screen");
      setAssignModalOpen(false);
    } catch (error) {
      toast.error("Failed to assign content");
    }
  };

  const filteredContent = content.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Content Library</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isSelectionMode && (
            <Button variant="outline" onClick={selectAll}>
              Select All
            </Button>
          )}
          <Button
            variant={isSelectionMode ? "secondary" : "outline"}
            onClick={toggleSelectionMode}
          >
            {isSelectionMode ? "Cancel" : "Select"}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload"}
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
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 z-50">
          <span className="font-medium">{selectedIds.size} item(s) selected</span>
          <Button size="sm" variant="secondary" onClick={() => setAssignModalOpen(true)}>
            <Monitor className="w-4 h-4 mr-2" />
            Assign to Screen
          </Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {loading ? (
        <div>Loading content...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredContent.map((item) => (
            <Card key={item.id} className={cn(
              "overflow-hidden group cursor-pointer transition-all",
              selectedIds.has(item.id) && "ring-2 ring-primary"
            )}>
              <div
                className="aspect-square bg-slate-100 relative"
                onClick={() => isSelectionMode && toggleSelection(item.id)}
              >
                {isSelectionMode && (
                  <div className="absolute top-2 left-2 z-10">
                    {selectedIds.has(item.id) ? (
                      <CheckSquare className="w-6 h-6 text-primary fill-primary" />
                    ) : (
                      <Square className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                )}
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
                <div className="absolute top-2 right-2 bg-white/90 p-1 rounded">
                  {item.type === "image" ? <FileImage className="w-4 h-4 text-blue-600" /> : <FileVideo className="w-4 h-4 text-purple-600" />}
                </div>
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium truncate" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </p>
                {!isSelectionMode && (
                  <div className="flex gap-1 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                      setSelectedIds(new Set([item.id]));
                      setAssignModalOpen(true);
                    }}>
                      <Monitor className="w-3 h-3 mr-1" />
                      Assign
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openRenameModal(item)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {filteredContent.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No content found. Upload some images or videos!
            </div>
          )}
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
