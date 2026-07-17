"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { SalesReport } from "@/lib/types";

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

export default function SalesReportPage() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [from, setFrom] = useState(toDateInput(monthAgo));
  const [to, setTo] = useState(toDateInput(today));
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, groupBy });
    apiFetch<SalesReport>(`/api/reports/sales?${params.toString()}`)
      .then(setReport)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [from, to, groupBy]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const stats = [
    {
      label: "Total Revenue",
      value: report ? `$${report.summary.totalRevenue.toFixed(2)}` : undefined,
      icon: DollarSign,
    },
    {
      label: "Orders",
      value: report?.summary.orderCount,
      icon: ShoppingCart,
    },
    {
      label: "Average Order Value",
      value: report ? `$${report.summary.averageOrderValue.toFixed(2)}` : undefined,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales Report</h1>
        <p className="text-sm text-muted-foreground">Revenue and order trends over time</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="groupBy">Group By</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger id="groupBy" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "…" : (stat.value ?? "—")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border">
          <div className="border-b px-4 py-3 font-medium">Revenue over time</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!report || report.series.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {loading ? "Loading..." : "No sales in this range."}
                  </TableCell>
                </TableRow>
              ) : (
                report.series.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell>{new Date(row.period).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{row.orderCount}</TableCell>
                    <TableCell className="text-right">${row.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-md border">
          <div className="border-b px-4 py-3 font-medium">Top products</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!report || report.topProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {loading ? "Loading..." : "No sales in this range."}
                  </TableCell>
                </TableRow>
              ) : (
                report.topProducts.map((row) => (
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
        </div>
      </div>
    </div>
  );
}
