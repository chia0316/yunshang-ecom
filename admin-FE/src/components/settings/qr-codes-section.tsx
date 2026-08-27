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
import { apiFetch, apiUpload, getQrCodeImageUrl } from "@/lib/api";
import { useConfirm } from "@/components/confirm-provider";
import { getQrCodeStatus, QR_CODE_STATUS_VARIANT } from "@/lib/qrCodeStatus";
import type { QrCode } from "@/lib/types";

const emptyForm = { name: "", valid_from: "", valid_until: "" };

export function QrCodesSection() {
  const confirm = useConfirm();
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const loadQrCodes = () => {
    setLoading(true);
    apiFetch<QrCode[]>("/api/qrcodes")
      .then(setQrCodes)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load QR codes"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQrCodes();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setImageFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!imageFile || !form.name || !form.valid_from || !form.valid_until) return;
    setSaving(true);
    try {
      const body = new FormData();
      body.append("image", imageFile);
      body.append("name", form.name);
      body.append("valid_from", form.valid_from);
      body.append("valid_until", form.valid_until);
      await apiUpload("/api/qrcodes", body);
      toast.success("QR code added");
      setDialogOpen(false);
      loadQrCodes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (qrCode: QrCode) => {
    const ok = await confirm({
      title: `Revoke "${qrCode.name}"?`,
      description: "It will stop being sent to newly confirmed appointments immediately, even if it hasn't reached its Valid Until date yet.",
      confirmLabel: "Revoke",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/qrcodes/${qrCode.id}/revoke`, { method: "PATCH" });
      toast.success("QR code revoked");
      loadQrCodes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke failed");
    }
  };

  const handleDelete = async (qrCode: QrCode) => {
    const status = getQrCodeStatus(qrCode);
    const ok = await confirm({
      title: `Delete "${qrCode.name}"?`,
      description:
        status === "Active now" || status === "Expiring soon"
          ? "This code is currently active — deleting it removes it from the pool immediately. Past appointments it was already sent to keep their record of it."
          : "Past appointments it was already sent to keep their record of it.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/qrcodes/${qrCode.id}`, { method: "DELETE" });
      toast.success("QR code deleted");
      loadQrCodes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage the shared entry-gate QR codes emailed to customers when their appointment is
          confirmed. Whichever code is currently active (by date) is the one sent.
        </p>
        <div className="flex gap-2">
          {/* Bulk upload removed from the UI (not tested yet) — the
              backend routes and QrBulkUploadDialog component are still
              there, untouched, for whenever this gets re-enabled. */}
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add QR Code
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Valid From</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : qrCodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No QR codes yet.
                </TableCell>
              </TableRow>
            ) : (
              qrCodes.map((qrCode) => {
                const status = getQrCodeStatus(qrCode);
                return (
                  <TableRow key={qrCode.id}>
                    <TableCell>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getQrCodeImageUrl(qrCode.image_filename)}
                        alt={qrCode.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{qrCode.name}</TableCell>
                    <TableCell>{new Date(qrCode.valid_from).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(qrCode.valid_until).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={QR_CODE_STATUS_VARIANT[status]}>{status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {status !== "Expired" && status !== "Revoked" && (
                            <DropdownMenuItem onClick={() => handleRevoke(qrCode)}>
                              Revoke
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem variant="destructive" onClick={() => handleDelete(qrCode)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add QR code</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="qr-name">Name *</Label>
              <Input
                id="qr-name"
                placeholder="e.g. January gate code"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qr-image">Image *</Label>
              <Input
                id="qr-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="qr-valid-from">Valid From *</Label>
                <Input
                  id="qr-valid-from"
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qr-valid-until">Valid Until *</Label>
                <Input
                  id="qr-valid-until"
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !imageFile || !form.name || !form.valid_from || !form.valid_until}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
