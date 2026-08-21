"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, getProductImageUrl, getProductVideoUrl } from "@/lib/api";
import type { Category, Product, ProductFeaturedTag } from "@/lib/types";
import { ImageGalleryDialog } from "./image-gallery-dialog";
import { VideoGalleryDialog } from "./video-gallery-dialog";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  product: Product | null;
  onSaved: () => void;
}

const emptyForm = {
  sku: "",
  name: "",
  brand: "",
  category_id: "",
  short_description: "",
  description: "",
  price: "",
  sale_price: "",
  stock_qty: "0",
  dimensions: "",
  lead_time_days: "0",
  tags: "",
  featured_tag_id: "none",
  product_handle: "",
  variant_options: "",
  is_active: true,
};

// "Material: Leather; Color: Black" <-> { Material: "Leather", Color: "Black" }
// Mirrors the bulk-upload parser (routes/product.js) so the same text works
// in both places. A bare value with no "Name:" prefix becomes { Option: value }.
const parseVariantOptionsText = (raw: string): Record<string, string> | null => {
  if (!raw.trim()) return null;
  const result: Record<string, string> = {};
  raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const colonIndex = pair.indexOf(":");
      if (colonIndex === -1) {
        result.Option = pair;
      } else {
        const key = pair.slice(0, colonIndex).trim();
        const value = pair.slice(colonIndex + 1).trim();
        if (key && value) result[key] = value;
      }
    });
  return Object.keys(result).length > 0 ? result : null;
};

