"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  ArrowRight,
  Clock,
  AlertTriangle,
  MessageCircleQuestion,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

// A single clickable alert in the "Needs attention" row — amber when there's
// something to act on, quiet/neutral at zero so it doesn't compete for
// attention when there's genuinely nothing to do.
function AttentionItem({
  href,
  icon: Icon,
  label,
  count,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  count: number | undefined;
}) {
  const active = (count ?? 0) > 0;
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
        active
          ? "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
          : "hover:bg-muted/50"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-amber-600" : "text-muted-foreground")} />
      <div className="min-w-0">
        <div className={cn("text-xl font-bold leading-none", active && "text-amber-900 dark:text-amber-200")}>
          {count ?? "—"}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}

// The bordered-box-with-header-bar convention, for the two detail tables
// that deserve real visual weight (what's actually selling, by category).
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
      apiFetch<DashboardAnalytics>("/api/admin/dashboard/analytics"),
      apiFetch<SalesReport>(`/api/reports/sales?${params.toString()}`),
    ])
      .then(([analytics, salesReport]) => {
        setData(analytics);
        setSales(salesReport);
      })
      .finally(() => setLoading(false));
  }, []);

  const openEnquiries = data ? data.enquiryStatusBreakdown.new + data.enquiryStatusBreakdown.contacted : undefined;

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
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your store&apos;s activity
        </p>
      </div>

      {/* What needs a look today — the one place the eye should land first. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <AttentionItem
          href="/orders"
          icon={Clock}
          label="Pending orders"
          count={data?.orderStatusBreakdown.pending}
        />
        <AttentionItem
          href="/products"
          icon={AlertTriangle}
          label="Low stock products"
          count={data?.lowStockProducts.length}
        />
        <AttentionItem
          href="/enquiries"
          icon={MessageCircleQuestion}
          label="Open enquiries"
          count={openEnquiries}
        />
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

      <div className="grid gap-6 lg:grid-cols-2">
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
      </div>

      {/* Quieter, supplementary detail — same info as before, just no longer
          competing at the same visual weight as the sections above. */}
      <div className="rounded-md border">
        <div className="grid divide-y text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Orders by status</span>
              <Link href="/orders" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {!data
                ? null
                : (Object.keys(data.orderStatusBreakdown) as OrderStatus[]).map((status) => (
                    <Badge key={status} variant={ORDER_STATUS_VARIANT[status]}>
                      {status} {data.orderStatusBreakdown[status]}
                    </Badge>
                  ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Coupons</span>
              <Link href="/coupons" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            {data && (
              <div className="flex flex-col gap-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Active</span>
                  <span className="font-medium text-foreground">{data.activeCoupons}</span>
                </div>
                <div className="flex justify-between">
                  <span>Redemptions</span>
                  <span className="font-medium text-foreground">{data.couponRedemptions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Most used</span>
                  <span className="font-medium text-foreground">
                    {data.topCoupon ? `${data.topCoupon.code} (${data.topCoupon.usedCount})` : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Enquiries by status</span>
              <Link href="/enquiries" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {!data
                ? null
                : (Object.keys(data.enquiryStatusBreakdown) as EnquiryStatus[]).map((status) => (
                    <Badge key={status} variant={ENQUIRY_STATUS_VARIANT[status]}>
                      {status} {data.enquiryStatusBreakdown[status]}
                    </Badge>
                  ))}
            </div>
            {data && (
              <span className="text-xs text-muted-foreground">
                {data.recentEnquiries} new in the last 7 days
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
