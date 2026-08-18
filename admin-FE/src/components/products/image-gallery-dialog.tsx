"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch, getProductImageUrl } from "@/lib/api";

interface ImageGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When provided, the dialog acts as a picker — clicking a photo calls this
  // and closes, instead of the default copy-filename browse mode.
  onSelect?: (filename: string) => void;
}

// Browses everything sitting in public/images on the server. Used both
// standalone (copy a filename to paste elsewhere) and as an in-form picker
// for a product's image list (see product-form-dialog.tsx).
export function ImageGalleryDialog({ open, onOpenChange, onSelect }: ImageGalleryDialogProps) {
  const [filenames, setFilenames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch<{ filenames: string[] }>("/api/products/images")
      .then((res) => setFilenames(res.filenames))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load images"))
      .finally(() => setLoading(false));
  }, [open]);

  const handleCopy = async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename);
      toast.success(`Copied "${filename}"`);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const handleSelect = (filename: string) => {
    onSelect?.(filename);
    onOpenChange(false);
  };

  const visible = filenames.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{onSelect ? "Choose an image" : "Image gallery"}</DialogTitle>
          <DialogDescription>
            {onSelect
              ? "Click a photo already on the server to add it to this product."
              : "Every image currently on the server. Copy a filename to paste into a product's image field."}
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
          <p className="text-sm text-muted-foreground">No images found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {visible.map((filename) =>
              onSelect ? (
                <button
                  key={filename}
                  type="button"
                  onClick={() => handleSelect(filename)}
                  className="flex flex-col gap-1 rounded border p-1 text-left hover:border-primary"
                  title={`Use ${filename}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getProductImageUrl(filename)}
                    alt={filename}
                    className="aspect-square w-full rounded object-cover"
                  />
                  <span className="truncate text-xs text-muted-foreground">{filename}</span>
                </button>
              ) : (
                <div key={filename} className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getProductImageUrl(filename)}
                    alt={filename}
                    className="aspect-square w-full rounded border object-cover"
                  />
                  <div className="flex items-center gap-1">
                    <span className="truncate text-xs text-muted-foreground" title={filename}>
                      {filename}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopy(filename)}
                      title="Copy filename"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
