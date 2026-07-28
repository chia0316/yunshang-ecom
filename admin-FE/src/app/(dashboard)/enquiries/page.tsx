"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import type { Enquiry, EnquiryStatus, EnquiryType } from "@/lib/types";

const STATUS_OPTIONS: EnquiryStatus[] = ["new", "contacted", "closed"];

const STATUS_VARIANT: Record<EnquiryStatus, "info" | "warning" | "success"> = {
  new: "info",
  contacted: "warning",
  closed: "success",
};

const TYPE_LABELS: Record<EnquiryType, string> = {
  appointment: "Appointment Booking",
  enquiry: "Enquiry",
  other: "Other",
};

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadEnquiries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    apiFetch<Enquiry[]>(`/api/enquiries?${params.toString()}`)
      .then(setEnquiries)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load enquiries"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  const handleStatusChange = async (enquiry: Enquiry, status: EnquiryStatus) => {
    try {
      await apiFetch(`/api/enquiries/${enquiry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setEnquiries((prev) =>
        prev.map((e) => (e.id === enquiry.id ? { ...e, status } : e))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Enquiries</h1>
        <p className="text-sm text-muted-foreground">
          Appointment bookings and enquiries submitted from the storefront
        </p>
      </div>

      <div className="grid gap-2 w-40">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger id="status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Preferred</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="w-36">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : enquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No enquiries yet.
                </TableCell>
              </TableRow>
            ) : (
              enquiries.map((enquiry) => (
                <TableRow key={enquiry.id}>
                  <TableCell>{TYPE_LABELS[enquiry.type]}</TableCell>
                  <TableCell className="font-medium">{enquiry.name}</TableCell>
                  <TableCell>
                    <div>{enquiry.email}</div>
                    {enquiry.mobile && (
                      <div className="text-xs text-muted-foreground">{enquiry.mobile}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {enquiry.preferred_date
                      ? new Date(enquiry.preferred_date).toLocaleDateString()
                      : "—"}
                    {enquiry.preferred_time && ` (${enquiry.preferred_time})`}
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={enquiry.message || ""}>
                    {enquiry.message || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(enquiry.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={enquiry.status}
                      onValueChange={(v) => handleStatusChange(enquiry, v as EnquiryStatus)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>
                          <Badge variant={STATUS_VARIANT[enquiry.status]}>
                            {enquiry.status}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
