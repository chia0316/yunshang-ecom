"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CalendarDays, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import type { Enquiry, EnquiryStatus } from "@/lib/types";
import {
  APPOINTMENT_TYPES,
  STATUS_FILTER_OPTIONS,
  STATUS_OPTIONS,
  STATUS_VARIANT,
  TYPE_FILTER_OPTIONS,
  getAppointmentTypeLabel,
} from "@/lib/enquiryConstants";
import { AppointmentCalendarView } from "@/components/enquiries/appointment-calendar-view";

const PAGE_SIZE = 20;

export default function EnquiriesPage() {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [viewMessageEnquiry, setViewMessageEnquiry] = useState<Enquiry | null>(null);

  const loadEnquiries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") {
      const option = TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter);
      if (option) {
        Object.entries(option.params).forEach(([key, value]) => params.set(key, value));
      }
    }
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    apiFetch<{ total_pages: number; total: number; data: Enquiry[] }>(
      `/api/enquiries?${params.toString()}`
    )
      .then((res) => {
        setEnquiries(res.data);
        setTotalPages(res.total_pages);
        setTotal(res.total);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load enquiries"))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, search, from, to, page]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, search, from, to]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchInput("");
    setSearch("");
    setFrom("");
    setTo("");
  };

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

  const handleConfirm = async (enquiry: Enquiry) => {
    setConfirmingId(enquiry.id);
    try {
      const res = await apiFetch<{ enquiry: Enquiry }>(`/api/enquiries/${enquiry.id}/confirm`, {
        method: "POST",
      });
      setEnquiries((prev) => prev.map((e) => (e.id === enquiry.id ? res.enquiry : e)));
      toast.success(
        res.enquiry.qrcode
          ? `QR code "${res.enquiry.qrcode.name}" sent to ${enquiry.email}`
          : "Appointment confirmed"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Enquiries</h1>
          <p className="text-sm text-muted-foreground">
            Appointment bookings and enquiries submitted from the storefront
          </p>
        </div>
        <div className="inline-flex w-fit rounded-lg border bg-muted p-0.5">
          <Button
            type="button"
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="shadow-none"
            onClick={() => setViewMode("list")}
          >
            <List className="mr-2 h-4 w-4" />
            List
          </Button>
          <Button
            type="button"
            variant={viewMode === "calendar" ? "default" : "ghost"}
            size="sm"
            className="shadow-none"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Calendar
          </Button>
        </div>
      </div>

      {viewMode === "calendar" && <AppointmentCalendarView />}

      {viewMode === "list" && (
      <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="type-filter">Type</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
              {/* The width has to live on SelectTrigger itself, not the
                  wrapping div — SelectTrigger is w-fit internally, so an
                  ambient width on a parent doesn't constrain it and long
                  labels (e.g. "Appointment (no sales)") were spilling out
                  over the next filter instead of being clipped. */}
              <SelectTrigger id="type-filter" className="w-48">
                {/* SelectValue shows the raw value with no children — needs
                    an explicit label lookup since the filter's value keys
                    aren't always real enquiry.type values (the two
                    appointment options both map to type=appointment,
                    split by requires_sales_person instead). */}
                <SelectValue className="truncate">
                  {typeFilter === "all"
                    ? "All types"
                    : TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
              <SelectTrigger id="status-filter" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator orientation="vertical" className="hidden h-9 sm:block" />

        <form onSubmit={handleSearchSubmit} className="grid gap-1.5">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Name, email, or mobile (Enter to search)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-64"
          />
        </form>

        <Separator orientation="vertical" className="hidden h-9 sm:block" />

        <div className="flex items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <span className="pb-2.5 text-muted-foreground">–</span>
          <div className="grid gap-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <Button variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Preferred</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-24">Received</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-36">Confirmation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : enquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No enquiries yet.
                </TableCell>
              </TableRow>
            ) : (
              enquiries.map((enquiry) => (
                <TableRow key={enquiry.id}>
                  <TableCell className="whitespace-normal">{getAppointmentTypeLabel(enquiry)}</TableCell>
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
                  <TableCell className="max-w-40">
                    {enquiry.message ? (
                      <button
                        type="button"
                        onClick={() => setViewMessageEnquiry(enquiry)}
                        className="block max-w-full truncate text-left underline decoration-dotted underline-offset-2 hover:text-foreground"
                      >
                        {enquiry.message}
                      </button>
                    ) : (
                      "—"
                    )}
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
                  <TableCell>
                    {APPOINTMENT_TYPES.includes(enquiry.type) ? (
                      <div className="flex flex-col gap-1">
                        <Button
                          variant={enquiry.status === "confirmed" ? "outline" : "default"}
                          size="sm"
                          className="h-7 w-fit text-xs"
                          disabled={confirmingId === enquiry.id}
                          onClick={() => handleConfirm(enquiry)}
                        >
                          {confirmingId === enquiry.id
                            ? "Sending..."
                            : enquiry.status === "confirmed"
                              ? "Resend QR"
                              : "Confirm & Send QR"}
                        </Button>
                        {enquiry.qrcode && (
                          <span className="text-xs text-muted-foreground">
                            Sent: {enquiry.qrcode.name}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
      </>
      )}

      <Dialog open={!!viewMessageEnquiry} onOpenChange={(open) => !open && setViewMessageEnquiry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message from {viewMessageEnquiry?.name}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {viewMessageEnquiry?.message}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
