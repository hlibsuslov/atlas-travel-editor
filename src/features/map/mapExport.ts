/**
 * Export the rendered world map as a shareable PNG (story / post / wide).
 * The live SVG uses CSS custom properties for fills, which canvas can't resolve,
 * so we clone it and inline the *computed* colors before rasterizing.
 *
 * Quality: the canvas is rendered at a device-pixel-ratio-aware scale (min 2x)
 * and the SVG is rasterized at that higher resolution, so the map and text stay
 * crisp on retina screens and when downloaded. All text is centred with generous
 * margins, on the sea background, with a localized caption + legend counts and an
 * "Atlas" wordmark and date in the footer.
 */
export interface ExportFormat {
  id: string;
  w: number;
  h: number;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'story', w: 1080, h: 1920 },
  { id: 'post', w: 1080, h: 1080 },
  { id: 'wide', w: 1600, h: 900 },
];

function cssVar(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '#ffffff';
}

function inlineComputedColors(src: Element, dst: Element): void {
  const srcEls = src.querySelectorAll('*');
  const dstEls = dst.querySelectorAll('*');
  for (let i = 0; i < srcEls.length && i < dstEls.length; i++) {
    const cs = getComputedStyle(srcEls[i]!);
    const d = dstEls[i] as SVGElement;
    if (cs.fill) d.setAttribute('fill', cs.fill);
    if (cs.stroke && cs.stroke !== 'none') d.setAttribute('stroke', cs.stroke);
    if (cs.strokeWidth) d.setAttribute('stroke-width', cs.strokeWidth);
    d.style.removeProperty('transition');
    d.style.removeProperty('cursor');
  }
}

/** One legend entry: a status colour, its label, and (optionally) its count. */
export interface ExportLegendItem {
  color: string;
  label: string;
  /** Per-status count shown after the label, e.g. "Visited 12". Optional. */
  count?: number;
}

export interface MapExportMeta {
  title: string;
  subtitle?: string;
  /**
   * Accurate coverage caption, e.g. "42 of 193 countries · 22% of the world".
   * Built by the caller from the UN-193 stats (NOT the old denominator) and
   * already localized.
   */
  caption?: string;
  legend: ExportLegendItem[];
  /**
   * Footer wordmark (defaults to "Atlas"). The export date is appended
   * automatically using the active locale.
   */
  wordmark?: string;
  /** Localized date string for the footer; defaults to today in the active locale. */
  dateLabel?: string;
}

/** A short YYYY-MM-DD stamp for filenames (locale-independent, sortable). */
function fileDateStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function exportMapPng(
  svg: SVGSVGElement,
  format: ExportFormat,
  meta: MapExportMeta,
): Promise<void> {
  await (document.fonts?.ready ?? Promise.resolve());

  const vb = svg.viewBox.baseVal;
  const vw = vb.width || 960;
  const vh = vb.height || 500;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedColors(svg, clone);
  clone.setAttribute('width', String(vw));
  clone.setAttribute('height', String(vh));
  clone.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  clone.removeAttribute('style');

  const xml = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('map render failed'));
    img.src = url;
  });

  const { w, h } = format;
  // Render at >=2x (and honour a higher devicePixelRatio) for crisp output; the
  // CSS canvas keeps the logical w×h via the style size, while the backing store
  // is scaled up. All drawing math below uses logical coordinates.
  const dpr = Math.max(2, Math.round(window.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  // High-quality image scaling for the rasterized map.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background (paper).
  ctx.fillStyle = cssVar('--paper');
  ctx.fillRect(0, 0, w, h);

  // Generous, format-aware margins. Taller layouts (story) get more header room.
  const pad = Math.round(w * 0.07);
  const headerH = Math.round(h * (h > w ? 0.16 : 0.18));
  const footerH = Math.round(h * (h > w ? 0.13 : 0.16));
  const availW = w - pad * 2;
  const availH = h - headerH - footerH;
  const scale = Math.min(availW / vw, availH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (w - dw) / 2;
  const dy = headerH + (availH - dh) / 2;

  // Map panel: rounded sea card behind the map so it reads as a framed piece.
  const radius = Math.round(w * 0.018);
  const panelPad = Math.round(w * 0.015);
  ctx.fillStyle = cssVar('--sea');
  roundRect(ctx, dx - panelPad, dy - panelPad, dw + panelPad * 2, dh + panelPad * 2, radius);
  ctx.fill();
  ctx.drawImage(img, dx, dy, dw, dh);

  ctx.textAlign = 'center';

  // Title (serif display).
  ctx.fillStyle = cssVar('--ink');
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(w * 0.05)}px Newsreader, Georgia, serif`;
  ctx.fillText(meta.title, w / 2, Math.round(headerH * 0.46));

  // Subtitle.
  let subY = Math.round(headerH * 0.7);
  if (meta.subtitle) {
    ctx.fillStyle = cssVar('--ink-soft');
    ctx.font = `500 ${Math.round(w * 0.022)}px 'Hanken Grotesk', system-ui, sans-serif`;
    ctx.fillText(meta.subtitle, w / 2, subY);
    subY += Math.round(w * 0.034);
  }

  // Caption: the accurate UN-193 coverage line, in the accent colour.
  if (meta.caption) {
    ctx.fillStyle = cssVar('--accent');
    ctx.font = `700 ${Math.round(w * 0.02)}px 'Hanken Grotesk', system-ui, sans-serif`;
    ctx.fillText(meta.caption, w / 2, subY);
  }

  // Legend with optional per-status counts, centred above the wordmark line.
  const sw = Math.round(w * 0.02);
  const gap = Math.round(w * 0.04);
  const fontSize = Math.round(w * 0.019);
  ctx.font = `600 ${fontSize}px 'Hanken Grotesk', system-ui, sans-serif`;
  const labelFor = (l: ExportLegendItem) =>
    l.count === undefined ? l.label : `${l.label} ${l.count}`;
  const widths = meta.legend.map((l) => sw + 9 + ctx.measureText(labelFor(l)).width + gap);
  const totalW = widths.reduce((a, b) => a + b, 0) - gap;
  let lx = (w - totalW) / 2;
  const legendY = h - Math.round(footerH * 0.55);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < meta.legend.length; i++) {
    const item = meta.legend[i]!;
    ctx.fillStyle = item.color;
    roundRect(ctx, lx, legendY - sw / 2, sw, sw, Math.round(sw * 0.28));
    ctx.fill();
    ctx.fillStyle = cssVar('--ink-soft');
    ctx.textAlign = 'left';
    ctx.fillText(labelFor(item), lx + sw + 9, legendY);
    lx += widths[i]!;
  }

  // Footer: "Atlas" wordmark · date, centred, mono, faint.
  const wordmark = meta.wordmark ?? 'Atlas';
  const dateLabel = meta.dateLabel ?? new Date().toLocaleDateString();
  ctx.fillStyle = cssVar('--ink-faint');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(w * 0.015)}px 'JetBrains Mono', ui-monospace, monospace`;
  ctx.fillText(`${wordmark.toUpperCase()} · ${dateLabel}`, w / 2, h - Math.round(footerH * 0.18));

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a');
        const objUrl = URL.createObjectURL(blob);
        link.href = objUrl;
        link.download = `atlas-travel-map-${format.id}-${fileDateStamp()}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
      }
      resolve();
    }, 'image/png');
  });
}

/** Trace a rounded rectangle path (no fill/stroke — caller decides). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
