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
}

// Read-only browse of everything sitting in public/images on the server, so
// admin can find and copy a filename to paste into a product's manual
// filename field — the "ad hoc" fix path for images a bulk upload couldn't
// match automatically.
export function ImageGalleryDialog({ open, onOpenChange }: ImageGalleryDialogProps) {
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

  const visible = filenames.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Image gallery</DialogTitle>
          <DialogDescription>
            Every image currently on the server. Copy a filename to paste into a
            product&apos;s image field.
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
            {visible.map((filename) => (
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
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
