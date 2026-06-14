"use client";

import type { ReactNode } from "react";
import { DateRangeProvider } from "@/components/providers/date-range-provider";
import { DateRangePicker } from "@/components/date-range-picker";
import { Sidebar } from "@/components/layout/sidebar";

export function DashboardShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DateRangeProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-8 py-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <DateRangePicker />
          </header>
          <main className="flex-1 space-y-6 p-8">{children}</main>
        </div>
      </div>
    </DateRangeProvider>
  );
}
