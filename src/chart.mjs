const SVG_NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 220;
const PLOT = { top: 21, bottom: 185 };

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const escapeText = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const coordinate = value => Number.isFinite(value) ? Number(value.toFixed(3)) : 0;

function formatTick(value) {
  if (!Number.isFinite(value) || Object.is(value, -0) || value === 0) return '0';
  const absolute = Math.abs(value);
  if (absolute >= 100000 || absolute < 0.01) {
    return value.toExponential(1).replace('.', ',').replace('e+', 'e');
  }
  return new Intl.NumberFormat('nl-NL', {
    maximumFractionDigits: absolute < 1 ? 2 : 1
  }).format(value);
}

function niceStep(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  if (!Number.isFinite(magnitude) || magnitude === 0) return null;
  const fraction = raw / magnitude;
  const factor = [1, 1.5, 2, 2.5, 4, 5, 10].find(candidate => candidate >= fraction) ?? 10;
  const result = factor * magnitude;
  return Number.isFinite(result) && result > 0 ? result : null;
}

/** Four labelled grid levels, including zero, with a little headroom. */
function priceScale(minimum, maximum) {
  const extent = Math.max(Math.abs(minimum), Math.abs(maximum));
  if (extent === 0) {
    return {
      ticks: [0, 1, 2, 3],
      y: value => PLOT.bottom - value / 3 * (PLOT.bottom - PLOT.top),
      zeroY: PLOT.bottom
    };
  }

  const negativeIntervals = minimum < 0 ? (maximum > 0 ? (Math.abs(minimum) > maximum ? 2 : 1) : 3) : 0;
  const positiveIntervals = 3 - negativeIntervals;
  const needed = Math.max(
    negativeIntervals ? Math.abs(minimum) / negativeIntervals : 0,
    positiveIntervals ? maximum / positiveIntervals : 0
  );
  const step = niceStep(needed * 1.06);
  let lower;
  let upper;
  let ticks;

  if (step && Number.isFinite(step * 3)) {
    lower = -negativeIntervals * step;
    upper = positiveIntervals * step;
    ticks = Array.from({ length: 4 }, (_, index) => (index - negativeIntervals) * step);
  } else {
    // Keep even extreme finite inputs representable; ordinary prices use the nice scale above.
    lower = Math.min(0, minimum);
    upper = Math.max(0, maximum);
    ticks = minimum < 0 && maximum > 0
      ? (Math.abs(minimum) > maximum ? [minimum, minimum / 2, 0, maximum] : [minimum, 0, maximum / 2, maximum])
      : minimum < 0 ? [minimum, minimum * (2 / 3), minimum / 3, 0]
        : [0, maximum / 3, maximum * (2 / 3), maximum];
  }

  const normalizedLower = lower / extent;
  const normalizedUpper = upper / extent;
  const range = normalizedUpper - normalizedLower;
  const plotHeight = PLOT.bottom - PLOT.top;
  const y = value => PLOT.top + ((normalizedUpper - value / extent) / range) * plotHeight;
  return { ticks, y, zeroY: y(0) };
}

/**
 * Render a full-day price chart. Values are already converted to ct/kWh by the caller.
 * Input slots are never changed. Invalid numeric prices remain gaps, not zero prices.
 * The parent owns keyboard navigation, the selected-value display, and any tooltip.
 */
