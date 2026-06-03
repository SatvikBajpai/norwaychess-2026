// Presentation helpers shared by the dashboard components.

export const PLAYER_COLORS: Record<string, string> = {
  // Open
  carlsen: "#e9b949",
  firouzja: "#5b8def",
  keymer: "#e0556b",
  so: "#3fb98c",
  pragg: "#b07bf0",
  gukesh: "#e08a3c",
  // Women
  ju: "#e0556b",
  zhu: "#e9b949",
  humpy: "#5b8def",
  assaubayeva: "#3fb98c",
  muzychuk: "#b07bf0",
  divya: "#e08a3c",
};

export function colorFor(id: string): string {
  return PLAYER_COLORS[id] ?? "#7c8499";
}

/** "12.3%", or "<0.1%" for tiny non-zero values, or "-" for exact zero. */
export function pct(x: number): string {
  if (x <= 0) return "-";
  if (x < 0.001) return "<0.1%";
  return `${(x * 100).toFixed(1)}%`;
}

export function pct0(x: number): string {
  if (x <= 0) return "-";
  const v = Math.round(x * 100);
  if (v === 0) return "<1%";
  return `${v}%`;
}

export function fmtPoints(x: number): string {
  return x.toFixed(1);
}

export const PLACE_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
