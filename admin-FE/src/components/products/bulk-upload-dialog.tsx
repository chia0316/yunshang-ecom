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
import type { BulkUploadResponse, BulkRemoveResponse } from "@/lib/types";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

type Mode = "upload" | "remove";

export function BulkUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: BulkUploadDialogProps) {
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [imagesZip, setImagesZip] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null);
  const [removeResult, setRemoveResult] = useState<BulkRemoveResponse | null>(null);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setFile(null);
    setImagesZip(null);
    setUploadResult(null);
    setRemoveResult(null);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      if (mode === "upload") {
        await apiDownload(
          "/api/products/bulk-upload/template",
          "product-bulk-upload-template.xlsx"
        );
      } else {
        await apiDownload(
          "/api/products/bulk-remove/template",
          "product-bulk-remove-template.xlsx"
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    setRemoveResult(null);
    try {
      const body = new FormData();
      body.append("file", file);

      if (mode === "upload") {
        if (imagesZip) body.append("imagesZip", imagesZip);
        const res = await apiFetch<BulkUploadResponse>(
          "/api/products/bulk-upload",
          { method: "POST", body }
        );
        setUploadResult(res);
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
      } else {
        const res = await apiFetch<BulkRemoveResponse>(
          "/api/products/bulk-remove",
          { method: "POST", body }
        );
        setRemoveResult(res);
        onUploaded();

        if (res.summary.errors === 0) {
          toast.success(
            `${res.summary.deleted} deleted, ${res.summary.deactivated} deactivated`
          );
          setTimeout(() => handleClose(false), 1200);
        } else {
          toast.warning(
            `${res.summary.deleted} deleted, ${res.summary.deactivated} deactivated — review the report below`
          );
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMode("upload");
      setFile(null);
      setImagesZip(null);
      setUploadResult(null);
      setRemoveResult(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mass upload products</DialogTitle>
          <DialogDescription>
            {mode === "upload"
              ? "Upload the product listing Excel/CSV template. Existing SKUs are updated, new SKUs are created. Reference photos in the Image List column and upload them together as a ZIP below — filenames must match exactly."
              : "Upload a list of SKUs to remove. Products with order history are deactivated instead of permanently deleted, so order records stay intact."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="inline-flex w-fit rounded-lg border bg-muted p-0.5">
            <Button
              type="button"
              variant={mode === "upload" ? "default" : "ghost"}
              size="sm"
              className="shadow-none"
              onClick={() => switchMode("upload")}
            >
              Upload products
            </Button>
            <Button
              type="button"
              variant={mode === "remove" ? "default" : "ghost"}
              size="sm"
              className="shadow-none"
              onClick={() => switchMode("remove")}
            >
              Remove products
            </Button>
          </div>

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
            <label className="text-sm font-medium">
              {mode === "upload" ? "Product listing (.xlsx/.xls/.csv)" : "SKU list (.xlsx/.xls/.csv)"}
            </label>
            <Input
              key={mode}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {mode === "upload" && (
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
          )}

          {mode === "upload" && uploadResult && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 text-sm">
                <Badge variant="secondary">
                  {uploadResult.summary.created} created
                </Badge>
                <Badge variant="secondary">
                  {uploadResult.summary.updated} updated
                </Badge>
                {uploadResult.summary.errors > 0 && (
                  <Badge variant="destructive">
                    {uploadResult.summary.errors} errors
                  </Badge>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto rounded border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead className="w-40">SKU</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadResult.report.map((row) => (
                      <TableRow key={row.row}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell className="whitespace-normal break-words">{row.sku}</TableCell>
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
                        <TableCell className="whitespace-normal break-words text-muted-foreground">
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

              {uploadResult.zipReport && uploadResult.zipReport.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Images ZIP report</p>
                  <div className="max-h-48 overflow-y-auto rounded border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead className="w-40">File</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadResult.zipReport.map((entry, i) => (
                          <TableRow key={`${entry.filename}-${i}`}>
                            <TableCell className="whitespace-normal break-words">{entry.filename}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  entry.status === "skipped" ? "destructive" : "secondary"
                                }
                              >
                                {entry.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-normal break-words text-muted-foreground">
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

          {mode === "remove" && removeResult && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{removeResult.summary.deleted} deleted</Badge>
                {removeResult.summary.deactivated > 0 && (
                  <Badge variant="warning">
                    {removeResult.summary.deactivated} deactivated (has order history)
                  </Badge>
                )}
                {removeResult.summary.errors > 0 && (
                  <Badge variant="destructive">{removeResult.summary.errors} errors</Badge>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto rounded border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead className="w-40">SKU</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {removeResult.report.map((row, i) => (
                      <TableRow key={`${row.sku}-${i}`}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell className="whitespace-normal break-words">{row.sku}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "error"
                                ? "destructive"
                                : row.status === "deactivated"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {row.status}
                          </Badge>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button
            variant={mode === "remove" ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading
              ? mode === "upload"
                ? "Uploading..."
                : "Removing..."
              : mode === "upload"
                ? "Upload"
                : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
