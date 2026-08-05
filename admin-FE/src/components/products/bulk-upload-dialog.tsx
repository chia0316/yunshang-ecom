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
import { Download } from "lucide-react";
import { apiFetch, apiDownload } from "@/lib/api";
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
  const [imagesZip, setImagesZip] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [result, setResult] = useState<BulkUploadResponse | null>(null);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await apiDownload(
        "/api/products/bulk-upload/template",
        "product-bulk-upload-template.xlsx"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      if (imagesZip) body.append("imagesZip", imagesZip);
      const res = await apiFetch<BulkUploadResponse>(
        "/api/products/bulk-upload",
        { method: "POST", body }
      );
      setResult(res);
      onUploaded();

      const hasImageIssues = res.report.some((row) => row.imageIssues && row.imageIssues.length > 0);
      const hasZipIssues = res.zipReport && res.zipReport.length > 0;

      if (res.summary.errors === 0 && !hasImageIssues && !hasZipIssues) {
        toast.success(
          `Upload complete — ${res.summary.created} created, ${res.summary.updated} updated`
        );
        // Give the admin a moment to register the success toast, then close
        // automatically — no errors to review, so there's nothing left to do here.
        setTimeout(() => handleClose(false), 1200);
      } else {
        toast.warning(
          `${res.summary.created} created, ${res.summary.updated} updated — review the report below`
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
      setImagesZip(null);
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
            updated, new SKUs are created. Reference photos in the Image List
            column and upload them together as a ZIP below — filenames must
            match exactly.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
          >
            <Download className="mr-2 h-4 w-4" />
            {downloadingTemplate ? "Downloading..." : "Download template"}
          </Button>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Product listing (.xlsx/.xls/.csv)</label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Images ZIP (optional)</label>
            <Input
              type="file"
              accept=".zip"
              onChange={(e) => setImagesZip(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, JPEG, or WEBP only — other files inside the ZIP are
              skipped and reported below.
            </p>
          </div>

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
                          {row.imageIssues && row.imageIssues.length > 0 && (
                            <ul className="mt-1 list-disc pl-4 text-xs text-destructive">
                              {row.imageIssues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {result.zipReport && result.zipReport.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Images ZIP report</p>
                  <div className="max-h-48 overflow-y-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.zipReport.map((entry, i) => (
                          <TableRow key={`${entry.filename}-${i}`}>
                            <TableCell>{entry.filename}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  entry.status === "skipped" ? "destructive" : "secondary"
                                }
                              >
                                {entry.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
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
