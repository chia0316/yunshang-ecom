const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { Op } = require('sequelize');

const Product = require('../productModels/Product.model');
const Category = require('../productModels/Category.model');
const ProductFeaturedTag = require('../productModels/ProductFeaturedTag.model');
const { authenticate, attachAdminFlag } = require('../utils/authenticator');
const { multiImageUpload, videoUpload, imageUploadDir, videoUploadDir } = require('../uploads/upload');

// Bulk-upload accepts the Excel/CSV template plus an optional images ZIP —
// the ZIP can be sizeable (dozens of product photos), so this gets a higher
// cap than the individual-image/video upload endpoints.
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];
const MAX_ZIP_ENTRY_BYTES = 15 * 1024 * 1024;

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
  stock_qty: ['stock qty', 'stock quantity'],
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
      rowNumber,
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
      stock_qty: get('stock_qty'),
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
const extractImagesZip = async (buffer) => {
  const zip = new AdmZip(buffer);
  const zipReport = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const filename = path.basename(entry.entryName);
    if (!filename) continue;

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

    // Storefront listing/category pages: variant rows sharing a
    // product_handle collapse into one card. Groups (not rows) are what
    // gets paginated, so this fetches every matching row's lightweight
    // fields first, groups+paginates in JS, then loads full data only for
    // the page's representative rows. Fine at this catalog's size — would
    // need a real SQL DISTINCT ON if the catalog grew into the thousands.
    const candidates = await Product.findAll({
      where,
      attributes: ['id', 'product_handle', 'price', 'createdAt'],
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
        maxPrice: Math.max(...prices)
      };
    });
    groupSummaries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
      stock_qty,
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
      stock_qty: stock_qty || 0,
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
    'stock_qty',
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
    const deletedCount = await Product.destroy({ where: { id: pid } });
    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Product not found', success: false });
    }
    return res.json({ message: 'Product deleted successfully!', success: true });
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
      { header: 'Stock Qty', key: 'stock_qty', width: 10 },
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
      stock_qty: 10,
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
      stock_qty: 5,
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

    const instructions = workbook.addWorksheet('Instructions');
    instructions.columns = [{ header: 'Instructions', key: 'text', width: 100 }];
    [
      'Fill in the Products sheet — one row per SKU (one variant). Existing SKUs are updated, new SKUs are created.',
      'Product Handle: leave blank for a normal, single-SKU product (most rows). Fill it in only when a product has multiple variants (e.g. Material/Color options) — every row sharing the same Product Handle is treated as one product.',
      'For a multi-variant product: put the shared product-level fields (Name, Category, Brand, Short/Full Description, Tags, Image List, Video Filename, Featured?, Active?) on the FIRST row of the group only — leave them blank on the other rows, they\'ll inherit automatically. SKU, Variant Options, Price, Sale Price, Stock Qty, Weight, and Dimensions are per-row (every variant has its own).',
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
    memoryUpload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'imagesZip', maxCount: 1 }
    ])(req, res, (error) => {
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
    const file = req.files?.file?.[0];
    const zipFile = req.files?.imagesZip?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      let zipReport = [];
      if (zipFile) {
        zipReport = await extractImagesZip(zipFile.buffer);
      }
      const existingImageFiles = new Set(fs.readdirSync(imageUploadDir));

      const workbook = new ExcelJS.Workbook();
      const isCsv = file.originalname.toLowerCase().endsWith('.csv');
      if (isCsv) {
        await workbook.csv.read(Readable.from(file.buffer));
      } else {
        await workbook.xlsx.load(file.buffer);
      }
      const worksheet = workbook.worksheets[0];
      const rows = parseWorksheet(worksheet);

      const categoryCache = new Map();
      const resolveCategoryId = async (categoryName) => {
        const key = String(categoryName).trim().toLowerCase();
        if (categoryCache.has(key)) return categoryCache.get(key);
        let category = await Category.findOne({
          where: { name: { [Op.iLike]: key } }
        });
        if (!category) {
          category = await Category.create({ name: String(categoryName).trim() });
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
            stock_qty: row.stock_qty ? parseInt(row.stock_qty, 10) : 0,
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
    }
  }
);

module.exports = router;
