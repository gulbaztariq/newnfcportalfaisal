/* Strict SVG sanitiser for AI-generated / uploaded card designs (served as images, never inline) */
const sanitizeHtml = require('sanitize-html');

const TAGS = ['svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'title', 'desc'];
const ATTRS = ['xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'stroke-dasharray', 'opacity', 'transform', 'font-family', 'font-size', 'font-weight',
  'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'clip-path',
  'preserveAspectRatio', 'dx', 'dy'];

function sanitizeSvg(input) {
  const raw = String(input || '').slice(0, 400000);
  const m = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!m) return null;
  const clean = sanitizeHtml(m[0], {
    allowedTags: TAGS, allowedAttributes: { '*': ATTRS }, parser: { lowerCaseTags: false, lowerCaseAttributeNames: false, xmlMode: true },
    allowedSchemes: [], allowVulnerableTags: false,
    exclusiveFilter: (frame) => /url\(\s*['"]?(?!#)/i.test(Object.values(frame.attribs || {}).join(' ')), // only local url(#id) refs
  });
  if (!/^<svg/i.test(clean.trim())) return null;
  return clean.includes('xmlns=') ? clean : clean.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}

module.exports = { sanitizeSvg };
