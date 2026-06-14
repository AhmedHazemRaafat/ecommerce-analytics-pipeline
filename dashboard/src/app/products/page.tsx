"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useDateRange } from "@/components/providers/date-range-provider";
import { fetchJson } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Product = {
  product_id: number;
  name: string;
  category: string;
  total_revenue: number;
  units_sold: number;
  return_rate: number;
};

type SortKey = "total_revenue" | "units_sold" | "return_rate" | "name";

export default function ProductsPage() {
  return (
    <DashboardShell title="Products" description="Catalog performance and return rates">
      <ProductsContent />
    </DashboardShell>
  );
}

function ProductsContent() {
  const { startDate, endDate } = useDateRange();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ category: string; revenue: number }[]>([]);
  const [returns, setReturns] = useState<{ category: string; return_rate: number }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("total_revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson<{
      products: Product[];
      categories: { category: string; revenue: number }[];
      returns: { category: string; return_rate: number }[];
    }>("/api/products", { startDate, endDate })
      .then((res) => {
        setProducts(res.products);
        setCategories(res.categories.slice(0, 10));
        setReturns(res.returns);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });
  }, [products, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 categories by revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Return rate by category</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => formatPercent(Number(v))} />
                  <Bar dataKey="return_rate" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                    Product
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("total_revenue")}>
                    Revenue
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("units_sold")}>
                    Units
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("return_rate")}>
                    Return rate
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.slice(0, 100).map((p) => (
                  <TableRow key={p.product_id}>
                    <TableCell className="max-w-xs truncate">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.total_revenue)}</TableCell>
                    <TableCell className="text-right">{p.units_sold}</TableCell>
                    <TableCell className="text-right">{formatPercent(p.return_rate ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