export function renderPriceChart({ slots, selectedIndex = 0, mode = 'import', resolution = 'hour', width = 700 } = {}) {
  const chartWidth = Math.min(1400, Math.max(240, isFiniteNumber(width) && width > 0 ? Math.round(width) : 700));
  const plot = { left: chartWidth < 400 ? 36 : 40, right: chartWidth - 12 };
  const entries = Array.isArray(slots) ? slots : [];
  const count = entries.length;
  const selected = count ? Math.max(0, Math.min(count - 1, isFiniteNumber(selectedIndex) ? Math.floor(selectedIndex) : 0)) : -1;
  let minimum = 0;
  let maximum = 0;
  let validCount = 0;
  for (let index = 0; index < count; index += 1) {
    const value = entries[index]?.displayValue;
    if (!isFiniteNumber(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    validCount += 1;
  }

  const interval = resolution === 'quarter' || resolution === 'quarter-hour' || (resolution !== 'hour' && count > 48) ? 'kwartier' : 'uur';
  const measure = mode === 'market' ? 'Marktprijs' : mode === 'export' ? 'Netto terugleverwaarde' : 'Afnameprijs';
  const title = `${measure} per ${interval}, in cent per kilowattuur`;
  const description = validCount
    ? `${validCount} prijswaarden. De horizontale nulgrens scheidt positieve en negatieve prijzen. Gebruik de tijdschuif of tabel voor de afzonderlijke waarden.`
    : 'Er zijn nog geen geldige prijsgegevens beschikbaar.';
  const scale = priceScale(minimum, maximum);
  const plotWidth = plot.right - plot.left;
  const plotHeight = PLOT.bottom - PLOT.top;
  const bandWidth = count ? plotWidth / count : 0;
  const parts = [
    `<svg xmlns="${SVG_NS}" class="chart-svg" viewBox="0 0 ${chartWidth} ${HEIGHT}" width="100%" height="${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${escapeText(title)}">`,
    `<title>${escapeText(title)}</title><desc>${escapeText(description)}</desc>`,
    `<text x="${plot.left}" y="11" text-anchor="start" style="font-size:11px">ct/kWh</text>`
  ];

  for (const tick of scale.ticks) {
    const position = coordinate(scale.y(tick));
    const isZero = tick === 0;
    parts.push(
      `<line class="${isZero ? 'zero-line' : 'gridline'}" x1="${plot.left}" y1="${position}" x2="${plot.right}" y2="${position}" vector-effect="non-scaling-stroke"${isZero ? ' style="stroke-width:1.35"' : ''}/>`
    );
    parts.push(`<text x="${plot.left - 10}" y="${coordinate(position + 3.5)}" text-anchor="end" style="font-size:11px">${escapeText(formatTick(tick))}</text>`);
  }

  if (validCount) {
    const inset = count > 48 ? Math.max(0.5, bandWidth * 0.16) : Math.max(2, bandWidth * 0.17);
    const barWidth = Math.max(0.15, bandWidth - inset * 2);
    for (let index = 0; index < count; index += 1) {
      const slot = entries[index];
      const value = slot?.displayValue;
      if (!isFiniteNumber(value)) continue;
      const fill = index === selected ? '#2268e8' : value < 0 ? '#72b6a1' : '#bfd3f7';
      const endpoint = scale.y(value);
      const top = Math.min(endpoint, scale.zeroY);
      const actualHeight = Math.abs(endpoint - scale.zeroY);
      const barHeight = Math.max(1, actualHeight);
      // A zero price is represented by a one-pixel mark on the baseline.
      const barTop = value === 0 ? Math.max(PLOT.top, scale.zeroY - 1) : Math.min(top, PLOT.bottom - barHeight);
      parts.push(`<rect class="bar${index === selected ? ' is-selected' : ''}" data-slot="${index}" x="${coordinate(plot.left + index * bandWidth + inset)}" y="${coordinate(barTop)}" width="${coordinate(barWidth)}" height="${coordinate(barHeight)}" rx="${count > 48 ? 1 : 3}" fill="${fill}"/>`);
    }

    // Redraw the zero boundary over the marks, so negative-only and mixed plots stay explicit.
    parts.push(`<line class="zero-line" x1="${plot.left}" y1="${coordinate(scale.zeroY)}" x2="${plot.right}" y2="${coordinate(scale.zeroY)}" vector-effect="non-scaling-stroke" style="stroke-width:1.35"/>`);

    for (let index = 0; index < count; index += 1) {
      if (!isFiniteNumber(entries[index]?.displayValue)) continue;
      parts.push(`<rect class="hit" data-slot="${index}" x="${coordinate(plot.left + index * bandWidth)}" y="${PLOT.top}" width="${coordinate(bandWidth)}" height="${plotHeight}" fill="transparent"/>`);
    }
  } else {
    parts.push(`<text x="${plot.left + plotWidth / 2}" y="${PLOT.top + plotHeight / 2}" text-anchor="middle" style="font-size:11px">Nog geen prijsgegevens</text>`);
  }

  for (const hour of [0, 6, 12, 18, 24]) {
    const actualIndex = entries.findIndex(slot => isFiniteNumber(slot?.hour) && Math.abs(slot.hour - hour) < 0.001);
    if (hour !== 24 && count && actualIndex < 0) continue;
    const position = hour === 24 ? plot.right : plot.left + (count && actualIndex >= 0 ? actualIndex / count : hour / 24) * plotWidth;
    parts.push(`<text x="${coordinate(position)}" y="211" text-anchor="${hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle'}" style="font-size:11px">${String(hour).padStart(2, '0')}:00</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

/** Decorative, accessible solar profile; negative and invalid samples render at zero. */
export function renderSolarSparkline(values) {
  const samples = Array.isArray(values) ? values : [];
  const count = samples.length;
  let maximum = 0;
  for (const value of samples) {
    if (isFiniteNumber(value)) maximum = Math.max(maximum, value);
  }
  const left = 2;
  const right = 128;
  const top = 5;
  const baseline = 52;
  const x = index => count > 1 ? left + index / (count - 1) * (right - left) : left;
  const y = value => maximum > 0 && isFiniteNumber(value) ? baseline - Math.max(0, value) / maximum * (baseline - top) : baseline;
  let line;

  if (count < 2) {
    const position = y(samples[0]);
    line = `M ${left} ${coordinate(position)} L ${right} ${coordinate(position)}`;
  } else {
    line = `M ${left} ${coordinate(y(samples[0]))}`;
    for (let index = 1; index < count; index += 1) {
      const previousX = x(index - 1);
      const currentX = x(index);
      const middle = (previousX + currentX) / 2;
      line += ` C ${coordinate(middle)} ${coordinate(y(samples[index - 1]))} ${coordinate(middle)} ${coordinate(y(samples[index]))} ${coordinate(currentX)} ${coordinate(y(samples[index]))}`;
    }
  }
  const area = `${line} L ${right} ${baseline} L ${left} ${baseline} Z`;
  return `<svg xmlns="${SVG_NS}" class="solar-sparkline" viewBox="0 0 130 55" width="130" height="55" preserveAspectRatio="none" role="img" aria-label="Profiel van de zonne-opwek"><title>Profiel van de zonne-opwek</title><path d="${area}" fill="#e6be68" fill-opacity="0.2"/><path d="${line}" fill="none" stroke="#d5a643" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
