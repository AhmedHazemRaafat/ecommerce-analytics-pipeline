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
import { formatDate, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CohortRow = {
  cohort_month: string;
  months_since_signup: number;
  retention_rate: number;
  avg_revenue: number;
};

type TrendRow = {
  date: string;
  new_customers: number;
  returning_customers: number;
};

export default function CustomersPage() {
  return (
    <DashboardShell
      title="Customers"
      description="Cohort retention and new vs returning trends"
    >
      <CustomersContent />
    </DashboardShell>
  );
}

function CustomersContent() {
  const { startDate, endDate } = useDateRange();
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [customerTrend, setCustomerTrend] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson<{ cohorts: CohortRow[]; customerTrend: TrendRow[] }>(
      "/api/customers",
      { startDate, endDate },
    )
      .then((res) => {
        setCohorts(res.cohorts);
        setCustomerTrend(
          res.customerTrend.map((row) => ({
            ...row,
            label: formatDate(row.date),
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const { cohortMonths, monthIndexes, matrix, maxRetention } = useMemo(() => {
    const cohortSet = Array.from(new Set(cohorts.map((c) => c.cohort_month))).sort();
    const monthSet = Array.from(new Set(cohorts.map((c) => c.months_since_signup))).sort(
      (a, b) => a - b,
    );
    const lookup = new Map(
      cohorts.map((c) => [`${c.cohort_month}-${c.months_since_signup}`, c.retention_rate]),
    );
    const max = Math.max(...cohorts.map((c) => c.retention_rate), 1);

    return {
      cohortMonths: cohortSet,
      monthIndexes: monthSet,
      matrix: cohortSet.map((cohort) =>
        monthSet.map((m) => lookup.get(`${cohort}-${m}`) ?? null),
      ),
      maxRetention: max,
    };
  }, [cohorts]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Cohort retention heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `120px repeat(${monthIndexes.length}, minmax(48px, 1fr))`,
                }}
              >
                <div />
                {monthIndexes.map((m) => (
                  <div key={m} className="text-center text-xs text-muted-foreground">
                    M{m}
                  </div>
                ))}
                {cohortMonths.map((cohort, rowIdx) => (
                  <div key={cohort} className="contents">
                    <div className="text-xs font-medium">{formatDate(cohort)}</div>
                    {matrix[rowIdx].map((value, colIdx) => (
                      <div
                        key={`${cohort}-${colIdx}`}
                        className="flex h-10 items-center justify-center rounded text-xs font-medium text-white"
                        style={{
                          backgroundColor:
                            value === null
                              ? "hsl(var(--muted))"
                              : `hsl(220 70% ${Math.max(20, 70 - (value / maxRetention) * 50)}%)`,
                        }}
                        title={
                          value === null ? "No data" : `${formatPercent(value)} retention`
                        }
                      >
                        {value === null ? "–" : `${Math.round(value)}%`}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New vs returning customers</CardTitle>
        </CardHeader>
        <CardContent className="h-[360px]">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={customerTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="new_customers"
                  name="New"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="returning_customers"
                  name="Returning"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
}
