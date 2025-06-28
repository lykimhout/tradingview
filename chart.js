let chart, candleSeries;
let drawPoints = [];
let isDrawingUp = false;
let isDrawingDown = false;

let lastCandle = null;
let priceSocket = null;

function initChart() {
  document.getElementById("chart").innerHTML = "";

  chart = LightweightCharts.createChart(document.getElementById("chart"), {
    width: window.innerWidth,
    height: 500,
    layout: { backgroundColor: "#181a20", textColor: "#ccc" },
    grid: { vertLines: { color: "#444" }, horzLines: { color: "#444" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    timeScale: {
      rightOffset: 5,
      lockVisibleTimeRangeOnResize: true
    }
  });

  candleSeries = chart.addCandlestickSeries();
}


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

    // ✅ Set historical data to chart
    candleSeries.setData(candles);

    // ✅ Initialize real-time candle state
    lastCandle = candles[candles.length - 1];

    // ✅ Keep the chart locked on the latest data
    chart.timeScale().scrollToRealTime();

    // ✅ Start live updates and countdown
    startRealTimePrice(symbol);
    startCountdown(interval); // 🕒 Don't forget this!
  });
}


function startRealTimePrice(symbol) {
  if (priceSocket) {
    priceSocket.close();
    priceSocket = null;
  }

  // Use your actual WebSocket proxy URL here
  const proxyUrl = 'wss://binance-ws-proxy-me.onrender.com';
  priceSocket = new WebSocket(proxyUrl);

  priceSocket.onopen = () => {
    priceSocket.send(symbol);
  };

  priceSocket.onmessage = async function (event) {
    try {
      const text = await event.data.text();
      const data = JSON.parse(text);

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

    } catch (err) {
      console.error('WebSocket message error:', err);
    }
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

let countdownInterval;

function startCountdown(interval) {
  clearInterval(countdownInterval);

  const msMap = {
    '1m': 60,
    '3m': 180,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '2h': 7200,
    '4h': 14400,
    '6h': 21600,
    '8h': 28800,
    '12h': 43200,
    '1d': 86400,
  };

  const secondsPerCandle = msMap[interval] || 60;

  countdownInterval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - lastCandle.time;
    const remaining = secondsPerCandle - (elapsed % secondsPerCandle);

    const min = Math.floor(remaining / 60).toString().padStart(2, '0');
    const sec = (remaining % 60).toString().padStart(2, '0');

    $("#countdown").text(`Next candle in: ${min}:${sec}`);
  }, 1000);
}

$(document).ready(function () {
  initChart();
  fetchCandles($("#symbol").val(), $("#interval").val());

  $("#symbol, #interval").change(function () {
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
