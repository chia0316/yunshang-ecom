const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { Op } = require('sequelize');

const Product = require('../productModels/Product.model');
const Category = require('../productModels/Category.model');
const ProductFeaturedTag = require('../productModels/ProductFeaturedTag.model');
const { authenticate, attachAdminFlag } = require('../utils/authenticator');
const { multiImageUpload, videoUpload, imageUploadDir, videoUploadDir } = require('../uploads/upload');

// Bulk-remove's file is just a SKU list, always tiny — memory storage is
// fine there. Bulk-upload's images ZIP can be large, so it gets its own
// disk-backed upload below instead of sharing this one.
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Bulk-upload's Excel/CSV + images ZIP are streamed straight to disk rather
// than buffered in memory — at up to 500MB combined, holding that in RAM
// per upload (on top of what unzipping needs) risks exhausting the droplet's
// memory, especially under concurrent uploads. Disk space is cheap by
// comparison, and the temp files are deleted once processing finishes
// (success or failure) via the try/finally in the route handler below.
const bulkUploadTempDir = path.join(os.tmpdir(), 'yunshang-bulk-upload');
fs.mkdirSync(bulkUploadTempDir, { recursive: true });
const MAX_BULK_UPLOAD_BYTES = 500 * 1024 * 1024;
const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, bulkUploadTempDir),
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: MAX_BULK_UPLOAD_BYTES }
});

const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];
const MAX_ZIP_ENTRY_BYTES = 15 * 1024 * 1024;

// Stock isn't tracked by count in this store (furniture is made to order) —
// a blank Stock Qty cell means "available", not "0 left", so it defaults to
// a large in-stock number rather than accidentally marking the row out of
// stock. Never shown to customers as a number, only used as a >0 check.
const DEFAULT_STOCK_QTY = 999;

const EXPECTED_COLUMNS = {
  product_handle: ['product handle', 'handle'],
  sku: ['sku'],
  name: ['name'],
  category: ['category'],
  brand: ['brand'],
  short_description: ['short description'],
  description: ['full description'],
  variant_options: ['variant options'],
  price: ['price (sgd)', 'price'],
  sale_price: ['sale price (sgd)', 'sale price'],
  weight_kg: ['weight (kg)', 'weight'],
  dimensions: ['dimensions', 'measurements', 'size'],
  lead_time_days: ['lead time (days)', 'lead time'],
  tags: ['tags'],
  image_filenames: ['image list', 'images'],
  video_filename: ['video filename', 'video'],
  featured_tag: ['featured?', 'featured'],
  is_active: ['active?', 'active']
};

// "Material: Leather; Color: Black" -> { Material: 'Leather', Color: 'Black' }.
// A bare value with no "Name:" prefix (e.g. just "Vancouver") is treated as
// a single unnamed option rather than rejected, since that's how simpler
// single-axis variant sheets tend to get filled in.
const parseVariantOptions = (raw) => {
  if (!raw || !String(raw).trim()) return null;
  const result = {};
  String(raw)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) {
        result.Option = pair;
      } else {
        const key = pair.slice(0, colonIndex).trim();
        const value = pair.slice(colonIndex + 1).trim();
        if (key && value) result[key] = value;
      }
    });
  return Object.keys(result).length > 0 ? result : null;
};

const toBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return /^(y|yes|true|1)$/i.test(String(value).trim());
};

// Shared by the bulk-delete (product list) and bulk-remove (mass upload)
// flows. A product that's ever been ordered can't be hard-deleted — the
// order_details FK is ON DELETE RESTRICT, by design, so order history never
// silently disappears — so this falls back to deactivating it instead
// (is_active: false), which is the app's actual "hide this product"
// mechanism everywhere else. Returns which of the two actually happened.
const deleteOrDeactivateProduct = async (product) => {
  try {
    await product.destroy();
    return { status: 'deleted' };
  } catch (err) {
    if (err.name !== 'SequelizeForeignKeyConstraintError') throw err;
    await product.update({ is_active: false });
    return { status: 'deactivated', message: 'Has order history — deactivated instead of deleted' };
  }
};

