/* crypto_chart.js */
let chart, candleSeries, lineSeries, overlayCanvas, overlayCtx;
let drawing = false, drawMode = false, startPoint = null;
let rawDataGlobal = [];

async function fetchBinanceData(symbol = 'BTCUSDT', interval = '1m', limit = 100) {
  const url = `https://api.binance.me/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  //const url = `https://corsproxy.io/?https://api.binance.me/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const response = await fetch(url);
  const data = await response.json();
  return data.map(d => ({
    time: d[0] / 1000,
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
}

function calculateEMA(data, period = 14) {
  let k = 2 / (period + 1);
  let emaArray = [];
  let emaPrev = data[0].close;
  data.forEach((d, i) => {
    let ema = i === 0 ? emaPrev : d.close * k + emaPrev * (1 - k);
    emaArray.push({ time: d.time, value: ema });
    emaPrev = ema;
  });
  return emaArray;
}

function calculateRSI(data, period = 14) {
  let rsi = [], gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    let diff = data[i].close - data[i - 1].close;
    diff > 0 ? gains += diff : losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi.push({ time: data[period].time, value: 100 - 100 / (1 + avgGain / avgLoss) });
  for (let i = period + 1; i < data.length; i++) {
    let diff = data[i].close - data[i - 1].close;
    let gain = diff > 0 ? diff : 0;
    let loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    let rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
    rsi.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
  }
  return rsi;
}

function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
  const emaFast = calculateEMA(data, fast);
  const emaSlow = calculateEMA(data, slow);
  const macdLine = emaFast.map((e, i) => i >= slow - 1 ? {
    time: e.time,
    value: e.value - emaSlow[i].value
  } : null).filter(Boolean);
  const signalLine = calculateEMA(macdLine, signal);
  return macdLine.map((m, i) => ({ time: m.time, value: m.value, signal: signalLine[i]?.value }));
}

function addSignalMarkers(data, type) {
  let signalMarkers = [];
  if (type === 'ema') {
    const ema9 = calculateEMA(data, 9);
    const ema21 = calculateEMA(data, 21);
    for (let i = 1; i < ema9.length; i++) {
      const prevDiff = ema9[i - 1].value - ema21[i - 1].value;
      const currDiff = ema9[i].value - ema21[i].value;
      if (prevDiff <= 0 && currDiff > 0) {
        signalMarkers.push({ time: ema9[i].time, position: 'belowBar', color: 'green', shape: 'arrowUp', text: 'Buy (EMA)' });
      } else if (prevDiff >= 0 && currDiff < 0) {
        signalMarkers.push({ time: ema9[i].time, position: 'aboveBar', color: 'red', shape: 'arrowDown', text: 'Sell (EMA)' });
      }
    }
  } else if (type === 'macd') {
    const macd = calculateMACD(data);
    for (let i = 1; i < macd.length; i++) {
      const prev = macd[i - 1];
      const curr = macd[i];
      if (!prev.signal || !curr.signal) continue;
      const prevDiff = prev.value - prev.signal;
      const currDiff = curr.value - curr.signal;
      if (prevDiff <= 0 && currDiff > 0) {
        signalMarkers.push({ time: curr.time, position: 'belowBar', color: 'green', shape: 'arrowUp', text: 'Buy (MACD)' });
      } else if (prevDiff >= 0 && currDiff < 0) {
        signalMarkers.push({ time: curr.time, position: 'aboveBar', color: 'red', shape: 'arrowDown', text: 'Sell (MACD)' });
      }
    }
  }
  candleSeries.setMarkers(signalMarkers);
}

function drawTrendline(start, end) {
  overlayCtx.beginPath();
  overlayCtx.moveTo(start.x, start.y);
  overlayCtx.lineTo(end.x, end.y);
  overlayCtx.strokeStyle = 'red';
  overlayCtx.lineWidth = 2;
  overlayCtx.stroke();
}

function initChart(data) {
  chart = LightweightCharts.createChart(document.getElementById('chart'), {
    layout: { backgroundColor: '#ffffff', textColor: '#000000' },
    width: document.getElementById('chart').clientWidth,
    height: 600,
  });
  candleSeries = chart.addCandlestickSeries();
  candleSeries.setData(data);
  lineSeries = chart.addLineSeries({ color: 'blue', lineWidth: 2 });
  overlayCanvas = document.getElementById('overlay');
  overlayCanvas.width = chart._chartWidget._chartPaneView._canvasBinding.canvas.width;
  overlayCanvas.height = 600;
  overlayCtx = overlayCanvas.getContext('2d');
  chart.subscribeCrosshairMove(param => {
    if (param.time) {
      const price = param.seriesData.get(candleSeries)?.close;
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayCtx.fillStyle = "#000";
      overlayCtx.fillText(`Time: ${param.time}, Price: ${price}`, 10, 20);
    }
  });
}

async function loadChartData(symbol = 'BTCUSDT', interval = '1m') {
  const rawData = await fetchBinanceData(symbol, interval);
  rawDataGlobal = rawData;
  if (chart) chart.remove();
  initChart(rawData);
  const indicator = $('#indicatorSelect').val();
  if (indicator === 'ema') {
    const ema = calculateEMA(rawData, 14);
    lineSeries.setData(ema);
    addSignalMarkers(rawData, 'ema');
  } else if (indicator === 'macd') {
    const macd = calculateMACD(rawData);
    lineSeries.setData(macd.map(m => ({ time: m.time, value: m.value })));
    addSignalMarkers(rawData, 'macd');
  } else if (indicator === 'rsi') {
    const rsi = calculateRSI(rawData);
    lineSeries.setData(rsi);
  }
}

async function main() {
  let symbol = $('#symbolSelect').val();
  let interval = $('#intervalSelect').val();
  await loadChartData(symbol, interval);

  $('#symbolSelect, #intervalSelect').change(async function () {
    symbol = $('#symbolSelect').val();
    interval = $('#intervalSelect').val();
    await loadChartData(symbol, interval);
  });

  $('#indicatorSelect').change(function () {
    const indicator = $(this).val();
    lineSeries.setData([]);
    candleSeries.setMarkers([]);
    if (indicator === 'ema') {
      const ema = calculateEMA(rawDataGlobal, 14);
      lineSeries.setData(ema);
      addSignalMarkers(rawDataGlobal, 'ema');
    } else if (indicator === 'macd') {
      const macd = calculateMACD(rawDataGlobal);
      lineSeries.setData(macd.map(m => ({ time: m.time, value: m.value })));
      addSignalMarkers(rawDataGlobal, 'macd');
    } else if (indicator === 'rsi') {
      const rsi = calculateRSI(rawDataGlobal);
      lineSeries.setData(rsi);
    }
  });

  $('#drawLine').click(function () {
    drawMode = !drawMode;
    this.textContent = drawMode ? "Cancel Drawing" : "Draw Trendline";
  });

  overlayCanvas.addEventListener('mousedown', e => {
    if (!drawMode) return;
    const rect = overlayCanvas.getBoundingClientRect();
    startPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    drawing = true;
  });

  overlayCanvas.addEventListener('mouseup', e => {
    if (!drawing) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const endPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    drawTrendline(startPoint, endPoint);
    drawing = false;
    startPoint = null;
  });
}

main();


// Save trendlines as JSON
function exportTrendlines() {
  const lines = [];
  const ctx = overlayCtx;
  const canvas = overlayCanvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  // This demo does not track lines internally, so this is a placeholder
  alert("Note: You would need to store trendline coordinates in a separate array during drawing to support export.");
}

// Export chart as PNG image
function exportChartAsImage() {
  const container = document.getElementById('container');
  html2canvas(container).then(canvas => {
    const link = document.createElement('a');
    link.download = 'chart.png';
    link.href = canvas.toDataURL();
    link.click();
  });
}

// Add buttons dynamically
$(document).ready(() => {
  const exportControls = $('<div style="margin: 10px;"></div>');
  exportControls.append('<button id="saveTrendlines">Save Trendlines</button>');
  exportControls.append('<button id="saveImage">Export as PNG</button>');
  $('#controls').append(exportControls);

  $('#saveTrendlines').click(exportTrendlines);
  $('#saveImage').click(exportChartAsImage);
});
