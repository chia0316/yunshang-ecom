"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

interface NotificationCounts {
  pendingOrders: number;
  newEnquiries: number;
}

// A live count of items still needing attention (orders awaiting payment
// confirmation, enquiries no one has triaged yet) — not a one-time "unseen"
// ping. It clears itself as admin acts, no read/unread state to track.
export function NotificationBell() {
  const [counts, setCounts] = useState<NotificationCounts>({ pendingOrders: 0, newEnquiries: 0 });

  useEffect(() => {
    const load = () => {
      apiFetch<NotificationCounts>("/api/admin/notifications")
        .then(setCounts)
        .catch(() => undefined);
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const total = counts.pendingOrders + counts.newEnquiries;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium text-white dark:bg-blue-500">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {total === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            <>
              <DropdownMenuItem render={<Link href="/orders" />}>
                {counts.pendingOrders === 0
                  ? "No pending orders"
                  : `${counts.pendingOrders} order${counts.pendingOrders === 1 ? "" : "s"} awaiting payment confirmation`}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/enquiries" />}>
                {counts.newEnquiries === 0
                  ? "No new enquiries"
                  : `${counts.newEnquiries} new enquir${counts.newEnquiries === 1 ? "y" : "ies"} to triage`}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
