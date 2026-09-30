"use client";

import { useMemo, useState } from "react";
import type { SalesReport } from "@/lib/types";

interface MonthBucket {
  key: string; // yyyy-mm
  label: string; // "Jan '26"
  revenue: number;
  orderCount: number;
  isCurrent: boolean;
}

// Backfills every month in [from, to] with 0 revenue when the backend's
// series has no row for it (a month with zero completed-payment orders
// never appears as a row at all — it's a GROUP BY, not a generated
// calendar) — without this, a quiet month would silently compress the
// x-axis instead of showing as a real zero-height bar.
function buildMonths(series: SalesReport["series"], monthsBack: number): MonthBucket[] {
  const now = new Date();
  const byKey = new Map(
    series.map((row) => {
      const d = new Date(row.period);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      return [key, row];
    })
  );

  const months: MonthBucket[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const row = byKey.get(key);
    months.push({
      key,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(",", " '"),
      revenue: row?.revenue ?? 0,
      orderCount: row?.orderCount ?? 0,
      isCurrent: i === 0,
    });
  }
  return months;
}

// Rounds a max value up to a "clean" tick per the dataviz mark spec (0 /
// 1,000 / 2,000-style steps) instead of an arbitrary data-driven ceiling.
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return `$${value.toFixed(0)}`;
}

const CHART_HEIGHT = 160;
const BAR_MAX_WIDTH = 24;

export function MonthlySalesChart({
  series,
  loading,
}: {
  series: SalesReport["series"] | null;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const months = useMemo(() => buildMonths(series ?? [], 12), [series]);
  const maxRevenue = useMemo(() => niceMax(Math.max(...months.map((m) => m.revenue), 0)), [months]);
  const hasAnyRevenue = months.some((m) => m.revenue > 0);

  if (loading) {
    return <div className="h-[220px] animate-pulse rounded-md bg-muted" />;
  }

  if (!hasAnyRevenue) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No completed sales in the last 12 months yet.
      </div>
    );
  }

  const ticks = [0, maxRevenue / 2, maxRevenue];

  return (
    <div className="relative">
      <div className="flex">
        {/* Y-axis ticks — recessive text, clean rounded numbers. */}
        <div className="flex flex-col justify-between pr-2 text-right text-xs text-muted-foreground" style={{ height: CHART_HEIGHT }}>
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <span key={t}>{formatCurrency(t)}</span>
            ))}
        </div>

        <div className="relative flex-1">
          {/* Gridlines — hairline, one step off the surface, never dashed. */}
          <div className="absolute inset-0 flex flex-col justify-between" style={{ height: CHART_HEIGHT }}>
            {ticks
              .slice()
              .reverse()
              .map((t) => (
                <div key={t} className="border-t border-border" />
              ))}
          </div>

          <div className="relative flex items-end justify-between gap-1" style={{ height: CHART_HEIGHT }}>
            {months.map((m, i) => {
              const barHeight = Math.max((m.revenue / maxRevenue) * CHART_HEIGHT, m.revenue > 0 ? 3 : 0);
              return (
                <div key={m.key} className="relative flex flex-1 flex-col items-center justify-end" style={{ height: CHART_HEIGHT }}>
                  {m.isCurrent && m.revenue > 0 && (
                    <span className="absolute -top-5 text-xs font-medium text-foreground">
                      {formatCurrency(m.revenue)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded-t-[4px] bg-blue-600 transition-colors hover:bg-blue-700 focus-visible:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:bg-blue-400"
                    style={{
                      height: barHeight || 1,
                      width: Math.min(BAR_MAX_WIDTH, 20),
                    }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${m.label}: ${formatCurrency(m.revenue)} across ${m.orderCount} order${m.orderCount === 1 ? "" : "s"}`}
                  />
                  {hovered === i && (
                    <div className="absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                      <div className="font-semibold text-foreground">{formatCurrency(m.revenue)}</div>
                      <div className="text-muted-foreground">
                        {m.orderCount} order{m.orderCount === 1 ? "" : "s"} · {m.label}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-axis month labels. */}
      <div className="mt-2 flex pl-8">
        <div className="flex flex-1 justify-between gap-1">
          {months.map((m) => (
            <span key={m.key} className="flex-1 text-center text-xs text-muted-foreground">
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
