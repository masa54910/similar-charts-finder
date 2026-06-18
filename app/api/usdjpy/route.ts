import { NextResponse } from "next/server";

type TwelveDataCandle = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

export async function GET() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "TWELVE_DATA_API_KEY is not set" },
      { status: 500 }
    );
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", "USD/JPY");
  url.searchParams.set("interval", "1min");
  url.searchParams.set("outputsize", "5000");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("format", "JSON");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok || json.status === "error") {
    return NextResponse.json(
      { error: json.message ?? "Failed to fetch USDJPY data" },
      { status: 500 }
    );
  }

  const values = Array.isArray(json.values) ? json.values : [];

  const candles = values
    .map((item: TwelveDataCandle) => ({
      time: item.datetime,
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
    }))
    .filter(
      (c) =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
    )
    .reverse();

  return NextResponse.json({
    source: "twelvedata",
    symbol: "USD/JPY",
    interval: "1min",
    count: candles.length,
    candles,
  });
}