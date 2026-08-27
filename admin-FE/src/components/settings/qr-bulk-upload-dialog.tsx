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
import { apiDownload, apiUpload, ApiError } from "@/lib/api";
import type { QrCodeBulkUploadResponse } from "@/lib/types";

interface QrBulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

export function QrBulkUploadDialog({ open, onOpenChange, onUploaded }: QrBulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imagesZip, setImagesZip] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [result, setResult] = useState<QrCodeBulkUploadResponse | null>(null);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await apiDownload("/api/qrcodes/bulk-upload/template", "qr-code-bulk-upload-template.xlsx");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      if (imagesZip) body.append("imagesZip", imagesZip);
      const res = await apiUpload<QrCodeBulkUploadResponse>(
        "/api/qrcodes/bulk-upload",
        body,
        setUploadProgress
      );
      setResult(res);
      onUploaded();

      const hasZipIssues = res.zipReport && res.zipReport.length > 0;
      if (res.summary.errors === 0 && !hasZipIssues) {
        toast.success(`Upload complete — ${res.summary.created} QR code(s) created`);
        setTimeout(() => handleClose(false), 1200);
      } else {
        toast.warning(`${res.summary.created} created — review the report below`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        toast.error(err.message, { duration: 8000 });
      } else {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
          <DialogTitle>Bulk upload QR codes</DialogTitle>
          <DialogDescription>
            Upload the QR code Excel/CSV template alongside a ZIP of the images it references —
            filenames must match exactly.
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
            <label className="text-sm font-medium">QR code list (.xlsx/.xls/.csv)</label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Images ZIP</label>
            <Input
              type="file"
              accept=".zip"
              onChange={(e) => setImagesZip(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, JPEG, or WEBP only — other files inside the ZIP are skipped and reported
              below.
            </p>
          </div>

          {uploading && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${uploadProgress ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {uploadProgress !== null && uploadProgress < 100
                  ? `Uploading — ${uploadProgress}%`
                  : "Processing on the server..."}
              </p>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 text-sm">
                <Badge variant="secondary">{result.summary.created} created</Badge>
                {result.summary.errors > 0 && (
                  <Badge variant="destructive">{result.summary.errors} errors</Badge>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto rounded border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.report.map((row) => (
                      <TableRow key={row.row}>
                        <TableCell>{row.row}</TableCell>
                        <TableCell className="whitespace-normal break-words">{row.name}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "error" ? "destructive" : "secondary"}>
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

              {result.zipReport && result.zipReport.length > 0 && (
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
                        {result.zipReport.map((entry, i) => (
                          <TableRow key={`${entry.filename}-${i}`}>
                            <TableCell className="whitespace-normal break-words">{entry.filename}</TableCell>
                            <TableCell>
                              <Badge variant={entry.status === "skipped" ? "destructive" : "secondary"}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
