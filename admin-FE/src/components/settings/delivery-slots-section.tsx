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
import type { DeliverySlot } from "@/lib/types";

export function DeliverySlotsSection() {
  const confirm = useConfirm();
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliverySlot | null>(null);
  const [form, setForm] = useState({ name: "", time_range: "", sort_order: "0" });
  const [saving, setSaving] = useState(false);

  const loadSlots = () => {
    setLoading(true);
    apiFetch<DeliverySlot[]>("/api/delivery-slots")
      .then(setSlots)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", time_range: "", sort_order: String(slots.length + 1) });
    setDialogOpen(true);
  };

  const openEdit = (slot: DeliverySlot) => {
    setEditing(slot);
    setForm({
      name: slot.name,
      time_range: slot.time_range || "",
      sort_order: String(slot.sort_order),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        time_range: form.time_range || null,
        sort_order: parseInt(form.sort_order || "0", 10),
      };
      if (editing) {
        await apiFetch(`/api/delivery-slots/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Delivery slot updated");
      } else {
        await apiFetch("/api/delivery-slots", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Delivery slot created");
      }
      setDialogOpen(false);
      loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (slot: DeliverySlot) => {
    try {
      await apiFetch(`/api/delivery-slots/${slot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !slot.is_active }),
      });
      loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleDelete = async (slot: DeliverySlot) => {
    const ok = await confirm({
      title: `Delete delivery slot "${slot.name}"?`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/delivery-slots/${slot.id}`, { method: "DELETE" });
      toast.success("Delivery slot deleted");
      loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage the delivery time slots customers can choose at checkout
        </p>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Slot
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Time Range</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : slots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No delivery slots yet.
                </TableCell>
              </TableRow>
            ) : (
              slots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell className="font-medium">{slot.name}</TableCell>
                  <TableCell>{slot.time_range || "—"}</TableCell>
                  <TableCell>{slot.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={slot.is_active ? "success" : "secondary"}>
                      {slot.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(slot)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(slot)}>
                          {slot.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(slot)}
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
            <DialogTitle>{editing ? "Edit delivery slot" : "Add delivery slot"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="slot-name">Name *</Label>
              <Input
                id="slot-name"
                placeholder="e.g. Morning"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slot-range">Time Range</Label>
              <Input
                id="slot-range"
                placeholder="e.g. 9am - 12pm"
                value={form.time_range}
                onChange={(e) => setForm({ ...form, time_range: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slot-order">Sort Order</Label>
              <Input
                id="slot-order"
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
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
