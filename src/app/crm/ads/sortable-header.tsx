"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Header de coluna clicável que ordena tabela ASC/DESC via querystring.
// Server lê ?sort=<id>&dir=asc|desc e aplica em rows.sort().

export function SortableHeader({
  id,
  label,
  align = "left",
  defaultDir = "desc",
  className = "",
}: {
  id: string;
  label: React.ReactNode;
  align?: "left" | "right" | "center";
  defaultDir?: "asc" | "desc";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams?.get("sort") ?? "";
  const currentDir = searchParams?.get("dir") ?? defaultDir;
  const active = currentSort === id;

  function toggle() {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (active) {
      // Alterna direção
      next.set("dir", currentDir === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", id);
      next.set("dir", defaultDir);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const arrow = active
    ? currentDir === "asc"
      ? " ▲"
      : " ▼"
    : "";
  const justify =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "justify-start text-left";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center gap-0.5 w-full ${justify} hover:text-slate-900 transition ${
        active ? "text-slate-900 font-bold" : ""
      } ${className}`}
    >
      <span>{label}</span>
      <span className="text-[9px] text-slate-400 font-normal">{arrow}</span>
    </button>
  );
}

// Helper server-side: compara dois valores (number | null | string) seguindo a
// direção e jogando null pro final.
export function compareValues<T>(
  a: T | null,
  b: T | null,
  dir: "asc" | "desc",
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // null sempre no fim
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return dir === "asc" ? a - b : b - a;
  }
  const aStr = String(a);
  const bStr = String(b);
  return dir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
}
