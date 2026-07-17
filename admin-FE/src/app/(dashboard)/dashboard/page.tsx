"use client";

import { useEffect, useState } from "react";
import { Users, ShoppingCart, DollarSign, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Analytics {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  newLogins: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Analytics>("/admin/dashboard/analytics")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "Total Customers",
      value: data?.totalCustomers,
      icon: Users,
    },
    {
      label: "Total Orders",
      value: data?.totalOrders,
      icon: ShoppingCart,
    },
    {
      label: "Total Revenue",
      value:
        data?.totalRevenue !== undefined
          ? `$${Number(data.totalRevenue).toFixed(2)}`
          : undefined,
      icon: DollarSign,
    },
    {
      label: "Recent Logins",
      value: data?.newLogins,
      icon: LogIn,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your store&apos;s activity
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stat.value ?? "—"}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
