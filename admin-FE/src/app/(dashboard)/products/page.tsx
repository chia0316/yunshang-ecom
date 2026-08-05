"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Images, MoreHorizontal, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch, getProductImageUrl } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { BulkUploadDialog } from "@/components/products/bulk-upload-dialog";
import { ImageGalleryDialog } from "@/components/products/image-gallery-dialog";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const loadProducts = useCallback(async (searchText?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        includeInactive: "true",
        page_size: "100",
      });
      if (searchText) params.set("searchText", searchText);
      const res = await apiFetch<{ data: Product[] }>(
        `/api/products?${params.toString()}`
      );
      setProducts(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    apiFetch<Category[]>("/api/category", { auth: false }).then(setCategories);
  }, [loadProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(search);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/products/${product.id}`, { method: "DELETE" });
      toast.success("Product deleted");
      loadProducts(search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
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
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {product.sku}
                  </TableCell>
                  <TableCell className="font-medium">
                    {product.name}
                    {product.is_featured && (
                      <Badge variant="warning" className="ml-2">
                        Featured
                      </Badge>
                    )}
                    {product.lead_time_days > 0 && (
                      <Badge variant="info" className="ml-2">
                        {product.lead_time_days}d lead time
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
                  <TableCell>{product.stock_qty}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        product={editing}
        onSaved={() => loadProducts(search)}
      />
      <BulkUploadDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onUploaded={() => loadProducts(search)}
      />
      <ImageGalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen} />
    </div>
  );
}
