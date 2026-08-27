import type { QrCode } from "./types";

export type QrCodeStatus =
  | "Pending activation"
  | "Active now"
  | "Expiring soon"
  | "Expired"
  | "Revoked";

// Same convention as the Cash-order "Overdue" badge on the orders page —
// computed client-side from dates, nothing stored server-side.
const EXPIRING_SOON_DAYS = 7;

export function getQrCodeStatus(qrCode: Pick<QrCode, "valid_from" | "valid_until" | "revoked_at">): QrCodeStatus {
  if (qrCode.revoked_at) return "Revoked";

  const now = new Date();
  const validFrom = new Date(qrCode.valid_from);
  const validUntil = new Date(qrCode.valid_until);

  if (now < validFrom) return "Pending activation";
  if (now > validUntil) return "Expired";

  const daysUntilExpiry = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "Expiring soon";

  return "Active now";
}

export const QR_CODE_STATUS_VARIANT: Record<
  QrCodeStatus,
  "info" | "success" | "warning" | "secondary" | "destructive"
> = {
  "Pending activation": "info",
  "Active now": "success",
  "Expiring soon": "warning",
  Expired: "secondary",
  Revoked: "destructive",
};
