import type { Enquiry, EnquiryStatus, EnquiryType } from "./types";

// Shared between the Enquiries list view and the appointment calendar view.

// 'confirmed' is deliberately not selectable in the plain status dropdown —
// it's only ever reached via the "Confirm & Send QR" action, which is what
// actually finds and emails the code. It can still be the *current* value
// of a row's Select (rendered via the badge in SelectValue) after that
// action runs.
export const STATUS_OPTIONS: EnquiryStatus[] = ["new", "contacted", "closed"];
export const STATUS_FILTER_OPTIONS: EnquiryStatus[] = ["new", "contacted", "confirmed", "closed"];

export const STATUS_VARIANT: Record<EnquiryStatus, "info" | "warning" | "success" | "secondary"> = {
  new: "info",
  contacted: "warning",
  confirmed: "secondary",
  closed: "success",
};

export const TYPE_LABELS: Record<EnquiryType, string> = {
  appointment: "Appointment",
  appointment_no_sales: "Appointment (no sales)",
  enquiry: "Enquiry",
  other: "Other",
};

export const APPOINTMENT_TYPES: EnquiryType[] = ["appointment", "appointment_no_sales"];

export const ALL_TYPES: EnquiryType[] = ["appointment", "appointment_no_sales", "enquiry", "other"];

// The storefront form (VisitUsPage.tsx) never actually lets a customer
// submit type='appointment_no_sales' — it only offers 'appointment' with a
// "require a sales person" checkbox. So whether a booking needs a sales
// person is real data on requires_sales_person, not on type — this derives
// the label admin actually sees from both, so "Appointment (no sales)"
// reflects real no-sales-person bookings instead of a type value that's
// never actually produced.
export function getAppointmentTypeLabel(enquiry: Pick<Enquiry, "type" | "requires_sales_person">): string {
  if (APPOINTMENT_TYPES.includes(enquiry.type)) {
    return enquiry.requires_sales_person ? "Appointment" : "Appointment (no sales)";
  }
  return TYPE_LABELS[enquiry.type];
}

// Type filter options for the Enquiries list — the two appointment options
// both query type=appointment on the backend, distinguished by
// requires_sales_person (see getAppointmentTypeLabel above for why).
export const TYPE_FILTER_OPTIONS: {
  value: string;
  label: string;
  params: Record<string, string>;
}[] = [
  { value: "appointment", label: "Appointment", params: { type: "appointment", requires_sales_person: "true" } },
  {
    value: "appointment_no_sales",
    label: "Appointment (no sales)",
    params: { type: "appointment", requires_sales_person: "false" }
  },
  { value: "enquiry", label: "Enquiry", params: { type: "enquiry" } },
  { value: "other", label: "Other", params: { type: "other" } }
];

// Store is open 24 hours, so every hour of the day is a bookable slot —
// mirrors cust-FE's VisitUsPage.tsx generation exactly, since the label is
// what's actually stored as preferred_time.
const formatHour = (hour: number) => {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
};
export const TIME_SLOTS = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  label: `${formatHour(hour)} - ${formatHour((hour + 1) % 24)}`,
}));
