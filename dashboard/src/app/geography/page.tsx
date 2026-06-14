"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useDateRange } from "@/components/providers/date-range-provider";
import { fetchJson } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const GEO_URL =
  "https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson";

type CountryRow = {
  country: string;
  country_name: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
};

export default function GeographyPage() {
  return (
    <DashboardShell
      title="Geography"
      description="European revenue distribution — click a country for details"
    >
      <GeographyContent />
    </DashboardShell>
  );
}

function GeographyContent() {
  const { startDate, endDate } = useDateRange();
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [selected, setSelected] = useState<CountryRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson<{ countries: CountryRow[] }>("/api/geography", { startDate, endDate })
      .then((res) => setCountries(res.countries))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const revenueByCode = useMemo(
    () => new Map(countries.map((c) => [c.country, c])),
    [countries],
  );

  const colorScale = useMemo(() => {
    const max = Math.max(...countries.map((c) => c.revenue), 1);
    return scaleLinear<string>()
      .domain([0, max])
      .range(["hsl(var(--muted))", "hsl(220 80% 45%)"]);
  }, [countries]);

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by country</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[480px] w-full" />
            ) : (
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [15, 54], scale: 650 }}
                width={800}
                height={480}
                style={{ width: "100%", height: "auto" }}
              >
                <ZoomableGroup>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const iso =
                          (geo.properties.ISO2 as string | undefined)?.toUpperCase() ??
                          (geo.properties.iso_a2 as string | undefined)?.toUpperCase();
                        const stats = iso ? revenueByCode.get(iso) : undefined;
                        const revenue = stats?.revenue ?? 0;

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => stats && setSelected(stats)}
                            style={{
                              default: {
                                fill: colorScale(revenue),
                                stroke: "hsl(var(--border))",
                                strokeWidth: 0.5,
                                outline: "none",
                                cursor: stats ? "pointer" : "default",
                              },
                              hover: {
                                fill: "hsl(220 80% 35%)",
                                stroke: "hsl(var(--foreground))",
                                strokeWidth: 0.75,
                                outline: "none",
                              },
                              pressed: { outline: "none" },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selected ? selected.country_name : "Country breakdown"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <Stat label="Country code" value={selected.country} />
                <Stat label="Revenue" value={formatCurrency(selected.revenue)} />
                <Stat label="Orders" value={formatNumber(selected.orders)} />
                <Stat
                  label="Avg order value"
                  value={formatCurrency(selected.avg_order_value)}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a country on the map to view revenue, orders, and average order value.
              </p>
            )}

            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Top countries</p>
              <div className="space-y-2">
                {countries.slice(0, 8).map((c) => (
                  <button
                    key={c.country}
                    type="button"
                    onClick={() => setSelected(c)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted"
                  >
                    <span>{c.country_name ?? c.country}</span>
                    <span className="font-medium">{formatCurrency(c.revenue)}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
