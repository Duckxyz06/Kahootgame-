export function points(correct, elapsed, duration) {
  if (!correct) return 0;
  return Math.max(500, Math.min(1000, Math.round(1000 * (1 - Math.min(duration,Math.max(0,elapsed))/duration/2))));
}
