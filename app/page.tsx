"use client";

import { useEffect, useRef, useState } from "react";
import { generateWindows } from "../src/windowGenerator";
import { normalize } from "../src/normalize";
import {
  calculateSimilarity,
  type SimilarityOptions,
} from "../src/similarity";

type Candle = {
  time?: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ResultItem = {
  rank: number;
  tf: string;
  date: string;
  score: number;
  start: number;
  end: number;
  candles: Candle[];
  future: Candle[];
};

const EMA = [
  { period: 25, color: "#8b2cff", label: "EMA 25" },
  { period: 75, color: "#1fa653", label: "EMA 75" },
  { period: 200, color: "#1e5cff", label: "EMA 200" },
  { period: 600, color: "#ff2c25", label: "EMA 600" },
];



function calcEma(values: number[], period: number) {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];

  for (let i = 0; i < values.length; i += 1) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }

  return out;
}

function parseCsv(text: string): Candle[] {
  const lines = text.trim().split(/\r?\n/);
  const rows = lines.slice(1);

  return rows
    .map((line) => {
      const [time, open, high, low, close] = line.split(",");

      return {
        time,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
      };
    })
    .filter(
      (c) =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
    );
}

function resampleCandles(candles: Candle[], minutes: number): Candle[] {
  if (minutes === 1) return candles;

  const groupSize = minutes;
  const result: Candle[] = [];

  for (let i = 0; i < candles.length; i += groupSize) {
    const chunk = candles.slice(i, i + groupSize);
    if (chunk.length < groupSize) continue;

    result.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
    });
  }

  return result;
}

