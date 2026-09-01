"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export function GeneralSection() {
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [slotsPerHour, setSlotsPerHour] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [savingSlots, setSavingSlots] = useState(false);

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/settings")
      .then((settings) => {
        setFreeDeliveryThreshold(settings.free_delivery_threshold ?? "");
        setSlotsPerHour(settings.appointment_slots_per_hour ?? "1");
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => {
        setLoading(false);
        setLoadingSlots(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings/free_delivery_threshold", {
        method: "PATCH",
        body: JSON.stringify({ value: freeDeliveryThreshold }),
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlots = async () => {
    setSavingSlots(true);
    try {
      await apiFetch("/api/settings/appointment_slots_per_hour", {
        method: "PATCH",
        body: JSON.stringify({ value: slotsPerHour }),
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingSlots(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Shipping</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="free-delivery-threshold">Free Delivery Threshold ($)</Label>
            <Input
              id="free-delivery-threshold"
              type="number"
              min="0"
              disabled={loading}
              value={freeDeliveryThreshold}
              onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Orders at or above this subtotal get free delivery on the storefront.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || loading} className="w-fit">
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Appointments</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="appointment-slots-per-hour">Bookings Allowed Per Hour</Label>
            <Input
              id="appointment-slots-per-hour"
              type="number"
              min="1"
              step="1"
              disabled={loadingSlots}
              value={slotsPerHour}
              onChange={(e) => setSlotsPerHour(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              How many showroom appointments customers can book in the same hourly slot on the
              Visit Us page.
            </p>
          </div>
          <Button onClick={handleSaveSlots} disabled={savingSlots || loadingSlots} className="w-fit">
            {savingSlots ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
