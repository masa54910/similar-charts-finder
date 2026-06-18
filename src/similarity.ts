function cosine(
  a: number[],
  b: number[],
  weights?: number[]
) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    const w = weights?.[i] ?? 1;

    dot += a[i] * b[i] * w;
    na += a[i] * a[i] * w;
    nb += b[i] * b[i] * w;
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type SimilarityInput = {
  ema25?: number[];
  ema75?: number[];
  ema200?: number[];
  ema600?: number[];
  close?: number[];
  high?: number[];
  low?: number[];
};

export type SimilarityOptions = {
  useEMA25: boolean;
  useEMA75: boolean;
  useEMA200: boolean;
  useEMA600: boolean;
  useClose: boolean;
  useHigh: boolean;
  useLow: boolean;
};

export function calculateSimilarity(
  target: SimilarityInput,
  sample: SimilarityInput,
  options: SimilarityOptions,
  weights?: number[]
) {
  let score = 0;
  let totalWeight = 0;

  const add = (
    enabled: boolean,
    weight: number,
    a?: number[],
    b?: number[]
  ) => {
    if (!enabled) return;
    if (!a || !b) return;

    score += cosine(a, b, weights) * weight;
    totalWeight += weight;
  };

  add(options.useEMA25, 30, target.ema25, sample.ema25);
  add(options.useEMA75, 25, target.ema75, sample.ema75);
  add(options.useEMA200, 20, target.ema200, sample.ema200);
  add(options.useEMA600, 5, target.ema600, sample.ema600);

  add(options.useClose, 15, target.close, sample.close);
  add(options.useHigh, 3, target.high, sample.high);
  add(options.useLow, 2, target.low, sample.low);

  return totalWeight
    ? score / totalWeight
    : 0;
}