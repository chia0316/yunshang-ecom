"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { useConfirm } from "@/components/confirm-provider";
import type { ProductFeaturedTag } from "@/lib/types";

export function FeaturedTagsSection() {
  const confirm = useConfirm();
  const [tags, setTags] = useState<ProductFeaturedTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductFeaturedTag | null>(null);
  const [form, setForm] = useState({ label: "", sort_order: "0" });
  const [saving, setSaving] = useState(false);

  const loadTags = () => {
    setLoading(true);
    apiFetch<ProductFeaturedTag[]>("/api/product-featured-tags")
      .then(setTags)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTags();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ label: "", sort_order: String(tags.length + 1) });
    setDialogOpen(true);
  };

  const openEdit = (tag: ProductFeaturedTag) => {
    setEditing(tag);
    setForm({
      label: tag.label,
      sort_order: String(tag.sort_order),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        label: form.label,
        sort_order: parseInt(form.sort_order || "0", 10),
      };
      if (editing) {
        await apiFetch(`/api/product-featured-tags/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Featured tag updated");
      } else {
        await apiFetch("/api/product-featured-tags", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Featured tag created");
      }
      setDialogOpen(false);
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tag: ProductFeaturedTag) => {
    try {
      await apiFetch(`/api/product-featured-tags/${tag.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !tag.is_active }),
      });
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleDelete = async (tag: ProductFeaturedTag) => {
    const ok = await confirm({
      title: `Delete featured tag "${tag.label}"?`,
      description: "Products currently using it will just lose the tag.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/product-featured-tags/${tag.id}`, { method: "DELETE" });
      toast.success("Featured tag deleted");
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage the tags (e.g. Bestseller, New Arrival) admins can assign to
          products. These also populate the Featured? dropdown in the
          bulk-upload template.
        </p>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tag
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No featured tags yet.
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.label}</TableCell>
                  <TableCell>{tag.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={tag.is_active ? "success" : "secondary"}>
                      {tag.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tag)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(tag)}>
                          {tag.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(tag)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit featured tag" : "Add featured tag"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="tag-label">Label *</Label>
              <Input
                id="tag-label"
                placeholder="e.g. Bestseller"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tag-order">Sort Order</Label>
              <Input
                id="tag-order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.label}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
