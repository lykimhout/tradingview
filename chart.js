let chart, candleSeries;
let drawPoints = [];
let isDrawingUp = false;
let isDrawingDown = false;

function initChart() {
  document.getElementById("chart").innerHTML = "";

  chart = LightweightCharts.createChart(document.getElementById("chart"), {
    width: window.innerWidth,
    height: 500,
    layout: { backgroundColor: "#0e0e0e", textColor: "#ccc" },
    grid: { vertLines: { color: "#444" }, horzLines: { color: "#444" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
  });

  candleSeries = chart.addCandlestickSeries();
}

function fetchCandles(symbol, interval) {
  const url = `https://api.binance.me/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`;

  $.getJSON(url, function(data) {
    const candles = data.map(d => ({
      time: d[0] / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
    }));

    candleSeries.setData(candles);
    drawBuySellSignals(candles);
  });
}

function drawBuySellSignals(candles) {
  const emaPeriod = 10;
  const ema = [];

  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close;
    if (i < emaPeriod) {
      ema.push(close);
    } else {
      const prevEma = ema[ema.length - 1];
      ema.push((close - prevEma) * 2 / (emaPeriod + 1) + prevEma);
    }
  }

  const markers = [];

  for (let i = emaPeriod + 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    const currClose = candles[i].close;

    const prevEma = ema[i - 1];
    const currEma = ema[i];

    if (prevClose < prevEma && currClose > currEma) {
      markers.push({
        time: candles[i].time,
        position: "belowBar",
        color: "lime",
        shape: "arrowUp",
        text: "Buy"
      });
    } else if (prevClose > prevEma && currClose < currEma) {
      markers.push({
        time: candles[i].time,
        position: "aboveBar",
        color: "red",
        shape: "arrowDown",
        text: "Sell"
      });
    }
  }

  candleSeries.setMarkers(markers);
}

function handleMouseClick(param) {
  if (!param || !param.time || !param.seriesPrices) return;

  drawPoints.push(param);

  if (drawPoints.length === 2) {
    const price1 = param.seriesPrices.get(candleSeries).close;
    const price0 = drawPoints[0].seriesPrices.get(candleSeries).close;

    const lineSeries = chart.addLineSeries({
      color: isDrawingUp ? "lime" : "red",
      lineWidth: 2,
    });

    lineSeries.setData([
      { time: drawPoints[0].time, value: price0 },
      { time: drawPoints[1].time, value: price1 }
    ]);

    drawPoints = [];
    isDrawingUp = false;
    isDrawingDown = false;
  }
}

$(document).ready(function() {
  initChart();
  fetchCandles($("#symbol").val(), $("#interval").val());

  $("#symbol, #interval").change(function() {
    initChart();
    fetchCandles($("#symbol").val(), $("#interval").val());
  });

  $("#drawUp").click(function() {
    isDrawingUp = true;
    isDrawingDown = false;
    drawPoints = [];
  });

  $("#drawDown").click(function() {
    isDrawingDown = true;
    isDrawingUp = false;
    drawPoints = [];
  });

  setTimeout(() => {
    chart.subscribeClick(handleMouseClick);
  }, 500);
});
