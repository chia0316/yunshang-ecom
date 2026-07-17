"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
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
import { apiFetch, getProductImageUrl } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

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
  weight_kg: "",
  lead_time_days: "0",
  tags: "",
  is_featured: false,
  is_active: true,
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
  const [manualFilename, setManualFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
        weight_kg: product.weight_kg || "",
        lead_time_days: String(product.lead_time_days ?? 0),
        tags: product.tags.join(", "),
        is_featured: product.is_featured,
        is_active: product.is_active,
      });
      setImages(product.image_filenames);
    } else {
      setForm(emptyForm);
      setImages([]);
    }
    setManualFilename("");
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

  const handleAddManualFilename = () => {
    const filename = manualFilename.trim();
    if (!filename) return;
    addImages([filename]);
    setManualFilename("");
  };

  const handleManualFilenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddManualFilename();
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
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        lead_time_days: parseInt(form.lead_time_days || "0", 10),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        image_filenames: images,
        is_featured: form.is_featured,
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
            <Label htmlFor="weight_kg">Weight (kg)</Label>
            <Input
              id="weight_kg"
              type="number"
              step="0.01"
              value={form.weight_kg}
              onChange={(e) =>
                setForm({ ...form, weight_kg: e.target.value })
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
            <div className="flex gap-2">
              <Input
                placeholder="Or add an existing filename already on the server"
                value={manualFilename}
                onChange={(e) => setManualFilename(e.target.value)}
                onKeyDown={handleManualFilenameKeyDown}
              />
              <Button type="button" variant="outline" onClick={handleAddManualFilename}>
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload new photos, or add a filename that already exists in the
              image folder (e.g. from a previous mass upload).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_featured"
              checked={form.is_featured}
              onCheckedChange={(v) =>
                setForm({ ...form, is_featured: v === true })
              }
            />
            <Label htmlFor="is_featured">Featured</Label>
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
    </Dialog>
  );
}
