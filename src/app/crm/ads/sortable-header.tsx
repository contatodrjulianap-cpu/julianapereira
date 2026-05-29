import Link from "next/link";

// Server-safe header de coluna que ordena via querystring.
// Recebe sort/dir atuais + pathname/baseQs como props (sem hooks client).
// Server lê ?sort=<id>&dir=asc|desc e aplica em rows.sort().

export function SortableHeader({
  id,
  label,
  align = "left",
  defaultDir = "desc",
  currentSort,
  currentDir,
  pathname,
  baseQs,
}: {
  id: string;
  label: React.ReactNode;
  align?: "left" | "right" | "center";
  defaultDir?: "asc" | "desc";
  currentSort: string;
  currentDir: "asc" | "desc";
  pathname: string;
  baseQs: string; // querystring sem sort/dir (preservada entre cliques)
}) {
  const active = currentSort === id;
  const nextDir: "asc" | "desc" = active
    ? currentDir === "asc"
      ? "desc"
      : "asc"
    : defaultDir;

  const params = new URLSearchParams(baseQs);
  params.set("sort", id);
  params.set("dir", nextDir);
  const href = `${pathname}?${params.toString()}`;

  const arrow = active ? (currentDir === "asc" ? " ▲" : " ▼") : "";
  const justify =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "justify-start text-left";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-0.5 w-full ${justify} hover:text-slate-900 transition ${
        active ? "text-slate-900 font-bold" : ""
      }`}
    >
      <span>{label}</span>
      <span className="text-[9px] text-slate-400 font-normal">{arrow}</span>
    </Link>
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
