const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { uploadDir } = require('../config');
const { HttpError } = require('../utils/http');

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico'};
const DOC_TYPES = { ...IMAGE_TYPES, 'application/pdf': '.pdf' };

function makeUpload(folder, { types = IMAGE_TYPES, maxMb = 5 } = {}) {
  const dir = path.join(uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      // never trust the client filename: random name + extension from the verified mime type
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + types[file.mimetype]),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => (types[file.mimetype] ? cb(null, true) : cb(new HttpError(422, `File type ${file.mimetype} is not allowed`))),
  });
}

const fileUrl = (folder, file) => (file ? `/uploads/${folder}/${file.filename}` : undefined);

function removeFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const abs = path.join(uploadDir, url.replace('/uploads/', ''));
  if (abs.startsWith(uploadDir)) fs.promises.unlink(abs).catch(() => {});
}

module.exports = { makeUpload, fileUrl, removeFile, IMAGE_TYPES, DOC_TYPES };
