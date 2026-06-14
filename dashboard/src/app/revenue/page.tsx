"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useDateRange } from "@/components/providers/date-range-provider";
import { fetchJson } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type RevenuePoint = {
  date: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
  ma7_revenue: number;
  ma7_orders: number;
  ma7_aov: number;
};

type MetricKey = "revenue" | "orders" | "avg_order_value";

const METRICS: Record<
  MetricKey,
  { label: string; maKey: keyof RevenuePoint; format: (v: number) => string }
> = {
  revenue: { label: "Revenue", maKey: "ma7_revenue", format: formatCurrency },
  orders: { label: "Orders", maKey: "ma7_orders", format: formatNumber },
  avg_order_value: {
    label: "Avg order value",
    maKey: "ma7_aov",
    format: formatCurrency,
  },
};

export default function RevenuePage() {
  return (
    <DashboardShell
      title="Revenue trends"
      description="Daily performance with 7-day moving average"
    >
      <RevenueContent />
    </DashboardShell>
  );
}

function RevenueContent() {
  const { startDate, endDate } = useDateRange();
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson<{ series: RevenuePoint[] }>("/api/revenue", { startDate, endDate })
      .then((res) => setSeries(res.series))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const chartData = useMemo(
    () =>
      series.map((row) => ({
        ...row,
        label: formatDate(row.date),
      })),
    [series],
  );

  const cfg = METRICS[metric];

  return (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daily trends</CardTitle>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <TabsList>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="avg_order_value">AOV</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="h-[420px]">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" minTickGap={24} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => cfg.format(Number(v))} width={80} />
                <Tooltip
                  formatter={(value, name) => [
                    cfg.format(Number(value ?? 0)),
                    String(name),
                  ]}
                  labelFormatter={(label) => String(label)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={metric}
                  name={cfg.label}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={cfg.maKey}
                  name="7-day MA"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
    </Card>
  );
}
