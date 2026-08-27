"use client";

import { Settings as SettingsIcon, Truck, Star, QrCode } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralSection } from "@/components/settings/general-section";
import { DeliverySlotsSection } from "@/components/settings/delivery-slots-section";
import { FeaturedTagsSection } from "@/components/settings/featured-tags-section";
import { QrCodesSection } from "@/components/settings/qr-codes-section";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Store-wide configuration for the storefront and admin dashboard
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <SettingsIcon />
            General
          </TabsTrigger>
          <TabsTrigger value="delivery-slots">
            <Truck />
            Delivery Slots
          </TabsTrigger>
          <TabsTrigger value="featured-tags">
            <Star />
            Featured Tags
          </TabsTrigger>
          <TabsTrigger value="qr-codes">
            <QrCode />
            QR Codes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="pt-4">
          <GeneralSection />
        </TabsContent>
        <TabsContent value="delivery-slots" className="pt-4">
          <DeliverySlotsSection />
        </TabsContent>
        <TabsContent value="featured-tags" className="pt-4">
          <FeaturedTagsSection />
        </TabsContent>
        <TabsContent value="qr-codes" className="pt-4">
          <QrCodesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
