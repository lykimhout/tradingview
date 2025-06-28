let chart, rsiChart, candleSeries, ma25, ma50_1, ma50_2, rsiSeries;

const intervalMap = {
  '5m': '5m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

function initChart() {
  $('#chart').html('');
  $('#rsi-chart').html('');
  chart = LightweightCharts.createChart(document.getElementById('chart'), {
    layout: { backgroundColor: '#111', textColor: '#eee' },
    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' }},
    timeScale: { timeVisible: true, secondsVisible: false },
  });
  rsiChart = LightweightCharts.createChart(document.getElementById('rsi-chart'), {
    layout: { backgroundColor: '#111', textColor: '#eee' },
    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' }},
    timeScale: { timeVisible: true, secondsVisible: false },
  });

  candleSeries = chart.addCandlestickSeries();
  ma25 = chart.addLineSeries({ color: 'yellow', lineWidth: 2 });
  ma50_1 = chart.addLineSeries({ color: 'blue', lineWidth: 1 });
  ma50_2 = chart.addLineSeries({ color: 'blue', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dotted });
  rsiSeries = rsiChart.addLineSeries({ color: 'orange', lineWidth: 2 });
}

async function fetchCandles(symbol, interval) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`;
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

$('#loadChart').on('click', async function () {
  const symbol = $('#symbol').val();
  const interval = intervalMap[$('#timeframe').val()];
  const candles = await fetchCandles(symbol, interval);

  initChart();
  candleSeries.setData(candles);

  const ma25Data = calculateMA(candles, 25);
  const ma50_1Data = calculateMA(candles, 50);
  const ma50_2Data = calculateMA(candles, 50);
  const rsiData = calculateRSI(candles);

  ma25.setData(ma25Data);
  ma50_1.setData(ma50_1Data);
  ma50_2.setData(ma50_2Data);
  rsiSeries.setData(rsiData);
  $('#predictionResult').html('');
});

$('#predict').on('click', async function () {
  const symbol = $('#symbol').val();
  const interval = intervalMap[$('#timeframe').val()];
  const count = $('#predictCount').val();
  const candles = await fetchCandles(symbol, interval);
  const prediction = aiPredictNext(candles, count);
  $('#predictionResult').html(prediction);
});

$(document).ready(() => $('#loadChart').click());
