export function generateWindows<T>(
  data: T[],
  windowSize: number
) {
  const windows = [];

  for (
    let i = 0;
    i <= data.length - windowSize;
    i++
  ) {
    windows.push({
      start: i,
      end: i + windowSize - 1,
      data: data.slice(i, i + windowSize),
    });
  }

  return windows;
}