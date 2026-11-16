/*
 * Styled QR codes as SVG: dot / rounded modules and round "eyes" (the three corner squares).
 * The qrcode library only draws plain squares, so the matrix is drawn here. Every style keeps the modules on the
 * standard grid, so scanners read them the same way; "dots" are kept large (0.9 of a module) for the same reason.
 */
const QRCode = require('qrcode');

const STYLES = ['square', 'rounded', 'dots'];
const EYES = ['square', 'rounded', 'circle'];
const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);

function svg(text, { fg, bg, margin = 2, ec = 'M', style = 'square', eye = 'square', size = 600 } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: ['L', 'M', 'Q', 'H'].includes(ec) ? ec : 'M' });
  const n = qr.modules.size; const data = qr.modules.data;
  const m = Math.max(0, Math.min(8, Number(margin) || 0));
  const dark = hex(fg, '#000000'); const light = hex(bg, '#ffffff');
  const st = STYLES.includes(style) ? style : 'square'; const ey = EYES.includes(eye) ? eye : 'square';
  const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const on = (r, c) => r >= 0 && c >= 0 && r < n && c < n && data[r * n + c];
  const parts = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!on(r, c) || inEye(r, c)) continue;
      const x = c + m; const y = r + m;
      if (st === 'dots') parts.push(`<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.45"/>`);
      else if (st === 'rounded') {
        // round only the corners that have no neighbour, so runs of modules stay connected
        const t = on(r - 1, c); const b = on(r + 1, c); const l = on(r, c - 1); const rt = on(r, c + 1);
        const R = 0.5; const tl = !t && !l ? R : 0; const tr = !t && !rt ? R : 0; const br = !b && !rt ? R : 0; const bl = !b && !l ? R : 0;
        parts.push(`<path d="M${x + tl} ${y}H${x + 1 - tr}${tr ? `a${R} ${R} 0 0 1 ${R} ${R}` : ''}V${y + 1 - br}${br ? `a${R} ${R} 0 0 1 -${R} ${R}` : ''}H${x + bl}${bl ? `a${R} ${R} 0 0 1 -${R} -${R}` : ''}V${y + tl}${tl ? `a${R} ${R} 0 0 1 ${R} -${R}` : ''}z"/>`);
      } else parts.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
  }
  // eyes: outer ring 7x7, gap, inner 3x3
  for (const [er, ec2] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = ec2 + m; const y = er + m;
    if (ey === 'circle') parts.push(`<circle cx="${x + 3.5}" cy="${y + 3.5}" r="3" fill="none" stroke="${dark}" stroke-width="1"/><circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.5"/>`);
    else {
      const ro = ey === 'rounded' ? 2 : 0; const ri = ey === 'rounded' ? 0.9 : 0;
      parts.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="${ro}" fill="none" stroke="${dark}" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${ri}"/>`);
    }
  }
  const total = n + m * 2; const px = Math.max(100, Math.min(2000, Number(size) || 600));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="${st === 'square' && ey === 'square' ? 'crispEdges' : 'geometricPrecision'}"><rect width="${total}" height="${total}" fill="${light}"/><g fill="${dark}">${parts.join('')}</g></svg>`;
}

const isStyled = (q) => !!q && ((q.style && q.style !== 'square') || (q.eye && q.eye !== 'square'));

module.exports = { svg, isStyled, STYLES, EYES };
