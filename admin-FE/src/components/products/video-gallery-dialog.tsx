"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch, getProductVideoUrl } from "@/lib/api";

interface VideoGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (filename: string) => void;
}

// Picker over everything sitting in public/videos on the server — lets
// admin reuse a video already uploaded for another product instead of
// re-uploading the same file (mirrors ImageGalleryDialog's picker mode).
export function VideoGalleryDialog({ open, onOpenChange, onSelect }: VideoGalleryDialogProps) {
  const [filenames, setFilenames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch<{ filenames: string[] }>("/api/products/videos")
      .then((res) => setFilenames(res.filenames))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load videos"))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSelect = (filename: string) => {
    onSelect(filename);
    onOpenChange(false);
  };

  const visible = filenames.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a video</DialogTitle>
          <DialogDescription>
            Click a video already on the server to use it for this product.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Filter by filename..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No videos found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {visible.map((filename) => (
              <button
                key={filename}
                type="button"
                onClick={() => handleSelect(filename)}
                className="flex flex-col gap-1 rounded border p-1 text-left hover:border-primary"
                title={`Use ${filename}`}
              >
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={getProductVideoUrl(filename)}
                  muted
                  preload="metadata"
                  className="aspect-square w-full rounded object-cover"
                />
                <span className="truncate text-xs text-muted-foreground">{filename}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
