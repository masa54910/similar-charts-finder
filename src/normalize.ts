export function normalize(
  values: number[]
) {
  if (!values.length) return [];

  const first = values[0];

  return values.map(
    (v) => (v - first) / first
  );
}