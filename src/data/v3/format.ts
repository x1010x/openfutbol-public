export function formatEuros(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K €`;
  return `${n} €`;
}

export function formatGoalDiff(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
