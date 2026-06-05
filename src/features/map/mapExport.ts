/**
 * Export the rendered world map as a shareable PNG (story / post / wide).
 * The live SVG uses CSS custom properties for fills, which canvas can't resolve,
 * so we clone it and inline the *computed* colors before rasterizing.
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

export interface MapExportMeta {
  title: string;
  subtitle?: string;
  legend: { color: string; label: string }[];
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
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = cssVar('--paper');
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round(w * 0.06);
  const headerH = Math.round(h * 0.12);
  const footerH = Math.round(h * 0.08);
  const availW = w - pad * 2;
  const availH = h - headerH - footerH;
  const scale = Math.min(availW / vw, availH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (w - dw) / 2;
  const dy = headerH + (availH - dh) / 2;

  ctx.fillStyle = cssVar('--sea');
  ctx.fillRect(dx, dy, dw, dh);
  ctx.drawImage(img, dx, dy, dw, dh);

  // Title
  ctx.fillStyle = cssVar('--ink');
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.round(w * 0.052)}px Newsreader, Georgia, serif`;
  ctx.fillText(meta.title, w / 2, Math.round(headerH * 0.55));
  if (meta.subtitle) {
    ctx.fillStyle = cssVar('--ink-soft');
    ctx.font = `500 ${Math.round(w * 0.024)}px 'Hanken Grotesk', system-ui, sans-serif`;
    ctx.fillText(meta.subtitle, w / 2, Math.round(headerH * 0.82));
  }

  // Legend
  const sw = Math.round(w * 0.022);
  const gap = Math.round(w * 0.045);
  const fontSize = Math.round(w * 0.02);
  ctx.font = `600 ${fontSize}px 'Hanken Grotesk', system-ui, sans-serif`;
  const widths = meta.legend.map((l) => sw + 8 + ctx.measureText(l.label).width + gap);
  const totalW = widths.reduce((a, b) => a + b, 0) - gap;
  let x = (w - totalW) / 2;
  const y = h - footerH / 2;
  for (let i = 0; i < meta.legend.length; i++) {
    const item = meta.legend[i]!;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - sw / 2, sw, sw);
    ctx.fillStyle = cssVar('--ink-soft');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, x + sw + 8, y);
    x += widths[i]!;
  }

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement('a');
        const objUrl = URL.createObjectURL(blob);
        link.href = objUrl;
        link.download = `travel-map-${format.id}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
      }
      resolve();
    }, 'image/png');
  });
}
