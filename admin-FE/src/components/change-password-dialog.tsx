"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

const emptyForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Admin accounts are just User rows with isAdmin: true, and
// PUT /api/user/update-password (cust-admin-BE/controllers/user.js) already
// operates generically on req.userId with no admin/customer distinction —
// this was only ever missing as a customer-only *page*, not a backend
// capability, so no backend changes were needed for this.
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) setForm(emptyForm);
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/user/update-password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      toast.success("Password updated");
      handleClose(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Minimum eight characters, with at least one letter, one number, and one special
            character.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.currentPassword || !form.newPassword || !form.confirmPassword}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
