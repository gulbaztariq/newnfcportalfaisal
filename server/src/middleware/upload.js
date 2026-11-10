const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { uploadDir } = require('../config');
const { HttpError } = require('../utils/http');

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico'};
const DOC_TYPES = { ...IMAGE_TYPES, 'application/pdf': '.pdf' };

/** File content must match the type the client declared (the declared type alone is attacker controlled). */
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  'image/gif': (b) => /^GIF8[79]a/.test(b.subarray(0, 6).toString('latin1')),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'image/x-icon': (b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0,
  'image/vnd.microsoft.icon': (b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0,
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'video/mp4': (b) => b.subarray(4, 8).toString('latin1') === 'ftyp',
  'video/webm': (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
};
const uploaded = (req) => [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean);
async function verifyContent(req, _res, next) {
  const files = uploaded(req);
  try {
    for (const f of files) {
      const check = SIGNATURES[f.mimetype];
      const fh = await fs.promises.open(f.path, 'r');
      const head = Buffer.alloc(16); await fh.read(head, 0, 16, 0); await fh.close();
      if (!check || !check(head)) throw new HttpError(422, 'The file content does not match its type');
    }
    next();
  } catch (e) { await Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => {}))); next(e instanceof HttpError ? e : new HttpError(422, 'The uploaded file could not be checked')); }
}

function makeUpload(folder, { types = IMAGE_TYPES, maxMb = 5 } = {}) {
  const dir = path.join(uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  const mw = multer({
    storage: multer.diskStorage({
      destination: dir,
      // never trust the client filename: random name + extension from the verified mime type
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + types[file.mimetype]),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => (types[file.mimetype] ? cb(null, true) : cb(new HttpError(422, `File type ${file.mimetype} is not allowed`))),
  });
  // same API as multer (single / fields / array ...) but every accepted file is also checked by its content
  const withCheck = (name) => (...args) => [mw[name](...args), verifyContent];
  return { single: withCheck('single'), fields: withCheck('fields'), array: withCheck('array'), any: withCheck('any') };
}

const fileUrl = (folder, file) => (file ? `/uploads/${folder}/${file.filename}` : undefined);

function removeFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const abs = path.join(uploadDir, url.replace('/uploads/', ''));
  if (abs.startsWith(uploadDir)) fs.promises.unlink(abs).catch(() => {});
}

module.exports = { makeUpload, fileUrl, removeFile, IMAGE_TYPES, DOC_TYPES };
