"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { Enquiry } from "@/lib/types";
import {
  APPOINTMENT_TYPES,
  STATUS_VARIANT,
  TIME_SLOTS,
  getAppointmentTypeLabel,
} from "@/lib/enquiryConstants";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const labelToHour = new Map(TIME_SLOTS.map((s) => [s.label, s.hour]));

// Shared by both the month view's side panel and the day view's hourly
// rows — a single appointment's key details plus the same confirm/resend
// action the Enquiries list view offers.
function AppointmentCard({
  enquiry,
  confirming,
  onConfirm,
}: {
  enquiry: Enquiry;
  confirming: boolean;
  onConfirm: (enquiry: Enquiry) => void;
}) {
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{enquiry.preferred_time || "—"}</span>
        <Badge variant={STATUS_VARIANT[enquiry.status]}>{enquiry.status}</Badge>
      </div>
      <div className="text-sm">{enquiry.name}</div>
      <div className="text-xs text-muted-foreground">
        {enquiry.email}
        {enquiry.mobile && ` · ${enquiry.mobile}`}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{getAppointmentTypeLabel(enquiry)}</Badge>
        {enquiry.requires_sales_person && (
          <span
            title="Sales person requested"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
          >
            <UserRound className="h-3 w-3" />
          </span>
        )}
      </div>
      {enquiry.message && (
        <p className="text-xs text-muted-foreground line-clamp-2">{enquiry.message}</p>
      )}
      <div className="flex items-center gap-2 mt-1">
        <Button
          variant={enquiry.status === "confirmed" ? "outline" : "default"}
          size="sm"
          className="h-7 w-fit text-xs"
          disabled={confirming}
          onClick={() => onConfirm(enquiry)}
        >
          {confirming ? "Sending..." : enquiry.status === "confirmed" ? "Resend QR" : "Confirm & Send QR"}
        </Button>
        {enquiry.qrcode && (
          <span className="text-xs text-muted-foreground">Sent: {enquiry.qrcode.name}</span>
        )}
      </div>
    </div>
  );
}

export function AppointmentCalendarView() {
  const [mode, setMode] = useState<"month" | "day">("month");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dayViewDate, setDayViewDate] = useState(() => toDateStr(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const range = useMemo(() => {
    if (mode === "day") {
      return { from: dayViewDate, to: dayViewDate };
    }
    const last = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
    return { from: toDateStr(visibleMonth), to: toDateStr(last) };
  }, [mode, visibleMonth, dayViewDate]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ data: Enquiry[] }>(
      `/api/enquiries?type=${APPOINTMENT_TYPES.join(",")}&preferred_from=${range.from}&preferred_to=${range.to}&page_size=500`
    )
      .then((res) => setAppointments(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load appointments"))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  useEffect(() => {
    // The previously selected date might not even be in the newly-visible
    // month anymore — drop the side panel rather than show stale info.
    setSelectedDate(null);
  }, [visibleMonth]);

  const handleConfirm = async (enquiry: Enquiry) => {
    setConfirmingId(enquiry.id);
    try {
      const res = await apiFetch<{ enquiry: Enquiry }>(`/api/enquiries/${enquiry.id}/confirm`, {
        method: "POST",
      });
      setAppointments((prev) => prev.map((e) => (e.id === enquiry.id ? res.enquiry : e)));
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

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Enquiry[]> = {};
    appointments.forEach((a) => {
      if (!a.preferred_date) return;
      const key = a.preferred_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    Object.values(map).forEach((list) =>
      list.sort(
        (a, b) =>
          (labelToHour.get(a.preferred_time || "") ?? 99) - (labelToHour.get(b.preferred_time || "") ?? 99)
      )
    );
    return map;
  }, [appointments]);

  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const startWeekday = visibleMonth.getDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toDateStr(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), i + 1))
    ),
  ];

  const dayAppointments = appointmentsByDate[dayViewDate] || [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Showing showroom appointment bookings only — general enquiries and other requests aren't
        included here. Switch to List view and filter by Type to see those.
      </p>
      <div className="inline-flex w-fit rounded-lg border bg-muted p-0.5">
        <Button
          type="button"
          variant={mode === "month" ? "default" : "ghost"}
          size="sm"
          className="shadow-none"
          onClick={() => setMode("month")}
        >
          Month view
        </Button>
        <Button
          type="button"
          variant={mode === "day" ? "default" : "ghost"}
          size="sm"
          className="shadow-none"
          onClick={() => setMode("day")}
        >
          Day view
        </Button>
      </div>

      {mode === "month" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-md border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">
                {visibleMonth.toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`empty-${i}`} />;
                const dayAppointments = appointmentsByDate[dateStr] || [];
                const count = dayAppointments.length;
                const needsSalesPerson = dayAppointments.some((a) => a.requires_sales_person);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === toDateStr(new Date());
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    title={needsSalesPerson ? "Includes a sales person request" : undefined}
                    className={`relative flex flex-col items-center justify-center rounded-lg py-2 text-sm border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : isToday
                          ? "border-primary"
                          : "border-transparent hover:border-border"
                    }`}
                  >
                    {needsSalesPerson && (
                      <UserRound
                        className={`absolute top-1 right-1 h-3 w-3 ${isSelected ? "text-primary-foreground" : "text-blue-600"}`}
                      />
                    )}
                    <span className="font-medium">{Number(dateStr.slice(8, 10))}</span>
                    {count > 0 && (
                      <Badge
                        variant={isSelected ? "secondary" : "default"}
                        className="mt-0.5 h-4 px-1.5 text-[10px]"
                      >
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
            {loading && <p className="text-xs text-muted-foreground mt-2">Loading...</p>}
          </div>

          <div className="rounded-md border p-4">
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground">
                Select a date to see its appointments.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="font-semibold text-sm">
                  {new Date(selectedDate).toLocaleDateString("en-SG", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                {(appointmentsByDate[selectedDate] || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointments this day.</p>
                ) : (
                  (appointmentsByDate[selectedDate] || []).map((enquiry) => (
                    <AppointmentCard
                      key={enquiry.id}
                      enquiry={enquiry}
                      confirming={confirmingId === enquiry.id}
                      onConfirm={handleConfirm}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setDayViewDate((d) => toDateStr(new Date(new Date(d).getTime() - 86400000)))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold">
              {new Date(dayViewDate).toLocaleDateString("en-SG", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setDayViewDate((d) => toDateStr(new Date(new Date(d).getTime() + 86400000)))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {TIME_SLOTS.map(({ label }) => {
                const enquiry = dayAppointments.find((a) => a.preferred_time === label);
                return (
                  <div key={label} className="flex items-start gap-3">
                    <span className="w-32 shrink-0 pt-3 text-xs text-muted-foreground">{label}</span>
                    {enquiry ? (
                      <div className="flex-1">
                        <AppointmentCard
                          enquiry={enquiry}
                          confirming={confirmingId === enquiry.id}
                          onConfirm={handleConfirm}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 border-t border-dashed mt-3" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
