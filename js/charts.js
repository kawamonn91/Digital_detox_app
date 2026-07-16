/**
 * charts.js — Canvas API によるチャート描画
 */

/**
 * 過去7日分の「スクロール負債」vs「ランニング」棒グラフ
 * @param {HTMLCanvasElement} canvas
 * @param {Array} data - getLast7Days() の出力
 */
function drawWeekChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  ctx.clearRect(0, 0, W, H);

  const padLeft = 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 28;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const maxDebt = Math.max(...data.map(d => d.scrollDebtMeters), 1);
  const maxRun  = Math.max(...data.map(d => d.runMeters), 1);
  const maxVal  = Math.max(maxDebt, maxRun, 50);

  const n = data.length;
  const groupW  = chartW / n;
  const barW    = Math.min(20, groupW * 0.35);
  const barGap  = 3;

  const days = ['日','月','火','水','木','金','土'];

  data.forEach((d, i) => {
    const x = padLeft + i * groupW + groupW / 2;

    // Debt bar
    const debtH = (d.scrollDebtMeters / maxVal) * chartH;
    const debtX = x - barW - barGap / 2;
    const debtY = padTop + chartH - debtH;

    const debtGrad = ctx.createLinearGradient(0, debtY, 0, padTop + chartH);
    debtGrad.addColorStop(0, 'rgba(239,68,68,0.9)');
    debtGrad.addColorStop(1, 'rgba(249,115,22,0.4)');
    ctx.fillStyle = debtGrad;
    roundRect(ctx, debtX, debtY, barW, debtH, 4);
    ctx.fill();

    // Run bar
    const runH = (d.runMeters / maxVal) * chartH;
    const runX  = x + barGap / 2;
    const runY  = padTop + chartH - runH;

    const runGrad = ctx.createLinearGradient(0, runY, 0, padTop + chartH);
    runGrad.addColorStop(0, 'rgba(34,197,94,0.9)');
    runGrad.addColorStop(1, 'rgba(6,182,212,0.4)');
    ctx.fillStyle = runGrad;
    roundRect(ctx, runX, runY, barW, runH, 4);
    ctx.fill();

    // Day label
    const date = d.dateObj || new Date(d.date);
    const dayLabel = days[date.getDay()];
    ctx.font = `500 10px 'Inter', sans-serif`;
    ctx.fillStyle = i === n - 1 ? 'rgba(167,139,250,0.9)' : 'rgba(148,163,184,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabel, x, H - 6);
  });

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = padTop + chartH * (1 - frac);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(W - padRight, y);
    ctx.stroke();
  });

  // Legend
  ctx.font = `600 9px 'Inter', sans-serif`;
  ctx.fillStyle = 'rgba(248,113,113,0.8)';
  ctx.textAlign = 'left';
  ctx.fillText('■ 負債', padLeft, 10);
  ctx.fillStyle = 'rgba(74,222,128,0.8)';
  ctx.fillText('■ 返済', padLeft + 48, 10);
}

/**
 * リング型進捗チャート
 * @param {HTMLCanvasElement} canvas
 * @param {number} percent - 0〜1
 * @param {string} color - CSSグラデ or 色
 * @param {string} label
 * @param {string} centerText
 */
function drawRingChart(canvas, percent, color, label, centerText) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(canvas.offsetWidth, canvas.offsetHeight) || 120;
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.38;
  const lw = size * 0.1;

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = lw;
  ctx.stroke();

  // Fill
  const start = -Math.PI / 2;
  const end   = start + Math.PI * 2 * Math.min(percent, 1);
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center text
  ctx.fillStyle = 'rgba(241,245,249,0.95)';
  ctx.font = `700 ${size * 0.18}px 'Space Grotesk', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(centerText, cx, cy - size * 0.04);

  ctx.fillStyle = 'rgba(148,163,184,0.7)';
  ctx.font = `500 ${size * 0.09}px 'Inter', sans-serif`;
  ctx.fillText(label, cx, cy + size * 0.14);
}

/**
 * 折れ線チャート（月間トレンド用）
 */
function drawLineChart(canvas, datasets) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  ctx.clearRect(0, 0, W, H);

  const pad = { top: 16, right: 8, bottom: 28, left: 8 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const allVals = datasets.flatMap(d => d.data);
  const maxVal  = Math.max(...allVals, 1);
  const n = datasets[0].data.length;

  datasets.forEach(dataset => {
    const { data, color, fill } = dataset;
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = pad.left + (i / (n - 1)) * chartW;
      const y = pad.top + chartH - (val / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (fill) {
      ctx.lineTo(pad.left + chartW, pad.top + chartH);
      ctx.lineTo(pad.left, pad.top + chartH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      grad.addColorStop(0, fill.from);
      grad.addColorStop(1, fill.to);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Dots
    data.forEach((val, i) => {
      const x = pad.left + (i / (n - 1)) * chartW;
      const y = pad.top + chartH - (val / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  });

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  [0.33, 0.66, 1].forEach(f => {
    const y = pad.top + chartH * (1 - f);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (h < 1) { h = 1; }
  if (h < r * 2) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export { drawWeekChart, drawRingChart, drawLineChart };
