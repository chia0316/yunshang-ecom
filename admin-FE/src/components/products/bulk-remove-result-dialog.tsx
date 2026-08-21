"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BulkRemoveResponse } from "@/lib/types";

interface BulkRemoveResultDialogProps {
  result: BulkRemoveResponse | null;
  onClose: () => void;
}

const STATUS_VARIANT = {
  deleted: "secondary",
  deactivated: "warning",
  error: "destructive",
} as const;

export function BulkRemoveResultDialog({ result, onClose }: BulkRemoveResultDialogProps) {
  return (
    <Dialog open={!!result} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remove results</DialogTitle>
        </DialogHeader>

        {result && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{result.summary.deleted} deleted</Badge>
              {result.summary.deactivated > 0 && (
                <Badge variant="warning">
                  {result.summary.deactivated} deactivated (has order history)
                </Badge>
              )}
              {result.summary.errors > 0 && (
                <Badge variant="destructive">{result.summary.errors} errors</Badge>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto rounded border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-40">SKU</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.report.map((row, i) => (
                    <TableRow key={`${row.sku}-${i}`}>
                      <TableCell className="whitespace-normal break-words font-mono text-xs">
                        {row.sku}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words text-muted-foreground">
                        {row.message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
