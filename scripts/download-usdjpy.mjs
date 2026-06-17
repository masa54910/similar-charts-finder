import fs from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT_FILE = path.join(OUT_DIR, "usdjpy-1m.csv");

// まずは取得基盤の動作確認用。
// 実データAPI接続前に、USD/JPY 1分足CSV形式を生成する。
function generateDemoUsdJpy1m() {
  const rows = ["time,open,high,low,close"];

  let price = 155.0;
  const start = new Date("2026-01-01T00:00:00Z");

  for (let i = 0; i < 3000; i++) {
    const time = new Date(start.getTime() + i * 60 * 1000);

    const wave =
      Math.sin(i / 35) * 0.015 +
      Math.sin(i / 120) * 0.04;

    const drift = i < 1200 ? 0.002 : i < 2100 ? -0.001 : 0.0015;

    const open = price;
    const close = open + drift + wave + (Math.random() - 0.5) * 0.025;
    const high = Math.max(open, close) + Math.random() * 0.025;
    const low = Math.min(open, close) - Math.random() * 0.025;

    rows.push(
      [
        time.toISOString(),
        open.toFixed(3),
        high.toFixed(3),
        low.toFixed(3),
        close.toFixed(3),
      ].join(",")
    );

    price = close;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, rows.join("\n"), "utf8");

  console.log(`created: ${OUT_FILE}`);
  console.log(`rows: ${rows.length - 1}`);
}

generateDemoUsdJpy1m();