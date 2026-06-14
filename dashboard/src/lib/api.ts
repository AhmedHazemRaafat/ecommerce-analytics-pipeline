export type DateRangeParams = {
  startDate?: string;
  endDate?: string;
};

export function buildQueryString(params: DateRangeParams): string {
  const search = new URLSearchParams();
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchJson<T>(
  path: string,
  params: DateRangeParams = {},
): Promise<T> {
  const res = await fetch(`${path}${buildQueryString(params)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
