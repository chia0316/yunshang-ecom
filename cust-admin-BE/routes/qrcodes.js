const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const os = require('os');
const path = require('path');

const QrCode = require('../productModels/QrCode.model');
const { authenticate } = require('../utils/authenticator');
const { qrImageUpload, qrUploadDir } = require('../uploads/upload');
const { extractImagesZip } = require('../utils/zipImageExtractor');

const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const MAX_ZIP_ENTRY_BYTES = 15 * 1024 * 1024;
// QR codes are small images and lists are short compared to the product
// catalog — no need for product.js's 500MB allowance.
const MAX_BULK_UPLOAD_BYTES = 50 * 1024 * 1024;

const bulkUploadTempDir = path.join(os.tmpdir(), 'yunshang-qr-bulk-upload');
fs.mkdirSync(bulkUploadTempDir, { recursive: true });
const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, bulkUploadTempDir),
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: MAX_BULK_UPLOAD_BYTES }
});

router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const qrCodes = await QrCode.findAll({ order: [['valid_from', 'DESC']] });
    return res.json(qrCodes);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticate,
  (req, res, next) => {
    qrImageUpload(req, res, (error) => {
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized request' });
    }
    const { name, valid_from, valid_until } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'QR code image is required' });
    }
    if (!name || !valid_from || !valid_until) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'name, valid_from, and valid_until are required' });
    }
    if (new Date(valid_until) <= new Date(valid_from)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'valid_until must be after valid_from' });
    }
    try {
      const qrCode = await QrCode.create({
        name,
        image_filename: req.file.filename,
        valid_from,
        valid_until
      });
      return res.status(201).json(qrCode);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// Generates a fresh bulk-upload template rather than shipping a static file
// that can drift out of sync — mirrors routes/product.js's template route.
router.get('/bulk-upload/template', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('QR Codes');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Valid From', key: 'valid_from', width: 16 },
      { header: 'Valid Until', key: 'valid_until', width: 16 },
      { header: 'Image Filename', key: 'image_filename', width: 30 }
    ];
    sheet.addRow({
      name: 'January gate code',
      valid_from: '2026-01-01',
      valid_until: '2026-01-31',
      image_filename: 'january-code.png'
    });
    sheet.addRow({
      name: 'February gate code',
      valid_from: '2026-02-01',
      valid_until: '2026-02-28',
      image_filename: 'february-code.png'
    });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.columns = [{ header: 'Instructions', key: 'text', width: 100 }];
    [
      'Fill in the QR Codes sheet — one row per code. Valid From/Valid Until dates should not overlap with another code unless you intend more than one code to be "active" at once (the soonest-expiring active code is what gets sent when an appointment is confirmed).',
      'Dates can be entered as YYYY-MM-DD or any format Excel recognizes as a date.',
      'Image Filename must exactly match a file inside the ZIP you upload alongside this sheet on the QR Codes screen.',
      'Supported image formats inside the ZIP: PNG, JPG, JPEG, WEBP.',
      'A row whose referenced image isn\'t found in the ZIP (or already on the server) is rejected — unlike products, a QR code with no image is useless, so that row is not created.'
    ].forEach((text) => instructions.addRow({ text }));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="qr-code-bulk-upload-template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const HEADER_ALIASES = {
  name: ['name'],
  valid_from: ['valid from', 'valid_from'],
  valid_until: ['valid until', 'valid_until'],
  image_filename: ['image filename', 'image_filename', 'image']
};

const parseQrWorksheet = (worksheet) => {
  let headerRowNumber = null;
  let columnMap = {};

  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 15); rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const cellValues = row.values.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''));
    if (cellValues.includes('image filename') || cellValues.includes('image_filename')) {
      headerRowNumber = rowNumber;
      cellValues.forEach((cellValue, colIndex) => {
        for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
          if (aliases.includes(cellValue)) {
            columnMap[field] = colIndex;
          }
        }
      });
      break;
    }
  }

  if (headerRowNumber === null) {
    throw new Error('Could not find a header row containing an "Image Filename" column');
  }

  const rows = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const get = (field) => (columnMap[field] ? row.getCell(columnMap[field]).value : undefined);

    const name = get('name');
    if (!name) continue;

    rows.push({
      rowNumber: rowNumber - headerRowNumber,
      name: String(name).trim(),
      valid_from: get('valid_from'),
      valid_until: get('valid_until'),
      image_filename: get('image_filename') ? String(get('image_filename')).trim() : null
    });
  }
  return rows;
};

router.post(
  '/bulk-upload',
  authenticate,
  (req, res, next) => {
    diskUpload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'imagesZip', maxCount: 1 }
    ])(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large (max 50MB per file)' });
        }
        return res.status(400).json({ error: error.message });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized request' });
    }
    const file = req.files?.file?.[0];
    const zipFile = req.files?.imagesZip?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cleanupTempFiles = () => {
      [file, zipFile].forEach((f) => {
        if (f) fs.unlink(f.path, () => {});
      });
    };

    try {
      let zipReport = [];
      if (zipFile) {
        zipReport = await extractImagesZip(zipFile.path, qrUploadDir, {
          allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
          maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
          // Zip-extracted QR images aren't timestamp-suffixed (same reason as
          // products — the Excel needs to reference the exact filename), so
          // re-uploading a batch that happens to reuse a name would silently
          // clobber a previous code's image. Warn if that filename is still
          // referenced by another QR code.
          checkCollision: async (filename) => {
            const usedBy = await QrCode.findOne({ where: { image_filename: filename } });
            return usedBy ? `Replaced an image already used by QR code "${usedBy.name}"` : null;
          }
        });
      }
      const existingImageFiles = new Set(fs.readdirSync(qrUploadDir));

      const workbook = new ExcelJS.Workbook();
      const isCsv = file.originalname.toLowerCase().endsWith('.csv');
      if (isCsv) {
        await workbook.csv.readFile(file.path);
      } else {
        await workbook.xlsx.readFile(file.path);
      }
      const rows = parseQrWorksheet(workbook.worksheets[0]);

      const report = [];
      for (const row of rows) {
        try {
          if (!row.valid_from || !row.valid_until || !row.image_filename) {
            throw new Error('Missing required field (Valid From, Valid Until, or Image Filename)');
          }
          if (new Date(row.valid_until) <= new Date(row.valid_from)) {
            throw new Error('Valid Until must be after Valid From');
          }
          if (!existingImageFiles.has(row.image_filename)) {
            throw new Error(`Image not found: ${row.image_filename}`);
          }

          await QrCode.create({
            name: row.name,
            image_filename: row.image_filename,
            valid_from: row.valid_from,
            valid_until: row.valid_until
          });
          report.push({ row: row.rowNumber, name: row.name, status: 'created' });
        } catch (rowError) {
          report.push({ row: row.rowNumber, name: row.name, status: 'error', message: rowError.message });
        }
      }

      const summary = {
        total: report.length,
        created: report.filter((r) => r.status === 'created').length,
        errors: report.filter((r) => r.status === 'error').length
      };

      return res.json({ summary, report, zipReport });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    } finally {
      cleanupTempFiles();
    }
  }
);

router.patch('/:id/revoke', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const qrCode = await QrCode.findByPk(req.params.id);
    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found', success: false });
    }
    await qrCode.update({ revoked_at: new Date() });
    return res.json({ message: 'QR code revoked', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const qrCode = await QrCode.findByPk(req.params.id);
    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found', success: false });
    }
    await qrCode.destroy();
    return res.json({ message: 'QR code deleted', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
