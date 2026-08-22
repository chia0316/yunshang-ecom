"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Pagination } from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api";
import { useConfirm } from "@/components/confirm-provider";
import type { Coupon } from "@/lib/types";

const PAGE_SIZE = 20;

const emptyForm = {
  code: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "",
  min_order_amount: "",
  max_uses: "",
  expires_at: "",
  visibility: "public" as "public" | "exclusive",
};

export default function CouponsPage() {
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCoupons = () => {
    setLoading(true);
    apiFetch<{ total_pages: number; total: number; data: Coupon[] }>(
      `/api/coupons?page=${page}&page_size=${PAGE_SIZE}`
    )
      .then((res) => {
        setCoupons(res.data);
        setTotalPages(res.total_pages);
        setTotal(res.total);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load coupons"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  // Coupon code itself is immutable once created (order history references
  // it) — editing only touches the rules, not the code string.
  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount || "",
      max_uses: coupon.max_uses !== null ? String(coupon.max_uses) : "",
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : "",
      visibility: coupon.visibility,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at || null,
        visibility: form.visibility,
      };
      if (editing) {
        const { code: _code, ...updates } = payload;
        void _code;
        await apiFetch(`/api/coupons/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        toast.success("Coupon updated");
      } else {
        await apiFetch("/api/coupons", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Coupon created");
      }
      setDialogOpen(false);
      loadCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      await apiFetch(`/api/coupons/${coupon.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      loadCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    const ok = await confirm({
      title: `Delete coupon "${coupon.code}"?`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/coupons/${coupon.id}`, { method: "DELETE" });
      toast.success("Coupon deleted");
      loadCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Coupons</h1>
          <p className="text-sm text-muted-foreground">
            Discount codes customers can apply at checkout
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Coupon
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min Order</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Visibility</TableHead>
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
            ) : coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No coupons yet.
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-medium">{coupon.code}</TableCell>
                  <TableCell>
                    {coupon.discount_type === "percent"
                      ? `${Number(coupon.discount_value)}%`
                      : `$${Number(coupon.discount_value).toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    {coupon.min_order_amount ? `$${Number(coupon.min_order_amount).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {coupon.used_count}
                    {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ""}
                  </TableCell>
                  <TableCell>
                    {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={coupon.visibility === "public" ? "outline" : "info"}>
                      {coupon.visibility === "public" ? "Public" : "Exclusive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={coupon.is_active ? "success" : "secondary"}>
                      {coupon.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(coupon)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(coupon)}>
                          {coupon.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(coupon)}
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

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "Add coupon"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="coupon-code">Code *</Label>
              <Input
                id="coupon-code"
                placeholder="e.g. WELCOME10"
                value={form.code}
                disabled={Boolean(editing)}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="coupon-type">Discount Type</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) => setForm({ ...form, discount_type: v as "percent" | "fixed" })}
                >
                  <SelectTrigger id="coupon-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent off</SelectItem>
                    <SelectItem value="fixed">Fixed amount off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coupon-value">
                  {form.discount_type === "percent" ? "Percent (%)" : "Amount ($)"} *
                </Label>
                <Input
                  id="coupon-value"
                  type="number"
                  min="0"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use 0 for a tracking-only code (e.g. per influencer/agent) —
                  it applies no discount but still records which code was
                  used on each order.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="coupon-min">Min Order Amount</Label>
                <Input
                  id="coupon-min"
                  type="number"
                  min="0"
                  placeholder="No minimum"
                  value={form.min_order_amount}
                  onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coupon-max-uses">Max Uses</Label>
                <Input
                  id="coupon-max-uses"
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coupon-visibility">Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => setForm({ ...form, visibility: v as "public" | "exclusive" })}
              >
                <SelectTrigger id="coupon-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="exclusive">Exclusive</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Exclusive codes still work at checkout — just share them
                privately (e.g. by email) instead of listing them publicly.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coupon-expires">Expires On</Label>
              <Input
                id="coupon-expires"
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.code || !form.discount_value}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
