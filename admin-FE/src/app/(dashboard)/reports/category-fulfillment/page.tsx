"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { CategoryFulfillmentReport } from "@/lib/types";

export default function CategoryFulfillmentReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<CategoryFulfillmentReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    apiFetch<CategoryFulfillmentReport>(`/api/reports/category-fulfillment?${params.toString()}`)
      .then(setReport)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Category Fulfilment Report</h1>
        <p className="text-sm text-muted-foreground">
          Quantity ordered vs. delivered per category — balance is what&apos;s still owed to customers
        </p>
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
        <p className="pb-2 text-xs text-muted-foreground">
          Leave blank to include all-time data
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Balance to Fulfil</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !report || report.categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No data for this range.
                </TableCell>
              </TableRow>
            ) : (
              report.categories.map((row) => (
                <TableRow key={row.categoryId}>
                  <TableCell className="font-medium">{row.categoryName}</TableCell>
                  <TableCell className="text-right">{row.quantityOrdered}</TableCell>
                  <TableCell className="text-right">{row.quantityDelivered}</TableCell>
                  <TableCell className="text-right font-medium">
                    {row.balance > 0 ? row.balance : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