const stringifyVariantOptions = (options: Record<string, string> | null): string => {
  if (!options) return "";
  return Object.entries(options)
    .map(([key, value]) => (key === "Option" ? value : `${key}: ${value}`))
    .join("; ");
};

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
  onSaved,
}: ProductFormDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [featuredTags, setFeaturedTags] = useState<ProductFeaturedTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      apiFetch<ProductFeaturedTag[]>("/api/product-featured-tags").then(setFeaturedTags);
    }
  }, [open]);

  useEffect(() => {
    if (product) {
      setForm({
        sku: product.sku,
        name: product.name,
        brand: product.brand || "",
        category_id: String(product.category_id),
        short_description: product.short_description || "",
        description: product.description || "",
        price: product.price,
        sale_price: product.sale_price || "",
        stock_qty: String(product.stock_qty),
        dimensions: product.dimensions || "",
        lead_time_days: String(product.lead_time_days ?? 0),
        tags: product.tags.join(", "),
        featured_tag_id: product.featured_tag_id ? String(product.featured_tag_id) : "none",
        product_handle: product.product_handle || "",
        variant_options: stringifyVariantOptions(product.variant_options),
        is_active: product.is_active,
      });
      setImages(product.image_filenames);
      setVideo(product.video_filename);
    } else {
      setForm(emptyForm);
      setImages([]);
      setVideo(null);
    }
  }, [product, open]);

  const addImages = (filenames: string[]) => {
    setImages((prev) => [...prev, ...filenames.filter((f) => !prev.includes(f))]);
  };

  const removeImage = (filename: string) => {
    setImages((prev) => prev.filter((f) => f !== filename));
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const body = new FormData();
      Array.from(files).forEach((file) => body.append("images", file));
      const res = await apiFetch<{ filenames: string[] }>(
        "/api/products/upload-images",
        { method: "POST", body }
      );
      addImages(res.filenames);
      toast.success(`Uploaded ${res.filenames.length} image(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const body = new FormData();
      body.append("video", file);
      const res = await apiFetch<{ filename: string }>(
        "/api/products/upload-video",
        { method: "POST", body }
      );
      setVideo(res.filename);
      toast.success("Video uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        brand: form.brand || null,
        category_id: parseInt(form.category_id, 10),
        short_description: form.short_description || null,
        description: form.description || null,
        price: parseFloat(form.price),
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
        stock_qty: parseInt(form.stock_qty || "0", 10),
        dimensions: form.dimensions || null,
        lead_time_days: parseInt(form.lead_time_days || "0", 10),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        image_filenames: images,
        video_filename: video,
        featured_tag_id:
          form.featured_tag_id === "none" ? null : parseInt(form.featured_tag_id, 10),
        product_handle: form.product_handle.trim() || null,
        variant_options: parseVariantOptionsText(form.variant_options),
        is_active: form.is_active,
      };

      if (product) {
        await apiFetch(`/api/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Product updated");
      } else {
        await apiFetch("/api/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Product created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Fields match the product listing template columns.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product_handle">Product Handle</Label>
            <Input
              id="product_handle"
              placeholder="Leave blank unless this product has variants"
              value={form.product_handle}
              onChange={(e) => setForm({ ...form, product_handle: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Products sharing the same handle are variants of one product
              (e.g. different Material/Color options).
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="variant_options">Variant Options</Label>
            <Input
              id="variant_options"
              placeholder='e.g. "Material: Leather; Color: Black"'
              value={form.variant_options}
              onChange={(e) => setForm({ ...form, variant_options: e.target.value })}
              disabled={!form.product_handle.trim()}
            />
            <p className="text-xs text-muted-foreground">
              This SKU&apos;s specific combination — only used when a Product
              Handle is set above.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={form.category_id}
              onValueChange={(v) => setForm({ ...form, category_id: v ?? "" })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="short_description">Short Description</Label>
            <Input
              id="short_description"
              value={form.short_description}
              onChange={(e) =>
                setForm({ ...form, short_description: e.target.value })
              }
            />
          </div>
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="description">Full Description</Label>
            <Textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="price">Price (SGD) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sale_price">Sale Price (SGD)</Label>
            <Input
              id="sale_price"
              type="number"
              step="0.01"
              value={form.sale_price}
              onChange={(e) =>
                setForm({ ...form, sale_price: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stock_qty">Stock Qty</Label>
            <Input
              id="stock_qty"
              type="number"
              value={form.stock_qty}
              onChange={(e) =>
                setForm({ ...form, stock_qty: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dimensions">Dimensions</Label>
            <Input
              id="dimensions"
              placeholder="e.g. 120 x 60 x 75 cm"
              value={form.dimensions}
              onChange={(e) =>
                setForm({ ...form, dimensions: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lead_time_days">Lead Time (days)</Label>
            <Input
              id="lead_time_days"
              type="number"
              min="0"
              value={form.lead_time_days}
              onChange={(e) =>
                setForm({ ...form, lead_time_days: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              0 = ready to ship now. E.g. 60 for a ~2 month wait.
            </p>
          </div>
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>
          <div className="col-span-2 grid gap-2">
            <Label>Images</Label>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3 pb-1">
                {images.map((filename) => (
                  <div key={filename} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getProductImageUrl(filename)}
                      alt={filename}
                      className="h-16 w-16 rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(filename)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                      title={`Remove ${filename}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="file"
                multiple
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setImagePickerOpen(true)}
              >
                Choose from library
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload new photos, or choose ones already on the server (e.g.
              from a previous mass upload).
            </p>
          </div>
          <div className="col-span-2 grid gap-2">
            <Label>Product Video</Label>
            {video && (
              <div className="relative w-40">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={getProductVideoUrl(video)}
                  className="aspect-square w-40 rounded border object-cover"
                  muted
                  controls
                />
                <button
                  type="button"
                  onClick={() => setVideo(null)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  title="Remove video"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                disabled={uploadingVideo}
                onChange={(e) => {
                  handleVideoUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setVideoPickerOpen(true)}
              >
                Choose from library
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              One video, max 10MB (MP4, WebM, or MOV), or choose one already
              on the server. Shown as the last gallery thumbnail on the
              product page.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="featured_tag">Featured</Label>
            <Select
              value={form.featured_tag_id}
              onValueChange={(v) => setForm({ ...form, featured_tag_id: v ?? "none" })}
            >
              <SelectTrigger id="featured_tag">
                <SelectValue placeholder="Not featured" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not featured</SelectItem>
                {featuredTags.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.label}
                    {!t.is_active ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={form.is_active}
              onCheckedChange={(v) =>
                setForm({ ...form, is_active: v === true })
              }
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ImageGalleryDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onSelect={(filename) => addImages([filename])}
      />
      <VideoGalleryDialog
        open={videoPickerOpen}
        onOpenChange={setVideoPickerOpen}
        onSelect={setVideo}
      />
    </Dialog>
  );
}
