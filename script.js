let chart, rsiChart, candleSeries, ma25, ma50_1, ma50_2, rsiSeries;

const intervalMap = {
  '5m': '5m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

let fullCandles = []; // store historical candles
let currentSymbol = 'BTCUSDT';
let currentInterval = '1h';
let earliestTimestamp = null;

function initChart() {
  $('#chart').html('');
  $('#rsi-chart').html('');
  chart = LightweightCharts.createChart(document.getElementById('chart'), {
    layout: { backgroundColor: '#111', textColor: '#080808' },
    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });
  rsiChart = LightweightCharts.createChart(document.getElementById('rsi-chart'), {
    layout: { backgroundColor: '#111', textColor: '#080808' },
    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });

  candleSeries = chart.addCandlestickSeries();
  ma25 = chart.addLineSeries({ color: 'yellow', lineWidth: 2 ,priceLineVisible: false, lastValueVisible: false});
  ma50_1 = chart.addLineSeries({ color: 'blue', lineWidth: 1 ,priceLineVisible: false, lastValueVisible: false});
  ma50_2 = chart.addLineSeries({ color: 'blue', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dotted ,priceLineVisible: false, lastValueVisible: false});
  rsiSeries = rsiChart.addLineSeries({ color: 'orange', lineWidth: 2 });

  chart.timeScale().subscribeVisibleLogicalRangeChange(handleScroll);
}

async function fetchCandles(symbol, interval, limit = 500, endTime = null, startTime = null) {
  let url = `https://api.binance.me/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (endTime) url += `&endTime=${endTime}`;
  if (startTime) url += `&startTime=${startTime}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.map(d => ({
    time: d[0] / 1000,
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4])
  }));
}

function calculateMA(data, length) {
  return data.map((d, i) => {
    if (i < length - 1) return null;
    const slice = data.slice(i - length + 1, i + 1);
    const avg = slice.reduce((sum, v) => sum + v.close, 0) / length;
    return { time: d.time, value: parseFloat(avg.toFixed(2)) };
  }).filter(x => x);
}

function calculateRSI(data, period = 14) {
  let rsiData = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    let change = data[i].close - data[i - 1].close;
    gains += change > 0 ? change : 0;
    losses += change < 0 ? -change : 0;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < data.length; i++) {
    let change = data[i].close - data[i - 1].close;
    let gain = change > 0 ? change : 0;
    let loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    let rs = avgGain / (avgLoss || 1);
    let rsi = 100 - (100 / (1 + rs));
    rsiData.push({ time: data[i].time, value: parseFloat(rsi.toFixed(2)) });
  }
  return rsiData;
}

function aiPredictNext(candles, count) {
  const last = candles[candles.length - 1];
  const trend = candles.slice(-5).reduce((sum, c) => sum + (c.close - c.open), 0);
  const signal = trend > 0 ? 'Buy' : 'Sell';
  return `🤖 AI Prediction for next ${count} candles: <strong>${signal}</strong> (trend: ${trend.toFixed(2)})`;
}

function updateIndicators(candles) {
  const ma25Data = calculateMA(candles, 25);
  const ma50_1Data = calculateMA(candles, 50);
  const ma50_2Data = calculateMA(candles, 50);
  const rsiData = calculateRSI(candles);
  ma25.setData(ma25Data);
  ma50_1.setData(ma50_1Data);
  ma50_2.setData(ma50_2Data);
  rsiSeries.setData(rsiData);
}

async function handleScroll(range) {
  if (!range || !range.from) return;
  const firstVisibleTime = chart.timeScale().getVisibleRange().from;
  const oldestLoadedTime = fullCandles[0]?.time;

  if (firstVisibleTime <= oldestLoadedTime + 5) {
    const earliestCandleTimeMs = fullCandles[0].time * 1000;
    const earlierCandles = await fetchCandles(currentSymbol, currentInterval, 200, null, earliestCandleTimeMs - 1);
    if (earlierCandles.length > 0) {
      fullCandles = [...earlierCandles, ...fullCandles];
      candleSeries.setData(fullCandles);
      updateIndicators(fullCandles);
    }
  }
}

$('#loadChart').on('click', async function () {
  currentSymbol = $('#symbol').val();
  currentInterval = intervalMap[$('#timeframe').val()];
  const candles = await fetchCandles(currentSymbol, currentInterval, 500);
  fullCandles = candles;

  initChart();
  candleSeries.setData(fullCandles);
  updateIndicators(fullCandles);
  $('#predictionResult').html('');
});

$('#predict').on('click', async function () {
  const count = $('#predictCount').val();
  const prediction = aiPredictNext(fullCandles, count);
  $('#predictionResult').html(prediction);
});

$(document).ready(() => $('#loadChart').click());
