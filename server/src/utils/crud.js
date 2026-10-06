const express = require('express');
const { Op } = require('sequelize');
const { wrap, fail, validate, pick, toBool, paginate, paged } = require('./http');
const { makeUpload, fileUrl, removeFile } = require('../middleware/upload');

/**
 * Generic REST resource: GET / (search + paging + filters), GET /:id, POST /, PUT /:id, DELETE /:id
 * opts: { fields, rules, search, filters, include, order, files: ['image'], folder, booleans, beforeSave, afterSave, canDelete }
 */
function crud(Model, opts) {
  const r = express.Router();
  const files = opts.files || [];
  const upload = files.length ? makeUpload(opts.folder || Model.name, opts.types ? { types: opts.types, maxMb: 8 } : undefined).fields(files.map((name) => ({ name, maxCount: 1 }))) : (_q, _s, n) => n();

  const body = (req) => {
    const data = pick(req.body, opts.fields);
    for (const b of opts.booleans || []) if (data[b] !== undefined) data[b] = toBool(data[b]);
    for (const [k, v] of Object.entries(data)) if (v === '') data[k] = null;
    for (const f of files) if (req.files?.[f]?.[0]) data[f] = fileUrl(opts.folder || Model.name, req.files[f][0]);
    return data;
  };

  r.get('/', wrap(async (req, res) => {
    const p = paginate(req);
    const where = { ...(opts.where || {}) };
    const q = (req.query.search || '').trim();
    if (q && opts.search) where[Op.or] = opts.search.map((f) => ({ [f]: { [Op.like]: `%${q}%` } }));
    for (const f of opts.filters || []) if (req.query[f] !== undefined && req.query[f] !== '') where[f] = req.query[f];
    if (req.query.all === '1') return res.json({ data: await Model.findAll({ where, include: opts.include, order: opts.order || [['id', 'DESC']] }) });
    const { rows, count } = await Model.findAndCountAll({ where, include: opts.include, order: opts.order || [['id', 'DESC']], limit: p.limit, offset: p.offset, distinct: true });
    res.json(paged(rows, count, p));
  }));

  r.post('/bulk-delete', wrap(async (req, res) => {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean).slice(0, 500);
    if (!ids.length) fail(422, 'Select at least one row');
    let n = 0;
    for (const row of await Model.findAll({ where: { id: ids } })) {
      if (opts.canDelete && (await opts.canDelete(row, req))) continue;
      for (const f of files) removeFile(row[f]);
      await row.destroy(); n += 1;
    }
    res.json({ message: `${n} deleted` });
  }));

  r.get('/:id', wrap(async (req, res) => {
    const row = await Model.findByPk(req.params.id, { include: opts.include });
    if (!row) fail(404, 'Not found');
    res.json({ data: row });
  }));

  r.post('/', upload, wrap(async (req, res) => {
    if (opts.rules) validate(req.body, opts.rules);
    let data = body(req);
    if (opts.beforeSave) data = (await opts.beforeSave(data, req, null)) || data;
    const row = await Model.create(data);
    if (opts.afterSave) await opts.afterSave(row, req);
    res.status(201).json({ data: row, message: 'Saved successfully' });
  }));

  r.put('/:id', upload, wrap(async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) fail(404, 'Not found');
    if (opts.rules) validate({ ...row.toJSON(), ...req.body }, opts.rules);
    let data = body(req);
    if (opts.beforeSave) data = (await opts.beforeSave(data, req, row)) || data;
    for (const f of files) if (data[f] && row[f] !== data[f]) removeFile(row[f]);
    await row.update(data);
    if (opts.afterSave) await opts.afterSave(row, req);
    res.json({ data: row, message: 'Updated successfully' });
  }));

  r.delete('/:id', wrap(async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) fail(404, 'Not found');
    if (opts.canDelete) { const msg = await opts.canDelete(row, req); if (msg) fail(422, msg); }
    for (const f of files) removeFile(row[f]);
    await row.destroy();
    res.json({ message: 'Deleted successfully' });
  }));

  return r;
}

module.exports = crud;
