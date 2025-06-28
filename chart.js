let chart, candleSeries, buySellMarkers = [];
let isDrawingUp = false, isDrawingDown = false;
let drawPoints = [];

function initChart() {
  $("#chart").empty();  
  chart = createChart(document.getElementById("chart"), {
    width: window.innerWidth,
    height: 500,
    layout: { backgroundColor: "#111", textColor: "#eee" },
    grid: { vertLines: { color: "#333" }, horzLines: { color: "#333" } },
  });

  candleSeries = chart.addCandlestickSeries();
}

function fetchCandles(symbol, interval) {
  const url = `https://proxy.onrender.com/https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`;

  $.getJSON(url, function(data) {
    const candles = data.map(d => ({
      time: d[0] / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
    }));

    candleSeries.setData(candles);
    addBuySellSignals(candles);
  });
}

function addBuySellSignals(candles) {
  const emaPeriod = 10;
  const ema = [];

  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close;
    if (i < emaPeriod) {
      ema.push(close);
    } else {
      const prev = ema[ema.length - 1];
      ema.push((close - prev) * 2 / (emaPeriod + 1) + prev);
    }
  }

  const markers = [];

  for (let i = emaPeriod + 1; i < candles.length; i++) {
    if (candles[i - 1].close < ema[i - 1] && candles[i].close > ema[i]) {
      markers.push({ time: candles[i].time, position: 'belowBar', color: 'green', shape: 'arrowUp', text: 'Buy' });
    } else if (candles[i - 1].close > ema[i - 1] && candles[i].close < ema[i]) {
      markers.push({ time: candles[i].time, position: 'aboveBar', color: 'red', shape: 'arrowDown', text: 'Sell' });
    }
  }

  candleSeries.setMarkers(markers);
}

function handleMouseClick(param) {
  if (!param || !param.time) return;
  drawPoints.push(param);

  if (drawPoints.length === 2) {
    const lineSeries = chart.addLineSeries({
      color: isDrawingUp ? 'lime' : 'red',
      lineWidth: 2,
    });

    lineSeries.setData([
      { time: drawPoints[0].time, value: drawPoints[0].seriesPrices.get(candleSeries).close },
      { time: drawPoints[1].time, value: drawPoints[1].seriesPrices.get(candleSeries).close }
    ]);

    drawPoints = [];
    isDrawingUp = isDrawingDown = false;
  }
}

$(document).ready(function() {
  initChart();

  $("#symbol, #interval").on("change", function() {
    fetchCandles($("#symbol").val(), $("#interval").val());
  });

  $("#drawUp").on("click", () => {
    isDrawingUp = true; isDrawingDown = false; drawPoints = [];
  });

  $("#drawDown").on("click", () => {
    isDrawingDown = true; isDrawingUp = false; drawPoints = [];
  });

  chart.subscribeClick(handleMouseClick);
  fetchCandles($("#symbol").val(), $("#interval").val());
});