const toList = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const parseWorksheet = (worksheet) => {
  let headerRowNumber = null;
  let columnMap = {};

  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 15); rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const cellValues = row.values.map((v) =>
      typeof v === 'string' ? v.trim().toLowerCase() : ''
    );
    if (cellValues.includes('sku')) {
      headerRowNumber = rowNumber;
      cellValues.forEach((cellValue, colIndex) => {
        for (const [field, aliases] of Object.entries(EXPECTED_COLUMNS)) {
          if (aliases.includes(cellValue)) {
            columnMap[field] = colIndex;
          }
        }
      });
      break;
    }
  }

  if (headerRowNumber === null) {
    throw new Error('Could not find a header row containing an "SKU" column');
  }

  const rows = [];
  for (
    let rowNumber = headerRowNumber + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber++
  ) {
    const row = worksheet.getRow(rowNumber);
    const get = (field) =>
      columnMap[field] ? row.getCell(columnMap[field]).value : undefined;

    const sku = get('sku');
    if (!sku) continue;

    rows.push({
      // Relative to the header row, not the raw sheet row — so the first
      // actual data row reports as "Row 1" (what admins expect), not "Row 2"
      // (which only made sense counting the header itself as row 1).
      rowNumber: rowNumber - headerRowNumber,
      product_handle: get('product_handle'),
      sku: String(sku).trim(),
      name: get('name'),
      category: get('category'),
      brand: get('brand'),
      short_description: get('short_description'),
      description: get('description'),
      variant_options: get('variant_options'),
      price: get('price'),
      sale_price: get('sale_price'),
      weight_kg: get('weight_kg'),
      dimensions: get('dimensions'),
      lead_time_days: get('lead_time_days'),
      tags: get('tags'),
      image_filenames: get('image_filenames'),
      video_filename: get('video_filename'),
      featured_tag: get('featured_tag'),
      is_active: get('is_active')
    });
  }
  return rows;
};

// Extracts an uploaded images ZIP straight into public/images. Every entry
// is written using only its basename (never the raw zip path) so a
// maliciously-crafted entry name like "../../etc/passwd" can't escape the
// upload directory (zip-slip). Returns a report of anything skipped
// (unsupported format, oversized when uncompressed) or overwritten so the
// admin can see exactly what happened, not just a final file count.
const extractImagesZip = async (zipFilePath) => {
  const zip = new AdmZip(zipFilePath);
  const zipReport = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const filename = path.basename(entry.entryName);
    if (!filename) continue;

    // macOS's Finder "Compress" adds a __MACOSX/ folder full of ._-prefixed
    // AppleDouble metadata sidecar files (one per real file, same name and
    // extension) plus .DS_Store — none of these are real images, but they'd
    // otherwise pass the extension check below and pollute the gallery.
    if (entry.entryName.startsWith('__MACOSX/') || filename.startsWith('._') || filename === '.DS_Store') {
      continue;
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      zipReport.push({
        filename,
        status: 'skipped',
        reason: `Unsupported format${ext ? ` (${ext})` : ''} — only PNG, JPG, JPEG, or WEBP allowed`
      });
      continue;
    }

    if (entry.header.size > MAX_ZIP_ENTRY_BYTES) {
      zipReport.push({
        filename,
        status: 'skipped',
        reason: `File too large uncompressed (max ${Math.round(MAX_ZIP_ENTRY_BYTES / (1024 * 1024))}MB)`
      });
      continue;
    }

    const targetPath = path.join(imageUploadDir, filename);
    if (fs.existsSync(targetPath)) {
      const usedBy = await Product.findAll({
        where: { image_filenames: { [Op.contains]: [filename] } },
        attributes: ['sku']
      });
      if (usedBy.length > 0) {
        zipReport.push({
          filename,
          status: 'overwritten',
          reason: `Replaced an image already used by SKU(s): ${usedBy.map((p) => p.sku).join(', ')}`
        });
      }
    }

    fs.writeFileSync(targetPath, entry.getData());
  }

  return zipReport;
};

