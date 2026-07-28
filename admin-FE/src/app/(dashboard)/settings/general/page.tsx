"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export default function GeneralSettingsPage() {
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/settings")
      .then((settings) => setFreeDeliveryThreshold(settings.free_delivery_threshold ?? ""))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">General Settings</h1>
        <p className="text-sm text-muted-foreground">
          Store-wide values used by the storefront
        </p>
      </div>

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
    </div>
  );
}
