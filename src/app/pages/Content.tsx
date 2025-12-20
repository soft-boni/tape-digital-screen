
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Search, Upload, FileImage, FileVideo, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

interface ContentItem {
  id: string;
  name: string;
  type: "image" | "video";
  readUrl: string; // The long-lived signed URL
  createdAt: string;
}

export function Content() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const data = await apiFetch("/content");
      // Sort by newest
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Uploading to Cloudinary...");

    try {
      // Upload to Cloudinary
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

      // Save metadata to backend
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

      {loading ? (
        <div>Loading content...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredContent.map((item) => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="aspect-square bg-slate-100 relative">
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
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {/* Actions could go here */}
                </div>
                <div className="absolute top-2 right-2 bg-white/90 p-1 rounded">
                  {item.type === "image" ? <FileImage className="w-4 h-4 text-blue-600" /> : <FileVideo className="w-4 h-4 text-purple-600" />}
                </div>
              </div>
              <CardFooter className="p-3">
                <p className="text-sm font-medium truncate w-full" title={item.name}>
                  {item.name}
                </p>
              </CardFooter>
            </Card>
          ))}
          {filteredContent.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No content found. Upload some images or videos!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
