"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { BulkUploadResponse } from "@/lib/types";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResponse | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiFetch<BulkUploadResponse>(
        "/api/products/bulk-upload",
        { method: "POST", body }
      );
      setResult(res);
      onUploaded();

      if (res.summary.errors === 0) {
        toast.success(
          `Upload complete — ${res.summary.created} created, ${res.summary.updated} updated`
        );
        // Give the admin a moment to register the success toast, then close
        // automatically — no errors to review, so there's nothing left to do here.
        setTimeout(() => handleClose(false), 1200);
      } else {
        toast.warning(
          `${res.summary.created} created, ${res.summary.updated} updated, ${res.summary.errors} row(s) need attention`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFile(null);
      setResult(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mass upload products</DialogTitle>
          <DialogDescription>
            Upload the product listing Excel/CSV template. Existing SKUs are
            updated, new SKUs are created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          {result && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 text-sm">
                <Badge variant="secondary">
                  {result.summary.created} created
                </Badge>
                <Badge variant="secondary">
                  {result.summary.updated} updated
                </Badge>
                {result.summary.errors > 0 && (
                  <Badge variant="destructive">
                    {result.summary.errors} errors
                  </Badge>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.report.map((row) => (
                      <TableRow key={row.row}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