router.get('/', attachAdminFlag, async (req, res) => {
  try {
    const { category_id, brand, tags, searchText, featured } = req.query;
    const page = parseInt(req.query.page) || 1;
    const page_size = parseInt(req.query.page_size) || 12;
    const offset = (page - 1) * page_size;
    const includeInactive = req.isAdmin && req.query.includeInactive === 'true';
    const grouped = req.query.grouped === 'true';

    const where = {};
    if (!includeInactive) where.is_active = true;
    if (category_id) where.category_id = category_id;
    if (brand) where.brand = brand;
    if (featured !== undefined) {
      where.featured_tag_id = featured === 'true' ? { [Op.not]: null } : null;
    }
    if (tags) where.tags = { [Op.overlap]: toList(tags) };
    if (searchText) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${searchText}%` } },
        { short_description: { [Op.iLike]: `%${searchText}%` } },
        { brand: { [Op.iLike]: `%${searchText}%` } },
        { sku: { [Op.iLike]: `%${searchText}%` } }
      ];
    }

    if (!grouped) {
      const rows = await Product.findAndCountAll({
        where,
        include: [
          { model: Category, attributes: ['id', 'name'] },
          { model: ProductFeaturedTag, as: 'featured_tag', attributes: ['id', 'label'] }
        ],
        order: [['created_at', 'DESC']],
        offset,
        limit: page_size
      });

      return res.json({
        total_pages: Math.ceil(rows.count / page_size),
        total: rows.count,
        data: rows.rows
      });
    }

    // Featured products sort ahead of everything else, ordered by the tag's
    // own admin-configurable sort_order (see Settings > Featured Tags) —
    // looked up in JS rather than joined into the candidates query below,
    // since there are only ever a handful of tags.
    const featuredTagSortOrder = new Map(
      (await ProductFeaturedTag.findAll({ attributes: ['id', 'sort_order'] })).map((t) => [
        t.id,
        t.sort_order
      ])
    );

    // Storefront listing/category pages: variant rows sharing a
    // product_handle collapse into one card. Groups (not rows) are what
    // gets paginated, so this fetches every matching row's lightweight
    // fields first, groups+paginates in JS, then loads full data only for
    // the page's representative rows. Fine at this catalog's size — would
    // need a real SQL DISTINCT ON if the catalog grew into the thousands.
    const candidates = await Product.findAll({
      where,
      attributes: ['id', 'product_handle', 'price', 'createdAt', 'featured_tag_id'],
      order: [['createdAt', 'DESC']]
    });

    const groups = new Map();
    for (const row of candidates) {
      const key = row.product_handle || `__standalone_${row.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    const groupSummaries = Array.from(groups.values()).map((members) => {
      const prices = members.map((m) => parseFloat(m.price));
      const representative = members.reduce((lowest, m) =>
        parseFloat(m.price) < parseFloat(lowest.price) ? m : lowest
      );
      return {
        representativeId: representative.id,
        createdAt: representative.createdAt,
        variantCount: members.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        featuredSortOrder: featuredTagSortOrder.has(representative.featured_tag_id)
          ? featuredTagSortOrder.get(representative.featured_tag_id)
          : null
      };
    });
    groupSummaries.sort((a, b) => {
      // Featured (non-null) always beats un-featured (null); among featured
      // groups, lower sort_order wins; ties (including the un-featured
      // bucket) fall back to newest first.
      if (a.featuredSortOrder === null && b.featuredSortOrder !== null) return 1;
      if (a.featuredSortOrder !== null && b.featuredSortOrder === null) return -1;
      if (a.featuredSortOrder !== null && b.featuredSortOrder !== a.featuredSortOrder) {
        return a.featuredSortOrder - b.featuredSortOrder;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const total = groupSummaries.length;
    const pageSummaries = groupSummaries.slice(offset, offset + page_size);

    const products = await Product.findAll({
      where: { id: { [Op.in]: pageSummaries.map((s) => s.representativeId) } },
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: ProductFeaturedTag, as: 'featured_tag', attributes: ['id', 'label'] }
      ]
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    const data = pageSummaries.map((s) => ({
      ...productsById.get(s.representativeId).toJSON(),
      variant_count: s.variantCount,
      min_price: s.minPrice,
      max_price: s.maxPrice
    }));

    return res.json({
      total_pages: Math.ceil(total / page_size),
      total,
      data
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/single/:pid', attachAdminFlag, async (req, res) => {
  try {
    const { pid } = req.params;
    const product = await Product.findOne({
      where: { id: pid },
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: ProductFeaturedTag, as: 'featured_tag', attributes: ['id', 'label'] }
      ]
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (!product.is_active && !req.isAdmin) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Sibling variants (including this one) power the variant switcher on
    // the product page — empty array for a standalone (non-variant) product.
    let variants = [];
    if (product.product_handle) {
      variants = await Product.findAll({
        where: {
          product_handle: product.product_handle,
          ...(req.isAdmin ? {} : { is_active: true })
        },
        attributes: ['id', 'sku', 'price', 'sale_price', 'stock_qty', 'variant_options', 'image_filenames'],
        order: [['price', 'ASC']]
      });
    }

    return res.json({ ...product.toJSON(), variants });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const {
      sku,
      name,
      brand,
      category_id,
      short_description,
      description,
      price,
      sale_price,
      weight_kg,
      dimensions,
      lead_time_days,
      tags,
      image_filenames,
      video_filename,
      featured_tag_id,
      product_handle,
      variant_options,
      is_active
    } = req.body;

    const product = await Product.create({
      sku,
      name,
      brand,
      category_id,
      short_description,
      description,
      price,
      sale_price: sale_price || null,
      // Stock isn't captured anywhere (form or Excel) — this store doesn't
      // track count, so every product is simply available by default.
      stock_qty: DEFAULT_STOCK_QTY,
      weight_kg: weight_kg || null,
      dimensions: dimensions || null,
      lead_time_days: lead_time_days || 0,
      tags: tags || [],
      image_filenames: image_filenames || [],
      video_filename: video_filename || null,
      featured_tag_id: featured_tag_id || null,
      product_handle: product_handle || null,
      variant_options: variant_options || null,
      is_active: is_active === undefined ? true : is_active
    });
    return res.status(201).json({ message: 'Product added successfully!', product });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:pid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { pid } = req.params;
  const allowedFields = [
    'sku',
    'name',
    'brand',
    'category_id',
    'short_description',
    'description',
    'price',
    'sale_price',
    'weight_kg',
    'dimensions',
    'lead_time_days',
    'tags',
    'image_filenames',
    'video_filename',
    'featured_tag_id',
    'product_handle',
    'variant_options',
    'is_active'
  ];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );
  try {
    const updated = await Product.update(updates, { where: { id: pid } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Product not found', success: false });
    }
    return res.json({ message: 'Product updated successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:pid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const { pid } = req.params;
    const product = await Product.findByPk(pid);
    if (!product) {
      return res.status(404).json({ message: 'Product not found', success: false });
    }
    const result = await deleteOrDeactivateProduct(product);
    return res.json({
      message:
        result.status === 'deleted'
          ? 'Product deleted successfully!'
          : 'Product has order history, so it was deactivated instead of deleted.',
      status: result.status,
      success: true
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Deletes each selected product, falling back to deactivating it if it has
// order history (see deleteOrDeactivateProduct). Used by the product list's
// multi-select "Delete Selected" action.
router.post('/bulk-delete', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  try {
    const report = [];
    for (const id of ids) {
      const product = await Product.findByPk(id);
      if (!product) {
        report.push({ id, status: 'error', message: 'Product not found' });
        continue;
      }
      const { sku } = product;
      try {
        const result = await deleteOrDeactivateProduct(product);
        report.push({ id, sku, ...result });
      } catch (err) {
        report.push({ id, sku, status: 'error', message: err.message });
      }
    }
    const summary = {
      deleted: report.filter((r) => r.status === 'deleted').length,
      deactivated: report.filter((r) => r.status === 'deactivated').length,
      errors: report.filter((r) => r.status === 'error').length
    };
    return res.json({ summary, report });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Saves product photos to local/VM disk (public/images) and returns the
// stored filenames — pair them with the Image List column on the next bulk
// upload, or pass them directly in image_filenames on create/update.
router.post('/upload-images', authenticate, (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  multiImageUpload(req, res, (error) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const filenames = req.files.map((file) => file.filename);
    return res.json({ filenames });
  });
});

// Saves a single product video to local/VM disk (public/videos) and returns
// the stored filename — pass it directly in video_filename on create/update.
router.post('/upload-video', authenticate, (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  videoUpload(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Video must be 10MB or smaller' });
      }
      return res.status(400).json({ error: error.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    return res.json({ filename: req.file.filename });
  });
});

// Lists everything currently sitting in public/images so admin can browse
// what's already uploaded (e.g. to find a filename to reuse) without
// digging through the server's filesystem directly.
router.get('/images', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const filenames = fs
      .readdirSync(imageUploadDir)
      .filter((filename) => !filename.startsWith('.'))
      .filter((filename) => ALLOWED_IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase()))
      .sort();
    return res.json({ filenames });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Lists everything currently sitting in public/videos, same purpose as
// /images above but for the single product-video slot.
router.get('/videos', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const filenames = fs
      .readdirSync(videoUploadDir)
      .filter((filename) => !filename.startsWith('.'))
      .filter((filename) => ALLOWED_VIDEO_EXTENSIONS.includes(path.extname(filename).toLowerCase()))
      .sort();
    return res.json({ filenames });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Generates a fresh bulk-upload template (columns always match
// EXPECTED_COLUMNS above) rather than shipping a static file that can drift
// out of sync with the actual schema.
router.get('/bulk-upload/template', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const featuredTags = await ProductFeaturedTag.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC']]
    });
    const featuredTagLabels = featuredTags.map((t) => t.label);

    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    const categoryNames = categories.map((c) => c.name);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');
    sheet.columns = [
      { header: 'Product Handle', key: 'product_handle', width: 22 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Short Description', key: 'short_description', width: 30 },
      { header: 'Full Description', key: 'description', width: 40 },
      { header: 'Variant Options', key: 'variant_options', width: 24 },
      { header: 'Price (SGD)', key: 'price', width: 12 },
      { header: 'Sale Price (SGD)', key: 'sale_price', width: 14 },
      { header: 'Weight (kg)', key: 'weight_kg', width: 12 },
      { header: 'Dimensions', key: 'dimensions', width: 20 },
      { header: 'Lead Time (Days)', key: 'lead_time_days', width: 14 },
      { header: 'Tags', key: 'tags', width: 20 },
      { header: 'Image List', key: 'image_filenames', width: 30 },
      { header: 'Video Filename', key: 'video_filename', width: 20 },
      { header: 'Featured?', key: 'featured_tag', width: 14 },
      { header: 'Active?', key: 'is_active', width: 10 }
    ];
    sheet.addRow({
      product_handle: '',
      sku: 'SOFA-001',
      name: 'Example 3-Seater Sofa',
      category: 'Sofas',
      brand: 'Casa Yun',
      short_description: 'A comfortable 3-seater sofa',
      description: 'Full product description goes here.',
      variant_options: '',
      price: 899,
      sale_price: '',
      weight_kg: 45.5,
      dimensions: '210 x 90 x 85 cm',
      lead_time_days: 0,
      tags: 'sofa, living room',
      image_filenames: 'sofa-front.jpg, sofa-side.jpg',
      video_filename: '',
      featured_tag: '',
      is_active: 'Yes'
    });

    // Worked variant example: 3 rows, one product ("Example L-Shape Sofa")
    // with 3 material variants. Only the first row of the group carries the
    // product-level fields — the other two leave them blank to inherit.
    sheet.addRow({
      product_handle: 'Example L-Shape Sofa',
      sku: 'SOFA-002-FAB',
      name: 'Example L-Shape Sofa',
      category: 'Sofas',
      brand: 'Casa Yun',
      short_description: 'L-shape sofa available in three materials.',
      description: 'Full product description goes here.',
      variant_options: 'Material: Fabric',
      price: 1899,
      sale_price: '',
      weight_kg: 60,
      dimensions: '280 x 180 x 85 cm',
      lead_time_days: 0,
      tags: 'sofa, living room',
      image_filenames: 'sofa-lshape-fabric.jpg',
      video_filename: '',
      featured_tag: '',
      is_active: 'Yes'
    });
    sheet.addRow({
      product_handle: 'Example L-Shape Sofa',
      sku: 'SOFA-002-LEA',
      variant_options: 'Material: Leather',
      price: 2499,
      dimensions: '280 x 180 x 85 cm',
      image_filenames: 'sofa-lshape-leather.jpg'
    });
    sheet.addRow({
      product_handle: 'Example L-Shape Sofa',
      sku: 'SOFA-002-PRM',
      variant_options: 'Material: Premium Leather',
      price: 3199,
      dimensions: '280 x 180 x 85 cm',
      image_filenames: 'sofa-lshape-premium.jpg'
    });

    // Real Excel dropdown for the Featured column, sourced live from the
    // configured product_featured_tags list rather than a hardcoded Yes/No —
    // keeps the template in sync automatically as admin adds/renames tags.
    const featuredColLetter = sheet.getColumn('featured_tag').letter;
    if (featuredTagLabels.length > 0) {
      const formula = `"${featuredTagLabels.join(',')}"`;
      for (let rowNumber = 2; rowNumber <= 200; rowNumber++) {
        sheet.getCell(`${featuredColLetter}${rowNumber}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid Featured tag',
          error: 'Please choose a value from the dropdown list, or leave blank.'
        };
      }
    }

    // Same live dropdown for Category — the upload no longer auto-creates a
    // category on a near-miss (e.g. "Bed" vs "Beds"), so this is what keeps
    // that from ever being a typo in the first place.
    const categoryColLetter = sheet.getColumn('category').letter;
    if (categoryNames.length > 0) {
      const formula = `"${categoryNames.join(',')}"`;
      for (let rowNumber = 2; rowNumber <= 200; rowNumber++) {
        sheet.getCell(`${categoryColLetter}${rowNumber}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid Category',
          error: 'Please choose a value from the dropdown list — categories are managed on the Categories page.'
        };
      }
    }

    const instructions = workbook.addWorksheet('Instructions');
    instructions.columns = [{ header: 'Instructions', key: 'text', width: 100 }];
    [
      'Fill in the Products sheet — one row per SKU (one variant). Existing SKUs are updated, new SKUs are created.',
      'Category must match an existing category name exactly (not case-sensitive) — it will NOT be created automatically. Check the Categories page for the exact spelling, or add a new category there first if you need one that doesn\'t exist yet.',
      'Product Handle: leave blank for a normal, single-SKU product (most rows). Fill it in only when a product has multiple variants (e.g. Material/Color options) — every row sharing the same Product Handle is treated as one product.',
      'For a multi-variant product: put the shared product-level fields (Name, Category, Brand, Short/Full Description, Tags, Image List, Video Filename, Featured?, Active?) on the FIRST row of the group only — leave them blank on the other rows, they\'ll inherit automatically. SKU, Variant Options, Price, Sale Price, Weight, and Dimensions are per-row (every variant has its own).',
      'Variant Options: this row\'s specific combination, as "Name: Value" pairs separated by semicolons, e.g. "Material: Leather; Color: Black". A single value with no "Name:" prefix (e.g. just "Leather") also works.',
      'See the worked example in this template: "Example L-Shape Sofa" spans 3 rows, one per Material option, each with its own SKU/price/image but sharing the product-level fields from the first row.',
      'Image List: comma-separated filenames, e.g. "sofa-front.jpg, sofa-side.jpg". On a variant row, leaving this blank inherits the group\'s images from the first row — fill it in only if this specific variant needs different photos.',
      'To upload new photos, ZIP them together and upload the ZIP alongside this file on the bulk-upload screen — filenames inside the ZIP must exactly match the Image List column.',
      'Supported image formats inside the ZIP: PNG, JPG, JPEG, WEBP. Other file types are skipped and reported after upload.',
      'If a referenced image still isn\'t found after upload, the product is still created/updated — add the missing photo afterward via the product form.',
      'Video Filename: optional, a single video already uploaded via the product form (bulk video upload via ZIP is not supported).',
      `Featured?: optional, pick from the dropdown (currently: ${featuredTagLabels.length > 0 ? featuredTagLabels.join(', ') : 'no tags configured yet — set these up under Settings > Featured Tags'}). Leave blank for not featured. Values are managed in the admin Settings > Featured Tags page.`
    ].forEach((text) => instructions.addRow({ text }));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="product-bulk-upload-template.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
          return res.status(400).json({ error: 'File too large (max 500MB per file)' });
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

    const totalBytes = file.size + (zipFile?.size || 0);
    if (totalBytes > MAX_BULK_UPLOAD_BYTES) {
      cleanupTempFiles();
      return res.status(400).json({
        error: `Upload too large — the Excel/CSV and images ZIP combined must be under ${Math.round(MAX_BULK_UPLOAD_BYTES / (1024 * 1024))}MB`
      });
    }

    try {
      let zipReport = [];
      if (zipFile) {
        zipReport = await extractImagesZip(zipFile.path);
      }
      const existingImageFiles = new Set(fs.readdirSync(imageUploadDir));

      const workbook = new ExcelJS.Workbook();
      const isCsv = file.originalname.toLowerCase().endsWith('.csv');
      if (isCsv) {
        await workbook.csv.readFile(file.path);
      } else {
        await workbook.xlsx.readFile(file.path);
      }
      const worksheet = workbook.worksheets[0];
      const rows = parseWorksheet(worksheet);

      // Does NOT auto-create on a near-miss (e.g. "Bed" vs "Beds") — that
      // silently produced duplicate categories in practice. An unrecognized
      // category name is a row error instead; admin manages the real list
      // via the Categories page, same as resolveFeaturedTagId below.
      const categoryCache = new Map();
      const resolveCategoryId = async (categoryName) => {
        const key = String(categoryName).trim().toLowerCase();
        if (categoryCache.has(key)) return categoryCache.get(key);
        const category = await Category.findOne({
          where: { name: { [Op.iLike]: key } }
        });
        if (!category) {
          throw new Error(
            `Unknown Category "${categoryName}" — must match an existing category exactly (check the Categories page), or create it there first`
          );
        }
        categoryCache.set(key, category.id);
        return category.id;
      };

      // Unlike resolveCategoryId, this never auto-creates — the Featured
      // list is admin-configured, so an unrecognized value is a row error
      // (most likely a typo or a stale tag), not a new tag to add silently.
      const featuredTagCache = new Map();
      const resolveFeaturedTagId = async (rawLabel) => {
        if (!rawLabel || !String(rawLabel).trim()) return null;
        const key = String(rawLabel).trim().toLowerCase();
        if (featuredTagCache.has(key)) return featuredTagCache.get(key);
        const tag = await ProductFeaturedTag.findOne({
          where: { label: { [Op.iLike]: key } }
        });
        if (!tag) {
          throw new Error(
            `Unknown Featured value "${rawLabel}" — must match a tag configured under Settings > Featured Tags, or be left blank`
          );
        }
        featuredTagCache.set(key, tag.id);
        return tag.id;
      };

      // Rows sharing a Product Handle are variants of one product — only
      // the group's first row is expected to carry these product-level
      // fields, so later rows in the same group inherit whatever they
      // leave blank from it.
      const groupDefaults = new Map();
      const INHERITABLE_FIELDS = [
        'name',
        'category',
        'brand',
        'short_description',
        'description',
        'tags',
        'image_filenames',
        'video_filename',
        'featured_tag',
        'is_active'
      ];

      const report = [];
      for (const row of rows) {
        try {
          const handle = row.product_handle ? String(row.product_handle).trim() : null;
          if (handle) {
            if (!groupDefaults.has(handle)) {
              const defaults = {};
              INHERITABLE_FIELDS.forEach((field) => {
                defaults[field] = row[field];
              });
              groupDefaults.set(handle, defaults);
            } else {
              const defaults = groupDefaults.get(handle);
              INHERITABLE_FIELDS.forEach((field) => {
                if (row[field] === undefined || row[field] === null || row[field] === '') {
                  row[field] = defaults[field];
                }
              });
            }
          }

          if (!row.name || !row.category || !row.price) {
            throw new Error('Missing required field (Name, Category, or Price)');
          }
          const category_id = await resolveCategoryId(row.category);
          const featured_tag_id = await resolveFeaturedTagId(row.featured_tag);
          const values = {
            sku: row.sku,
            product_handle: handle,
            variant_options: parseVariantOptions(row.variant_options),
            name: row.name,
            brand: row.brand || null,
            category_id,
            short_description: row.short_description || null,
            description: row.description || null,
            price: parseFloat(row.price),
            sale_price: row.sale_price ? parseFloat(row.sale_price) : null,
            // Not captured in the sheet — this store doesn't track stock
            // count, so every uploaded product is simply available.
            stock_qty: DEFAULT_STOCK_QTY,
            weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
            dimensions: row.dimensions || null,
            lead_time_days: row.lead_time_days ? parseInt(row.lead_time_days, 10) : 0,
            tags: toList(row.tags),
            image_filenames: toList(row.image_filenames),
            video_filename: row.video_filename || null,
            featured_tag_id,
            is_active: toBoolean(row.is_active, true)
          };

          const imageIssues = values.image_filenames
            .map((filename) => {
              const ext = path.extname(filename).toLowerCase();
              if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
                return `Unsupported format: ${filename}`;
              }
              if (!existingImageFiles.has(filename)) {
                return `Image not found: ${filename}`;
              }
              return null;
            })
            .filter(Boolean);

          const existing = await Product.findOne({ where: { sku: row.sku } });
          if (existing) {
            await existing.update(values);
            report.push({
              row: row.rowNumber,
              sku: row.sku,
              status: 'updated',
              ...(imageIssues.length > 0 && { imageIssues })
            });
          } else {
            await Product.create(values);
            report.push({
              row: row.rowNumber,
              sku: row.sku,
              status: 'created',
              ...(imageIssues.length > 0 && { imageIssues })
            });
          }
        } catch (rowError) {
          report.push({
            row: row.rowNumber,
            sku: row.sku,
            status: 'error',
            message: rowError.message
          });
        }
      }

      const summary = {
        total: report.length,
        created: report.filter((r) => r.status === 'created').length,
        updated: report.filter((r) => r.status === 'updated').length,
        errors: report.filter((r) => r.status === 'error').length
      };

      return res.json({ summary, report, zipReport });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    } finally {
      // Temp copies on disk (see diskUpload above) — clean up regardless of
      // outcome so a 500MB upload doesn't linger in /tmp after every run.
      cleanupTempFiles();
    }
  }
);

// Simple one-column template for the mass-upload dialog's "Remove" mode —
// deliberately much smaller than the full product template, since removing
// products only needs their SKUs.
router.get('/bulk-remove/template', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Remove');
    sheet.columns = [{ header: 'SKU', key: 'sku', width: 24 }];
    sheet.addRow({ sku: 'SOFA-001' });

    const instructions = workbook.addWorksheet('Instructions');
    instructions.columns = [{ header: 'Instructions', key: 'text', width: 100 }];
    [
      'List one SKU per row — every matching product will be removed.',
      'If a product has order history, it can\'t be permanently deleted (order records must stay intact) — it gets deactivated instead, which hides it from the storefront the same way. The report after upload shows which happened for each SKU.',
      'A SKU that doesn\'t match any product is reported as an error and skipped — nothing else is affected.'
    ].forEach((text) => instructions.addRow({ text }));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="product-bulk-remove-template.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/bulk-remove',
  authenticate,
  (req, res, next) => {
    memoryUpload.single('file')(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large (max 50MB)' });
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
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const isCsv = file.originalname.toLowerCase().endsWith('.csv');
      if (isCsv) {
        await workbook.csv.read(Readable.from(file.buffer));
      } else {
        await workbook.xlsx.load(file.buffer);
      }
      const worksheet = workbook.worksheets[0];
      const rows = parseWorksheet(worksheet);

      const report = [];
      for (const row of rows) {
        try {
          const product = await Product.findOne({ where: { sku: row.sku } });
          if (!product) {
            report.push({ row: row.rowNumber, sku: row.sku, status: 'error', message: 'SKU not found' });
            continue;
          }
          const result = await deleteOrDeactivateProduct(product);
          report.push({ row: row.rowNumber, sku: row.sku, ...result });
        } catch (rowError) {
          report.push({ row: row.rowNumber, sku: row.sku, status: 'error', message: rowError.message });
        }
      }

      const summary = {
        total: report.length,
        deleted: report.filter((r) => r.status === 'deleted').length,
        deactivated: report.filter((r) => r.status === 'deactivated').length,
        errors: report.filter((r) => r.status === 'error').length
      };

      return res.json({ summary, report });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