function makeFuture(start: Candle, n = 90, seed = 2) {
  const arr: Candle[] = [];
  let price = start.close;

  for (let i = 0; i < n; i += 1) {
    const drift = i < 25 ? 0.008 : i < 58 ? -0.004 : 0.007;
    const open = price;
    const close =
      open +
      drift +
      Math.sin((i + seed) / 8) * 0.018 +
      Math.sin(i * seed) * 0.018;

    arr.push({
      open,
      close,
      high: Math.max(open, close) + 0.02 + Math.abs(Math.sin(i)) * 0.03,
      low: Math.min(open, close) - 0.02 - Math.abs(Math.cos(i)) * 0.03,
    });

    price = close;
  }

  return arr;
}
function flipCandles(candles: Candle[]): Candle[] {
  if (!candles.length) return [];

  const prices = candles.flatMap((c) => [c.open, c.high, c.low, c.close]);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const center = (max + min) / 2;

  return candles.map((c) => {
    const open = center * 2 - c.open;
    const close = center * 2 - c.close;
    const high = center * 2 - c.low;
    const low = center * 2 - c.high;

    return {
      ...c,
      open,
      high,
      low,
      close,
    };
  });
}
function formatTimeLabel(rawTime: string, fallbackIndex: number) {
  if (!rawTime) return `#${fallbackIndex}`;

  const trimmed = rawTime.trim();

  const isoDate = new Date(trimmed);
  if (!Number.isNaN(isoDate.getTime())) {
    const month = String(isoDate.getMonth() + 1).padStart(2, "0");
    const day = String(isoDate.getDate()).padStart(2, "0");
    const hour = String(isoDate.getHours()).padStart(2, "0");
    const minute = String(isoDate.getMinutes()).padStart(2, "0");

    return `${month}/${day} ${hour}:${minute}`;
  }
  

  const dateTimeMatch = trimmed.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})/
  );

  if (dateTimeMatch) {
    const [, , month, day, hour, minute] = dateTimeMatch;

    return `${month.padStart(2, "0")}/${day.padStart(2, "0")} ${hour.padStart(
      2,
      "0"
    )}:${minute}`;
  }

  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);

  if (timeOnlyMatch) {
    const [, hour, minute] = timeOnlyMatch;

    return `${hour.padStart(2, "0")}:${minute}`;
  }

  return trimmed.slice(0, 16);
}
function toTimeMs(rawTime?: string) {
  if (!rawTime) return NaN;

  const normalized = rawTime.trim().replace(/\//g, "-").replace(" ", "T");
  return new Date(normalized).getTime();
}

function parseTargetDateTime(input: string) {
  if (!input.trim()) return null;

  const normalized = input.trim().replace(/\//g, "-").replace(" ", "T");
  const ms = new Date(normalized).getTime();

  return Number.isNaN(ms) ? NaN : ms;
}

function findEndIndexByDateTime(candles: Candle[], input: string) {
  const targetMs = parseTargetDateTime(input);

  if (targetMs === null) return candles.length - 1;
  if (Number.isNaN(targetMs)) return -1;

  let found = -1;

  for (let i = 0; i < candles.length; i += 1) {
    const ms = toTimeMs(candles[i].time);

    if (Number.isNaN(ms)) continue;
    if (ms <= targetMs) found = i;
    if (ms > targetMs) break;
  }

  return found;
}
function drawChart(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  current: Candle[],
  future: Candle[] = [],
  title = "",
  overlay: Candle[] = []
) {
  if (!current.length) return;

  context.clearRect(0, 0, canvas.width, canvas.height);

  const width = canvas.width;
  const height = canvas.height;
  const padL = 24;
  const padR = 82;
  const padT = 64;
  const padB = 52;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const all = [...current, ...future].flatMap((c) => [c.high, c.low]);
  const min = Math.min(...all) - 0.12;
  const max = Math.max(...all) + 0.16;
  const total = current.length + future.length;

  const y = (v: number) => padT + ((max - v) / (max - min)) * plotH;
  const x = (i: number) => padL + (i / Math.max(1, total - 1)) * plotW;

  context.strokeStyle = "rgba(210, 218, 232, 0.55)";
  context.lineWidth = 1;

  for (let i = 0; i < 9; i += 1) {
    const yy = padT + (i * plotH) / 8;
    context.beginPath();
    context.moveTo(padL, yy);
    context.lineTo(width - padR, yy);
    context.stroke();
  }

  context.strokeStyle = "rgba(210, 218, 232, 0.35)";

  for (let i = 0; i < 13; i += 1) {
    const xx = padL + (i * plotW) / 12;
    context.beginPath();
    context.moveTo(xx, padT);
    context.lineTo(xx, height - padB);
    context.stroke();
  }

  context.fillStyle = "#1f2937";
  context.font = "13px -apple-system, BlinkMacSystemFont, Segoe UI";

  for (let i = 0; i < 7; i += 1) {
    const val = min + ((max - min) * i) / 6;
    context.fillText(val.toFixed(3), width - 70, y(val) + 4);
  }

  if (title) {
    context.font = "700 20px -apple-system, BlinkMacSystemFont, Segoe UI";
    context.fillText(title, 26, 36);
  }

  function candle(c: Candle, i: number, alpha = 1) {
    const xx = x(i);
    const yo = y(c.open);
    const yc = y(c.close);
    const yh = y(c.high);
    const yl = y(c.low);
    const up = c.close >= c.open;

    context.globalAlpha = alpha;
    context.strokeStyle = up ? "#1668ff" : "#ff2b24";
    context.fillStyle = up ? "#1668ff" : "#ff2b24";
    context.lineWidth = 1.2;

    context.beginPath();
    context.moveTo(xx, yh);
    context.lineTo(xx, yl);
    context.stroke();

    const cw = Math.max(3, (plotW / total) * 0.56);
    const top = Math.min(yo, yc);
    const bh = Math.max(2, Math.abs(yc - yo));

    context.fillRect(xx - cw / 2, top, cw, bh);
    context.globalAlpha = 1;
  }

  current.forEach((c, i) => candle(c, i, 1));
  future.forEach((c, i) => candle(c, current.length + i, 0.38));

  const combined = [...current, ...future];
  const closes = combined.map((c) => c.close);

  EMA.forEach((line) => {
    const e = calcEma(closes, line.period);

    context.strokeStyle = line.color;
    context.lineWidth = 2.35;
    context.beginPath();
      if (overlay.length) {
    const baseFirst = current[0].close;
    const overlayFirst = overlay[0].close;

    const adjusted = overlay.map((c) => {
      const ratio = c.close / overlayFirst;
      return baseFirst * ratio;
    });

    context.strokeStyle = "rgba(0, 0, 0, 0.45)";
    context.lineWidth = 3;
    context.setLineDash([8, 6]);
    context.beginPath();

    adjusted.slice(0, current.length).forEach((v, i) => {
      if (i === 0) context.moveTo(x(i), y(v));
      else context.lineTo(x(i), y(v));
    });

    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "rgba(0, 0, 0, 0.75)";
    context.font = "700 14px -apple-system, BlinkMacSystemFont, Segoe UI";
    context.fillText("過去パターン重ね表示", padL + 12, padT + 22);
  }

    e.forEach((v, i) => {
      if (i === 0) context.moveTo(x(i), y(v));
      else context.lineTo(x(i), y(v));
    });

    context.stroke();
  });

  if (future.length) {
    const splitX = x(current.length - 1);

    context.strokeStyle = "rgba(0,0,0,.3)";
    context.beginPath();
    context.moveTo(splitX, padT);
    context.lineTo(splitX, height - padB);
    context.stroke();

    context.strokeStyle = "rgba(35,50,75,.6)";
    context.lineWidth = 2;
    context.setLineDash([7, 7]);
    context.beginPath();

    [current[current.length - 1], ...future].forEach((c, i) => {
      const xx = x(current.length - 1 + i);
      const yy = y(c.close);

      if (i === 0) context.moveTo(xx, yy);
      else context.lineTo(xx, yy);
    });

    context.stroke();
    context.setLineDash([]);
  }

  const last = current[current.length - 1].close;
  const yy = y(last);

  context.strokeStyle = "rgba(0, 113, 227, .45)";
  context.setLineDash([2, 3]);
  context.beginPath();
  context.moveTo(padL, yy);
  context.lineTo(width - padR, yy);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#1f2937";

    const labelSource = [...current, ...future];
  const labelCount = 7;

  for (let i = 0; i < labelCount; i += 1) {
    const index = Math.round(
      (i * (labelSource.length - 1)) / Math.max(1, labelCount - 1)
    );

    const rawTime = labelSource[index]?.time ?? "";
    const label = formatTimeLabel(rawTime, index);

    context.fillText(label, x(index) - 28, height - 22);
  }
}

export default function Home() {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const bigChartRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [allCandles, setAllCandles] = useState<Candle[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [timeframe, setTimeframe] = useState("1");
  const [zoom, setZoomState] = useState(1);
  const [selected, setSelected] = useState<ResultItem | null>(null);
  const [flipSelected, setFlipSelected] = useState(false);
  const [overlayResult, setOverlayResult] = useState<ResultItem | null>(null);
  const [targetDateTime, setTargetDateTime] = useState("");
const [targetError, setTargetError] = useState("");

  const tfLabel = timeframe === "60" ? "1時間足" : `${timeframe}分足`;

  useEffect(() => {
  async function loadUsdJpy() {
    const res = await fetch("/api/usdjpy");

    const json = await res.json();

    const parsed: Candle[] = json.candles.map((c: any, index: number) => ({
  time: c.datetime ?? c.time ?? c.date ?? `api index ${index}`,
  open: Number(c.open),
  high: Number(c.high),
  low: Number(c.low),
  close: Number(c.close),
}));
console.log("最初のローソク足:", parsed[0]);
console.log("最後のローソク足:", parsed[parsed.length - 1]);
    console.log("取得したローソク足の本数:", parsed.length);

    setAllCandles(parsed);
    setCandles(parsed.slice(-300));
  }

  loadUsdJpy();
}, []);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    drawChart(
  context,
  canvas,
  candles,
  [],
  "",
  overlayResult?.candles ?? []
);
  }, [candles, overlayResult]);

  useEffect(() => {
  if (!selected || !bigChartRef.current) return;

  const context = bigChartRef.current.getContext("2d");
  if (!context) return;

  let current = selected.candles;
  let future = selected.future;

  if (flipSelected) {
    const combined = flipCandles([...selected.candles, ...selected.future]);

    current = combined.slice(0, selected.candles.length);
    future = combined.slice(selected.candles.length);
  }

  drawChart(
    context,
    bigChartRef.current,
    current,
    future,
    `類似${selected.rank}位　${selected.tf}　類似度 ${selected.score}%　${
      flipSelected ? "上下反転表示" : "過去局面＋実際の未来120本"
    }`
  );
}, [selected, flipSelected]);

  function setZoom(next: number) {
    const old = zoom;
    const fixed = Math.max(0.75, Math.min(2.8, next));
    const scroll = scrollRef.current;
    const stage = stageRef.current;
    const canvas = chartRef.current;

    if (!scroll || !stage || !canvas) return;

    const rect = scroll.getBoundingClientRect();
    const cx = scroll.scrollLeft + rect.width / 2;
    const cy = scroll.scrollTop + rect.height / 2;

    stage.style.width = `${1180 * fixed}px`;
    stage.style.height = `${760 * fixed}px`;
    canvas.style.width = `${1180 * fixed}px`;
    canvas.style.height = `${760 * fixed}px`;

    scroll.scrollLeft = cx * (fixed / old) - rect.width / 2;
    scroll.scrollTop = cy * (fixed / old) - rect.height / 2;

    setZoomState(fixed);
  }

  function changeTimeframe(next: string) {
  setTimeframe(next);
  setTargetError("");

  if (!allCandles.length) return;

  const minutes = next === "60" ? 60 : Number(next);
  const sampled = resampleCandles(allCandles, minutes);

  const endIndex = findEndIndexByDateTime(sampled, targetDateTime);

  if (endIndex < 0) {
    setTargetError("指定日時が見つかりません。形式を確認してください。");
    setCandles(sampled.slice(-300));
    return;
  }

  setCandles(sampled.slice(Math.max(0, endIndex - 299), endIndex + 1));
}

  function search() {
  const minutes = timeframe === "60" ? 60 : Number(timeframe);
const sampled = resampleCandles(allCandles, minutes);
const windowSize = 300;
const futureSize = 120;

setTargetError("");

const targetEndIndex = findEndIndexByDateTime(sampled, targetDateTime);

if (targetEndIndex < 0) {
  setResults([]);
  setTargetError("指定日時が見つかりません。例：2026-06-18 01:27");
  return;
}

const targetStartIndex = targetEndIndex - windowSize + 1;

if (targetStartIndex < 0) {
  setResults([]);
  setTargetError("指定日時より前のローソク足が300本未満です。");
  return;
}

const target = sampled.slice(targetStartIndex, targetEndIndex + 1);

// 指定日時より前だけを検索対象にする
const searchable = sampled.slice(0, targetStartIndex);
const windows = generateWindows(searchable, windowSize);

if (windows.length === 0) {
  setResults([]);
  setCandles(target);
  setTargetError("指定日時より前に比較できる過去データが足りません。");
  return;
}

  const targetClose = target.map((c) => c.close);
  const targetHigh = target.map((c) => c.high);
  const targetLow = target.map((c) => c.low);

  const targetFeatures = {
    ema25: normalize(calcEma(targetClose, 25)),
    ema75: normalize(calcEma(targetClose, 75)),
    ema200: normalize(calcEma(targetClose, 200)),
    ema600: normalize(calcEma(targetClose, 600)),
    close: normalize(targetClose),
    high: normalize(targetHigh),
    low: normalize(targetLow),
  };

  const options: SimilarityOptions = {
    useEMA25: true,
    useEMA75: true,
    useEMA200: true,
    useEMA600: false,
    useClose: true,
    useHigh: true,
    useLow: true,
  };

  const weights = Array.from({ length: windowSize }, (_, i) => {
    if (i >= windowSize - 50) return 3;
    if (i >= windowSize - 100) return 2;
    return 1;
  });

  const scored = windows
  .map((w) => {
    const close = w.data.map((c) => c.close);
    const high = w.data.map((c) => c.high);
    const low = w.data.map((c) => c.low);

    const sampleFeatures = {
      ema25: normalize(calcEma(close, 25)),
      ema75: normalize(calcEma(close, 75)),
      ema200: normalize(calcEma(close, 200)),
      ema600: normalize(calcEma(close, 600)),
      close: normalize(close),
      high: normalize(high),
      low: normalize(low),
    };

    const score =
      calculateSimilarity(targetFeatures, sampleFeatures, options, weights) *
      100;

    return {
      rank: 0,
      tf: timeframe === "60" ? "1時間足" : `${timeframe}分足`,
      date: w.data[0].time ?? `index ${w.start}`,
      score: Math.round(score * 10) / 10,
      start: w.start,
      end: w.end,
      candles: w.data,
      future: sampled.slice(w.end + 1, w.end + 1 + futureSize),
    };
  })
  .sort((a, b) => b.score - a.score);

const deduped: ResultItem[] = [];

for (const item of scored) {
  const overlaps = deduped.some((picked) => {
    return item.start <= picked.end && item.end >= picked.start;
  });

  if (!overlaps) {
    deduped.push(item);
  }

  if (deduped.length >= 5) break;
}

const ranked = deduped.map((item, index) => ({
  ...item,
  rank: index + 1,
}));

  setCandles(target);
  setResults(ranked);
}

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    let dragging = false;
    let sx = 0;
    let sy = 0;
    let sl = 0;
    let st = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.88));
    };

    const onDown = (e: MouseEvent) => {
      dragging = true;
      scroll.classList.add("dragging");
      sx = e.clientX;
      sy = e.clientY;
      sl = scroll.scrollLeft;
      st = scroll.scrollTop;
    };

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;

      scroll.scrollLeft = sl - (e.clientX - sx);
      scroll.scrollTop = st - (e.clientY - sy);
    };

    const onUp = () => {
      dragging = false;
      scroll.classList.remove("dragging");
    };

    scroll.addEventListener("wheel", onWheel, { passive: false });
    scroll.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      scroll.removeEventListener("wheel", onWheel);
      scroll.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [zoom]);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="apple">●</div>
          <strong>Similar Charts Finder</strong>
        </div>

        <nav>
          <a>概要</a>
          <a>使い方</a>
          <a>特徴</a>
          <button onClick={search}>体験版を試す</button>
        </nav>
      </header>

      <section className="hero">
        <h1>Similar Charts Finder</h1>
        <p>
          過去のチャートから、現在のチャートに最も似ているパターンを見つけます。
        </p>
      </section>

      <main className="app">
        <aside className="panel sidebar">
          <section>
            <h3>通貨ペア</h3>
            <div className="selectLike">
              <span>🇺🇸 🇯🇵</span>
              <b>USD/JPY</b>
              <span>⌄</span>
            </div>
          </section>

          <section>
            <h3>時間足（すべて横断して検索）</h3>
            <div className="timeframes">
              {["1", "5", "15", "30", "60"].map((tf) => (
                <button
                  key={tf}
                  className={timeframe === tf ? "active" : ""}
                  onClick={() => changeTimeframe(tf)}
                >
                  {tf === "60" ? "1時間" : `${tf}分`}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="row">
              <h3>比較本数</h3>
              <strong>300 本</strong>
            </div>
            <input type="range" min={80} max={300} defaultValue={300} />
          </section>

          <section>
            <div className="row">
              <h3>未来表示本数</h3>
              <strong>120 本</strong>
            </div>
            <input type="range" min={20} max={120} defaultValue={120} />
          </section>

          <section>
            <h3>検索期間</h3>
            <div className="selectLike">
              <span>▣</span>
              <b>過去6か月</b>
              <span>⌄</span>
            </div>
          </section>
<section>
  <h3>指定日時</h3>
  <input
    className="dateInput"
    value={targetDateTime}
    onChange={(e) => setTargetDateTime(e.target.value)}
    placeholder="例：2026-06-18 01:27"
  />
  {targetError && <p className="errorText">{targetError}</p>}
</section>
          <button className="primary" onClick={search}>
            類似パターンを検索
          </button>

          <button
  className="secondary"
  onClick={() => {
    setZoom(1);
    setOverlayResult(null);
  }}
>
  設定をリセット
</button>

          <section className="emaBox">
            <h3>EMA設定</h3>
            {EMA.map((line) => (
              <div className="legendItem" key={line.period}>
                <i style={{ background: line.color }} />
                {line.label}
              </div>
            ))}
          </section>
        </aside>

        <section className="center">
          <div className="panel chartPanel">
            <div className="panelHead">
              <div>
                <h2>
                  現在のチャート（USD/JPY・{tfLabel}）
                </h2>

                <div className="legend">
                  {EMA.map((line) => (
                    <span key={line.period}>
                      <i style={{ background: line.color }} />
                      {line.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="chartButtons">
                <button onClick={() => setZoom(zoom * 0.85)}>−</button>
                <button onClick={() => setZoom(zoom * 1.18)}>＋</button>
                <button onClick={() => setZoom(1)}>表示リセット</button>
              </div>
            </div>

            <div className="chartScroll" ref={scrollRef}>
              <div className="chartStage" ref={stageRef}>
                <canvas ref={chartRef} width={1180} height={760} />
                <div className="chartTitle">
                  米ドル/円・{timeframe === "60" ? "1H" : timeframe}・OANDA
                </div>
                <div className="priceTag">
                  {candles.length ? candles[candles.length - 1].close.toFixed(3) : "---"}
                </div>
              </div>
            </div>

            <div className="chartNote">
              <span>⌖</span>
              チャートをドラッグ：移動　｜　ホイール：拡大・縮小　｜　右ドラッグ：範囲選択
              <em>データ：CSV</em>
            </div>
          </div>
        </section>

        <aside className="panel results">
          <div className="panelHead">
            <h2>類似パターン（上位5件）</h2>
            <span>ⓘ</span>
          </div>
{results.length === 0 && (
  <div className="emptyResult">
    類似検索を実行すると、ここに上位5件が表示されます。
  </div>
)}
          {results.map((item) => (
            <button
              className="resultItem"
              key={item.rank}
              onClick={() => {
  setFlipSelected(false);
  setSelected(item);
}}
            >
              <span className="rank">{item.rank}</span>

              <span className="resultText">
                <b>{item.date}</b>
                <small>時間足：{item.tf}</small>
                <small>類似度</small>
                <strong>{item.score}%</strong>
              </span>

              <span className="miniPlaceholder">未来</span>

<span
  className="miniPlaceholder"
  onClick={(e) => {
    e.stopPropagation();
    setOverlayResult(item);
  }}
>
  重ねる
</span>
            </button>
          ))}
        </aside>
      </main>

      <footer>
        <span>▣ CSVデータからEMA4本を自動計算</span>
        <span>◇ 次工程で類似検索エンジンを実装</span>
      </footer>

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <h2>
                  類似{selected.rank}位：{selected.tf}
                </h2>
                <p>
                  {selected.date} / 類似度 {selected.score}% /
                  未来予測にもEMA25・75・200・600を表示
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
  {selected.score < 0 && (
    <button onClick={() => setFlipSelected((v) => !v)}>
      {flipSelected ? "通常表示" : "上下反転"}
    </button>
  )}

  <button onClick={() => setSelected(null)}>閉じる</button>
</div>
            </div>

            <div className="modalChartScroll">
              <canvas ref={bigChartRef} width={1500} height={860} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}