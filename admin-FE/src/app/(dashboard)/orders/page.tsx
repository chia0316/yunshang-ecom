"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Truck, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiDownload } from "@/lib/api";
import type { Order } from "@/lib/types";

const STATUS_OPTIONS: Order["status"][] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_VARIANT: Record<
  Order["status"],
  "outline" | "info" | "warning" | "success" | "destructive"
> = {
  pending: "outline",
  paid: "info",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "destructive",
};

const PAYMENT_STATUS_VARIANT: Record<
  string,
  "outline" | "info" | "warning" | "success" | "destructive"
> = {
  pending: "outline",
  completed: "success",
  failed: "destructive",
  refunded: "warning",
};

const CASH_PAYMENT_DAYS = 7;

function isCashPaymentOverdue(order: Order): boolean {
  const payment = order.payments?.[0];
  if (!payment || payment.method !== "Cash" || payment.status !== "pending") {
    return false;
  }
  const dueAt = new Date(order.created_at);
  dueAt.setDate(dueAt.getDate() + CASH_PAYMENT_DAYS);
  return new Date() > dueAt;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const [deliveryDialogOrder, setDeliveryDialogOrder] = useState<Order | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_date: "",
    delivery_slot: "",
    remarks: "",
  });
  const [savingDelivery, setSavingDelivery] = useState(false);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }, [statusFilter, search, from, to]);

  const loadOrders = useCallback(() => {
    setLoading(true);
    apiFetch<Order[]>(`/api/orders?${buildParams().toString()}`)
      .then(setOrders)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to load orders")
      )
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleStatusChange = async (order: Order, status: Order["status"]) => {
    try {
      await apiFetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Order #${order.id} updated to ${status}`);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status } : o))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleMarkPaid = async (order: Order) => {
    const payment = order.payments?.[0];
    if (!payment) return;
    try {
      await apiFetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      toast.success(`Payment for order #${order.id} marked as received`);
      loadOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchInput("");
    setSearch("");
    setFrom("");
    setTo("");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await apiDownload(
        `/api/orders/export?${buildParams().toString()}`,
        `orders-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const openDeliveryDialog = (order: Order) => {
    setDeliveryDialogOrder(order);
    setDeliveryForm({
      delivery_date: order.delivery?.delivery_date?.slice(0, 10) || "",
      delivery_slot: order.delivery?.delivery_slot || "",
      remarks: order.delivery?.remarks || "",
    });
  };

  const handleSaveDelivery = async () => {
    if (!deliveryDialogOrder) return;
    setSavingDelivery(true);
    try {
      await apiFetch(`/api/orders/${deliveryDialogOrder.id}/delivery`, {
        method: "PATCH",
        body: JSON.stringify({
          delivery_date: deliveryForm.delivery_date || null,
          delivery_slot: deliveryForm.delivery_slot || null,
          remarks: deliveryForm.remarks || null,
        }),
      });
      toast.success(`Delivery info updated for order #${deliveryDialogOrder.id}`);
      setDeliveryDialogOrder(null);
      loadOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingDelivery(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Track and update customer orders
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger id="status-filter" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <form onSubmit={handleSearchSubmit} className="grid gap-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Customer name, email, or order # (Enter to search)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-72"
          />
        </form>
        <div className="grid gap-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Coupon</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No orders match these filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">
                    #{order.id}
                  </TableCell>
                  <TableCell>
                    {order.user
                      ? `${order.user.firstName} ${order.user.lastName}`
                      : `User #${order.user_id}`}
                    <div className="text-xs text-muted-foreground">
                      {order.user?.email}
                    </div>
                  </TableCell>
                  <TableCell>${Number(order.total_price).toFixed(2)}</TableCell>
                  <TableCell>
                    {order.coupon_code ? (
                      <div className="text-xs">
                        <span className="font-mono">{order.coupon_code}</span>
                        <div className="text-muted-foreground">
                          -${Number(order.discount_amount ?? 0).toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.payments && order.payments.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span>{order.payments[0].method}</span>
                          <Badge variant={PAYMENT_STATUS_VARIANT[order.payments[0].status] ?? "outline"}>
                            {order.payments[0].status}
                          </Badge>
                        </div>
                        {isCashPaymentOverdue(order) && (
                          <Badge variant="destructive" className="w-fit">
                            Overdue
                          </Badge>
                        )}
                        {(order.payments[0].method === "Cash" || order.payments[0].method === "PayNow") &&
                          order.payments[0].status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleMarkPaid(order)}
                            >
                              Mark as Paid
                            </Button>
                          )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(v) =>
                        handleStatusChange(order, v as Order["status"])
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue>
                          <Badge variant={STATUS_VARIANT[order.status]}>
                            {order.status}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeliveryDialog(order)}
                        title="Set delivery date"
                      >
                        <Truck className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        render={<Link href={`/orders/${order.id}/document`} target="_blank" />}
                        title="View Invoice / Delivery Order"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(deliveryDialogOrder)}
        onOpenChange={(open) => !open && setDeliveryDialogOrder(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delivery info — Order #{deliveryDialogOrder?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Record the date/slot agreed with the customer over WhatsApp, email, or call.
              This appears on the invoice / delivery order document.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="delivery-date">Delivery Date</Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={deliveryForm.delivery_date}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="delivery-slot">Delivery Slot</Label>
                <Input
                  id="delivery-slot"
                  placeholder="e.g. Afternoon"
                  value={deliveryForm.delivery_slot}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, delivery_slot: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="delivery-remarks">Remarks</Label>
              <Textarea
                id="delivery-remarks"
                value={deliveryForm.remarks}
                onChange={(e) =>
                  setDeliveryForm({ ...deliveryForm, remarks: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialogOrder(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDelivery} disabled={savingDelivery}>
              {savingDelivery ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
