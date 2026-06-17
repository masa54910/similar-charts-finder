"use client";

import { useEffect, useRef, useState } from "react";

type Candle = {
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
};

const EMA = [
  { period: 25, color: "#8b2cff", label: "EMA 25" },
  { period: 75, color: "#1fa653", label: "EMA 75" },
  { period: 200, color: "#1e5cff", label: "EMA 200" },
  { period: 600, color: "#ff2c25", label: "EMA 600" },
];

const RESULTS: ResultItem[] = [
  { rank: 1, tf: "5分足", date: "2024/05/24 15:37", score: 92 },
  { rank: 2, tf: "15分足", date: "2024/04/03 10:42", score: 89 },
  { rank: 3, tf: "30分足", date: "2024/03/18 14:15", score: 86 },
  { rank: 4, tf: "1時間足", date: "2024/02/28 11:08", score: 84 },
  { rank: 5, tf: "1分足", date: "2024/01/30 09:55", score: 83 },
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

function makeCandles(n = 170, seed = 1, mode: "current" | "result" = "current") {
  const arr: Candle[] = [];
  let price = 154.1 + (seed % 9) * 0.035;

  for (let i = 0; i < n; i += 1) {
    const wave = Math.sin((i + seed) / 10) * 0.027 + Math.sin((i + seed) / 24) * 0.034;
    let drift = i < 42 ? 0.017 : i < 82 ? 0.002 : i < 128 ? 0.012 : -0.004;
    if (mode === "result") drift = i < 78 ? 0.011 : i < 122 ? -0.003 : 0.006;

    const noise = Math.sin((i + 1) * (seed + 2)) * 0.026;
    const open = price;
    const close = open + drift + wave * 0.25 + noise;
    const high = Math.max(open, close) + 0.02 + Math.abs(Math.sin(i + seed)) * 0.04;
    const low = Math.min(open, close) - 0.02 - Math.abs(Math.cos(i + seed)) * 0.04;
    arr.push({ open, high, low, close });
    price = close;
  }

  return arr;
}

function makeFuture(start: Candle, n = 90, seed = 2) {
  const arr: Candle[] = [];
  let price = start.close;

  for (let i = 0; i < n; i += 1) {
    const drift = i < 25 ? 0.008 : i < 58 ? -0.004 : 0.007;
    const open = price;
    const close = open + drift + Math.sin((i + seed) / 8) * 0.018 + Math.sin(i * seed) * 0.018;
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

function drawChart(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  current: Candle[],
  future: Candle[] = [],
  title = ""
) {
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
  ["21:00", "23:00", "01:00", "03:00", "05:00", "07:00", "09:00", "11:00", "13:00", "15:00", "17:00"].forEach((t, i) => {
    context.fillText(t, padL + (i * plotW) / 10 - 8, height - 22);
  });

  return last;
}

function MiniChart({ seed }: { seed: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;
    const pad = 8;
    let p = 155.3 + seed * 0.04;
    const values: number[] = [];

    for (let k = 0; k < 55; k += 1) {
      p += Math.sin((k + seed) / 7) * 0.012 + Math.sin(k * seed) * 0.021;
      values.push(p);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = (v: number) => pad + ((max - v) / (max - min || 1)) * (height - pad * 2);

    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#e6e8ee";
    for (let i = 1; i < 4; i += 1) {
      context.beginPath();
      context.moveTo(0, (i * height) / 4);
      context.lineTo(width, (i * height) / 4);
      context.stroke();
    }

    context.strokeStyle = "#0071e3";
    context.lineWidth = 2;
    context.beginPath();
    values.forEach((v, i) => {
      if (i) context.lineTo(x(i), y(v));
      else context.moveTo(x(i), y(v));
    });
    context.stroke();

    context.strokeStyle = "#c2c7d0";
    context.setLineDash([5, 5]);
    context.beginPath();
    for (let i = 34; i < values.length; i += 1) {
      const v = values[i] + Math.sin(i / 5) * 0.05;
      if (i === 34) context.moveTo(x(i), y(v));
      else context.lineTo(x(i), y(v));
    }
    context.stroke();
    context.setLineDash([]);
  }, [seed]);

  return <canvas ref={ref} className="mini-chart" width={190} height={92} />;
}

export default function Home() {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const bigChartRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [timeframe, setTimeframe] = useState("1");
  const [candles, setCandles] = useState<Candle[]>(() => makeCandles(170, 1));
  const [zoom, setZoomState] = useState(1);
  const [selected, setSelected] = useState<ResultItem | null>(null);

  const tfLabel = timeframe === "60" ? "1時間足" : `${timeframe}分足`;

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    drawChart(context, canvas, candles);
  }, [candles]);

  useEffect(() => {
    if (!selected || !bigChartRef.current) return;
    const current = makeCandles(150, selected.rank * 13, "result");
    const future = makeFuture(current[current.length - 1], 90, selected.rank * 7);
    const context = bigChartRef.current.getContext("2d");
    if (!context) return;
    drawChart(
      context,
      bigChartRef.current,
      current,
      future,
      `類似${selected.rank}位　${selected.tf}　類似度 ${selected.score}%　未来予測＋EMA4本`
    );
  }, [selected]);

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
    const count = next === "1" ? 170 : next === "5" ? 145 : next === "15" ? 128 : next === "30" ? 116 : 105;
    setCandles(makeCandles(count, Number(next)));
  }

  function search() {
    changeTimeframe(timeframe);
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
        <p>過去のチャートから、現在のチャートに最も似ているパターンを見つけます。</p>
      </section>

      <main className="app">
        <aside className="panel sidebar">
          <section>
            <h3>通貨ペア</h3>
            <div className="selectLike"><span>🇺🇸 🇯🇵</span><b>USD/JPY</b><span>⌄</span></div>
          </section>

          <section>
            <h3>時間足（すべて横断して検索）</h3>
            <div className="timeframes">
              {["1", "5", "15", "30", "60"].map((tf) => (
                <button key={tf} className={timeframe === tf ? "active" : ""} onClick={() => changeTimeframe(tf)}>
                  {tf === "60" ? "1時間" : `${tf}分`}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="row"><h3>比較本数</h3><strong>300 本</strong></div>
            <input type="range" min={80} max={300} defaultValue={300} />
          </section>

          <section>
            <div className="row"><h3>未来表示本数</h3><strong>120 本</strong></div>
            <input type="range" min={20} max={120} defaultValue={120} />
          </section>

          <section>
            <h3>検索期間</h3>
            <div className="selectLike"><span>▣</span><b>過去6か月</b><span>⌄</span></div>
          </section>

          <button className="primary" onClick={search}>類似パターンを検索</button>
          <button className="secondary" onClick={() => setZoom(1)}>設定をリセット</button>

          <section className="emaBox">
            <h3>EMA設定</h3>
            {EMA.map((line) => <div className="legendItem" key={line.period}><i style={{ background: line.color }} />{line.label}</div>)}
          </section>
        </aside>

        <section className="center">
          <div className="panel chartPanel">
            <div className="panelHead">
              <div>
                <h2>現在のチャート（USD/JPY・{tfLabel}）</h2>
                <div className="legend">
                  {EMA.map((line) => <span key={line.period}><i style={{ background: line.color }} />{line.label}</span>)}
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
                <div className="chartTitle">米ドル/円・{timeframe === "60" ? "1H" : timeframe}・OANDA</div>
                <div className="priceTag">155.423</div>
              </div>
            </div>

            <div className="chartNote">
              <span>⌖</span>
              チャートをドラッグ：移動　｜　ホイール：拡大・縮小　｜　右ドラッグ：範囲選択
              <em>データ：OANDA</em>
            </div>
          </div>
        </section>

        <aside className="panel results">
          <div className="panelHead">
            <h2>類似パターン（上位5件）</h2>
            <span>ⓘ</span>
          </div>

          {RESULTS.map((item) => (
            <button className="resultItem" key={item.rank} onClick={() => setSelected(item)}>
              <span className="rank">{item.rank}</span>
              <span className="resultText">
                <b>{item.date}</b>
                <small>時間足：{item.tf}</small>
                <small>類似度</small>
                <strong>{item.score}%</strong>
              </span>
              <MiniChart seed={item.rank} />
            </button>
          ))}
        </aside>
      </main>

      <footer>
        <span>▣ 高精度な類似検索アルゴリズムで、未来の値動きのヒントを見つける</span>
        <span>◇ データは安全に管理され、お客様の情報は保護されます</span>
      </footer>

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <h2>類似{selected.rank}位：{selected.tf}</h2>
                <p>{selected.date} / 類似度 {selected.score}% / 未来予測にもEMA25・75・200・600を表示</p>
              </div>
              <button onClick={() => setSelected(null)}>閉じる</button>
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
