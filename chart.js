
// Full final chart.js code placed here (from earlier completed answer)
let chart, candleSeries;
let emaLine, rsiLine, macdLine, signalLine, macdHistogram;
let rsiChart, macdChart;
let drawPoints = [];
let isDrawingUp = false;
let isDrawingDown = false;

let lastCandleTime = null;
let priceSocket = null;
let livePriceLine = null;

function initChart() {
  document.getElementById("chart").innerHTML = "";

  chart = LightweightCharts.createChart(document.getElementById("chart"), {
    width: window.innerWidth,
    height: 500,
    layout: { backgroundColor: "#181a20", textColor: "#ccc" },
    grid: { vertLines: { color: "#444" }, horzLines: { color: "#444" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
  });

  candleSeries = chart.addCandlestickSeries();
}

// Remaining full code (fetchCandles, drawIndicators, startRealTimePrice, etc.)
// Due to message length, continued in next step...

function fetchCandles(symbol, interval) {
  const url = `https://api.binance.me/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`;

  $.getJSON(url, function (data) {
    const candles = data.map(d => ({
      time: d[0] / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));

    candleSeries.setData(candles);
    drawBuySellSignals(candles);
    drawIndicators(candles);

    lastCandleTime = candles[candles.length - 1].time;
    startRealTimePrice(symbol);
  });
}

function startRealTimePrice(symbol) {
  if (priceSocket) {
    priceSocket.close();
    priceSocket = null;
  }

  const proxyUrl = 'wss://binance-ws-proxy-zcno.onrender.com'; // Replace with your Render WebSocket URL
  priceSocket = new WebSocket(proxyUrl);

  let lastCandle = null;

  priceSocket.onopen = () => {
    priceSocket.send(symbol);
  };

  priceSocket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    const price = parseFloat(data.p);
    const volume = parseFloat(data.q);
    const time = Math.floor(data.T / 1000);

    if (!lastCandle || time > lastCandle.time) {
      lastCandle = {
        time: time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume
      };
    } else {
      lastCandle.close = price;
      lastCandle.high = Math.max(lastCandle.high, price);
      lastCandle.low = Math.min(lastCandle.low, price);
      lastCandle.volume += volume;
    }

    candleSeries.update(lastCandle);

    if (livePriceLine) candleSeries.removePriceLine(livePriceLine);
    livePriceLine = candleSeries.createPriceLine({
      price: price,
      color: 'yellow',
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Live'
    });
  };
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

$(document).ready(function () {
  initChart();
  fetchCandles($("#symbol").val(), $("#interval").val());

  $("#symbol, #interval, #indicator").change(function () {
    initChart();
    fetchCandles($("#symbol").val(), $("#interval").val());
  });

  $("#drawUp").click(function () {
    isDrawingUp = true;
    isDrawingDown = false;
    drawPoints = [];
  });

  $("#drawDown").click(function () {
    isDrawingDown = true;
    isDrawingUp = false;
    drawPoints = [];
  });

  setTimeout(() => {
    chart.subscribeClick(handleMouseClick);
  }, 500);
});
