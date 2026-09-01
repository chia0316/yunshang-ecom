"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Images, MoreHorizontal, Plus, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { apiFetch, getProductImageUrl } from "@/lib/api";
import { getContrastTextColor } from "@/lib/utils";
import type { BulkRemoveResponse, Category, Product } from "@/lib/types";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { BulkUploadDialog } from "@/components/products/bulk-upload-dialog";
import { ImageGalleryDialog } from "@/components/products/image-gallery-dialog";
import { BulkRemoveResultDialog } from "@/components/products/bulk-remove-result-dialog";
import { useConfirm } from "@/components/confirm-provider";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<BulkRemoveResponse | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadProducts = useCallback(async (searchText?: string, targetPage?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        includeInactive: "true",
        page_size: String(PAGE_SIZE),
        page: String(targetPage ?? 1),
      });
      if (searchText) params.set("searchText", searchText);
      const res = await apiFetch<{ data: Product[]; total: number; total_pages: number }>(
        `/api/products?${params.toString()}`
      );
      setProducts(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts(search, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    apiFetch<Category[]>("/api/category", { auth: false }).then(setCategories);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedIds(new Set());
    if (page === 1) {
      loadProducts(search, 1);
    } else {
      setPage(1);
    }
  };

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: `Delete "${product.name}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/products/${product.id}`, { method: "DELETE" });
      toast.success("Product deleted");
      loadProducts(search, page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Which variant's photo represents the whole group on the storefront
  // listing page — see PATCH /:id/set-primary-variant on the backend.
  const handleSetPrimaryVariant = async (product: Product) => {
    try {
      await apiFetch(`/api/products/${product.id}/set-primary-variant`, { method: "PATCH" });
      toast.success(`"${product.sku}" is now the listing photo for this group`);
      loadProducts(search, page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  // Groups variant rows (same product_handle) so they read as one product
  // with N variants instead of N unrelated-looking rows — display only,
  // doesn't touch the underlying flat list or how selection/actions work.
  // Rows without a handle (or an orphaned handle with only one row left)
  // keep their original position; rows sharing a handle become contiguous,
  // appearing at the position of the first member encountered.
  const displayRows = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      if (p.product_handle) counts.set(p.product_handle, (counts.get(p.product_handle) || 0) + 1);
    });

    // Which variant is *actually* the listing photo right now, per group —
    // mirrors the backend's fallback in routes/product.js exactly (explicit
    // is_primary_variant wins; otherwise the lowest-priced variant). Without
    // this, "Set as listing photo" would still show on the variant that's
    // already the de-facto listing photo whenever no one has explicitly set
    // one yet (the common case), since is_primary_variant alone is false
    // for every row in that group.
    const byHandle = new Map<string, Product[]>();
    products.forEach((p) => {
      if (!p.product_handle) return;
      if (!byHandle.has(p.product_handle)) byHandle.set(p.product_handle, []);
      byHandle.get(p.product_handle)!.push(p);
    });
    const effectivePrimaryId = new Map<string, number>();
    byHandle.forEach((members, handle) => {
      const flagged = members.find((m) => m.is_primary_variant);
      const winner =
        flagged ||
        members.reduce((lowest, m) => (Number(m.price) < Number(lowest.price) ? m : lowest));
      effectivePrimaryId.set(handle, winner.id);
    });

    const ordered: Product[] = [];
    const groupStartIndex = new Map<string, number>();
    products.forEach((p) => {
      if (!p.product_handle || (counts.get(p.product_handle) || 0) < 2) {
        ordered.push(p);
        return;
      }
      const startIdx = groupStartIndex.get(p.product_handle);
      if (startIdx === undefined) {
        ordered.push(p);
        groupStartIndex.set(p.product_handle, ordered.length - 1);
      } else {
        let insertAt = startIdx + 1;
        while (insertAt < ordered.length && ordered[insertAt].product_handle === p.product_handle) {
          insertAt++;
        }
        ordered.splice(insertAt, 0, p);
      }
    });

    return ordered.map((product, i) => ({
      product,
      groupSize: product.product_handle ? counts.get(product.product_handle) || 1 : 1,
      isFirstOfGroup: i === 0 || ordered[i - 1].product_handle !== product.product_handle,
      isEffectivePrimary: product.product_handle
        ? effectivePrimaryId.get(product.product_handle) === product.id
        : false,
    }));
  }, [products]);

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(products.map((p) => p.id)) : new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Delete ${selectedIds.size} selected product${selectedIds.size === 1 ? "" : "s"}?`,
      description:
        "Products with order history will be deactivated instead of deleted. This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await apiFetch<BulkRemoveResponse>("/api/products/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setDeleteResult(res);
      setSelectedIds(new Set());
      loadProducts(search, page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your furniture catalog
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGalleryOpen(true)}>
            <Images className="mr-2 h-4 w-4" />
            Image Gallery
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Mass Upload
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by name, SKU, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? "Deleting..." : "Delete Selected"}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={products.length > 0 && selectedIds.size === products.length}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-16">Image</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map(({ product, groupSize, isFirstOfGroup, isEffectivePrimary }) => {
                const isGrouped = groupSize > 1;
                const variantLabel = product.variant_options
                  ? Object.values(product.variant_options).join(", ")
                  : "Variant";
                return (
                  <TableRow key={product.id}>
                    <TableCell
                      className={isGrouped ? "border-l-2 border-l-primary" : undefined}
                    >
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={(checked) => toggleSelected(product.id, checked === true)}
                        aria-label={`Select ${product.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="relative h-10 w-10">
                        {product.image_filenames[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getProductImageUrl(product.image_filenames[0])}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted" />
                        )}
                        {isGrouped && isEffectivePrimary && (
                          <span
                            title="This variant's photo represents the group on the storefront listing"
                            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-white"
                          >
                            <Star className="h-2.5 w-2.5 fill-current" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {product.sku}
                    </TableCell>
                    <TableCell className="font-medium">
                      {isGrouped && !isFirstOfGroup && (
                        <span className="mr-1 text-muted-foreground">↳</span>
                      )}
                      {(!isGrouped || isFirstOfGroup) && product.name}
                      {isGrouped && isFirstOfGroup && (
                        <Badge variant="outline" className="ml-2">
                          {groupSize} variants
                        </Badge>
                      )}
                      {product.featured_tag && (
                        <Badge
                          className="ml-2"
                          style={{
                            backgroundColor: product.featured_tag.color,
                            color: getContrastTextColor(product.featured_tag.color),
                          }}
                        >
                          {product.featured_tag.label}
                        </Badge>
                      )}
                      {product.lead_time_days > 0 && (
                        <Badge variant="info" className="ml-2">
                          {product.lead_time_days}d lead time
                        </Badge>
                      )}
                      {product.product_handle && (
                        <Badge variant="secondary" className="ml-2" title={`Variant of "${product.product_handle}"`}>
                          {variantLabel}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{product.category?.name || "—"}</TableCell>
                    <TableCell>
                      {product.sale_price ? (
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground line-through">
                            ${Number(product.price).toFixed(2)}
                          </span>
                          <span className="font-medium">
                            ${Number(product.sale_price).toFixed(2)}
                          </span>
                        </span>
                      ) : (
                        `$${Number(product.price).toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "success" : "secondary"}>
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(product);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          {isGrouped && !isEffectivePrimary && (
                            <DropdownMenuItem onClick={() => handleSetPrimaryVariant(product)}>
                              Set as listing photo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(product)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        product={editing}
        onSaved={() => loadProducts(search, page)}
      />
      <BulkUploadDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onUploaded={() => loadProducts(search, page)}
      />
      <ImageGalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen} />
      <BulkRemoveResultDialog result={deleteResult} onClose={() => setDeleteResult(null)} />
    </div>
  );
}
