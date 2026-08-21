"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Tag,
  Mail,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { DashboardAnalytics, SalesReport, OrderStatus, EnquiryStatus } from "@/lib/types";

const ORDER_STATUS_VARIANT: Record<
  OrderStatus,
  "outline" | "info" | "warning" | "success" | "destructive"
> = {
  pending: "outline",
  paid: "info",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "destructive",
};

const ENQUIRY_STATUS_VARIANT: Record<EnquiryStatus, "info" | "warning" | "success"> = {
  new: "info",
  contacted: "warning",
  closed: "success",
};

// Matches the bordered-box-with-header-bar convention already used on the
// Sales Report page, plus an optional link to the module's full page.
function ModuleCard({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-medium">{title}</span>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      groupBy: "day",
    });
    Promise.all([
      apiFetch<DashboardAnalytics>("/admin/dashboard/analytics"),
      apiFetch<SalesReport>(`/api/reports/sales?${params.toString()}`),
    ])
      .then(([analytics, salesReport]) => {
        setData(analytics);
        setSales(salesReport);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "Total Revenue",
      value: data ? `$${Number(data.totalRevenue).toFixed(2)}` : undefined,
      icon: DollarSign,
    },
    { label: "Total Orders", value: data?.totalOrders, icon: ShoppingCart },
    {
      label: "Total Customers",
      value: data ? `${data.totalCustomers} (+${data.newCustomers30d} this month)` : undefined,
      icon: Users,
    },
    { label: "Active Products", value: data?.activeProducts, icon: Package },
    { label: "Active Coupons", value: data?.activeCoupons, icon: Tag },
    {
      label: "Open Enquiries",
      value: data ? data.enquiryStatusBreakdown.new + data.enquiryStatusBreakdown.contacted : undefined,
      icon: Mail,
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <ModuleCard title="Orders by status" href="/reports/sales">
          <div className="flex flex-wrap gap-2 p-4">
            {!data ? (
              <span className="text-sm text-muted-foreground">
                {loading ? "Loading..." : "No data."}
              </span>
            ) : (
              (Object.keys(data.orderStatusBreakdown) as OrderStatus[]).map((status) => (
                <div key={status} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                  <Badge variant={ORDER_STATUS_VARIANT[status]}>{status}</Badge>
                  <span className="text-sm font-medium">{data.orderStatusBreakdown[status]}</span>
                </div>
              ))
            )}
          </div>
        </ModuleCard>

        <ModuleCard title="Top selling products (last 30 days)" href="/products">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!sales || sales.topProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {loading ? "Loading..." : "No sales in the last 30 days."}
                  </TableCell>
                </TableRow>
              ) : (
                sales.topProducts.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell>
                      {row.name}
                      <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                    </TableCell>
                    <TableCell className="text-right">{row.unitsSold}</TableCell>
                    <TableCell className="text-right">${row.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleCard>

        <ModuleCard title="Categories (last 30 days)" href="/reports/category-fulfillment">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.categoryBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {loading ? "Loading..." : "No categories yet."}
                  </TableCell>
                </TableRow>
              ) : (
                data.categoryBreakdown.map((row) => (
                  <TableRow key={row.categoryId}>
                    <TableCell>{row.categoryName}</TableCell>
                    <TableCell className="text-right">{row.productCount}</TableCell>
                    <TableCell className="text-right">${row.revenue30d.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleCard>

        <ModuleCard title="Low stock (5 or fewer)" href="/products">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.lowStockProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    {loading ? "Loading..." : "Nothing running low."}
                  </TableCell>
                </TableRow>
              ) : (
                data.lowStockProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.name}
                      <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={p.stock_qty === 0 ? "destructive" : "warning"}>
                        {p.stock_qty}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleCard>

        <ModuleCard title="Coupons" href="/coupons">
          <div className="flex flex-col gap-3 p-4">
            {!data ? (
              <span className="text-sm text-muted-foreground">
                {loading ? "Loading..." : "No data."}
              </span>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active coupons</span>
                  <span className="font-medium">{data.activeCoupons}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total redemptions</span>
                  <span className="font-medium">{data.couponRedemptions}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Most used</span>
                  <span className="font-medium">
                    {data.topCoupon
                      ? `${data.topCoupon.code} (${data.topCoupon.usedCount})`
                      : "—"}
                  </span>
                </div>
              </>
            )}
          </div>
        </ModuleCard>

        <ModuleCard title="Enquiries" href="/enquiries">
          <div className="flex flex-col gap-3 p-4">
            {!data ? (
              <span className="text-sm text-muted-foreground">
                {loading ? "Loading..." : "No data."}
              </span>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(data.enquiryStatusBreakdown) as EnquiryStatus[]).map((status) => (
                    <div key={status} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                      <Badge variant={ENQUIRY_STATUS_VARIANT[status]}>{status}</Badge>
                      <span className="text-sm font-medium">{data.enquiryStatusBreakdown[status]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New in the last 7 days</span>
                  <span className="font-medium">{data.recentEnquiries}</span>
                </div>
              </>
            )}
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}
