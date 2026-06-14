"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MetricCard } from "@/components/metric-card";
import { useDateRange } from "@/components/providers/date-range-provider";
import { fetchJson } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

type OverviewData = {
  revenueThisMonth: number;
  revenueLastMonth: number;
  monthChange: number;
  ordersToday: number;
  avgOrderValueToday: number;
  totals: {
    revenue: number;
    orders: number;
    avg_order_value: number;
    new_customers: number;
  };
};

export default function OverviewPage() {
  return (
    <DashboardShell
      title="Overview"
      description="Key performance indicators for your e-commerce business"
    >
      <OverviewContent />
    </DashboardShell>
  );
}

function OverviewContent() {
  const { startDate, endDate } = useDateRange();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson<OverviewData>("/api/overview", { startDate, endDate })
      .then(setData)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Revenue this month"
        value={formatCurrency(data.revenueThisMonth)}
        change={data.monthChange}
        subtitle={`Last month: ${formatCurrency(data.revenueLastMonth)}`}
      />
      <MetricCard
        title="Orders today"
        value={formatNumber(data.ordersToday)}
        subtitle="Latest day in dataset"
      />
      <MetricCard
        title="Avg order value (today)"
        value={formatCurrency(data.avgOrderValueToday)}
      />
      <MetricCard
        title="Revenue (selected range)"
        value={formatCurrency(data.totals.revenue)}
        subtitle={`${formatNumber(data.totals.orders)} orders · ${formatNumber(data.totals.new_customers)} new customers`}
      />
    </div>
  );
}
