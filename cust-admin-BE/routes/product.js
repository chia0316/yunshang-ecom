const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { Op } = require('sequelize');

const Product = require('../productModels/Product.model');
const Category = require('../productModels/Category.model');
const { authenticate, attachAdminFlag } = require('../utils/authenticator');
const { multiImageUpload } = require('../uploads/upload');

const memoryUpload = multer({ storage: multer.memoryStorage() });

const EXPECTED_COLUMNS = {
  sku: ['sku'],
  name: ['name'],
  category: ['category'],
  brand: ['brand'],
  short_description: ['short description'],
  description: ['full description'],
  price: ['price (sgd)', 'price'],
  sale_price: ['sale price (sgd)', 'sale price'],
  stock_qty: ['stock qty', 'stock quantity'],
  weight_kg: ['weight (kg)', 'weight'],
  lead_time_days: ['lead time (days)', 'lead time'],
  tags: ['tags'],
  image_filenames: ['image list', 'images'],
  is_featured: ['featured?', 'featured'],
  is_active: ['active?', 'active']
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
      sku: String(sku).trim(),
      name: get('name'),
      category: get('category'),
      brand: get('brand'),
      short_description: get('short_description'),
      description: get('description'),
      price: get('price'),
      sale_price: get('sale_price'),
      stock_qty: get('stock_qty'),
      weight_kg: get('weight_kg'),
      lead_time_days: get('lead_time_days'),
      tags: get('tags'),
      image_filenames: get('image_filenames'),
      is_featured: get('is_featured'),
      is_active: get('is_active')
    });
  }
  return rows;
};

router.get('/', attachAdminFlag, async (req, res) => {
  try {
    const { category_id, brand, tags, searchText, featured } = req.query;
    const page = parseInt(req.query.page) || 1;
    const page_size = parseInt(req.query.page_size) || 12;
    const offset = (page - 1) * page_size;
    const includeInactive = req.isAdmin && req.query.includeInactive === 'true';

    const where = {};
    if (!includeInactive) where.is_active = true;
    if (category_id) where.category_id = category_id;
    if (brand) where.brand = brand;
    if (featured !== undefined) where.is_featured = featured === 'true';
    if (tags) where.tags = { [Op.overlap]: toList(tags) };
    if (searchText) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${searchText}%` } },
        { short_description: { [Op.iLike]: `%${searchText}%` } },
        { brand: { [Op.iLike]: `%${searchText}%` } },
        { sku: { [Op.iLike]: `%${searchText}%` } }
      ];
    }

    const rows = await Product.findAndCountAll({
      where,
      include: [{ model: Category, attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      offset,
      limit: page_size
    });

    return res.json({
      total_pages: Math.ceil(rows.count / page_size),
      total: rows.count,
      data: rows.rows
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
      include: [{ model: Category, attributes: ['id', 'name'] }]
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (!product.is_active && !req.isAdmin) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json(product);
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
      lead_time_days,
      tags,
      image_filenames,
      is_featured,
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
      lead_time_days: lead_time_days || 0,
      tags: tags || [],
      image_filenames: image_filenames || [],
      is_featured: is_featured || false,
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
    'lead_time_days',
    'tags',
    'image_filenames',
    'is_featured',
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

router.post(
  '/bulk-upload',
  authenticate,
  memoryUpload.single('file'),
  async (req, res) => {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized request' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const isCsv = req.file.originalname.toLowerCase().endsWith('.csv');
      if (isCsv) {
        await workbook.csv.read(Readable.from(req.file.buffer));
      } else {
        await workbook.xlsx.load(req.file.buffer);
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

      const report = [];
      for (const row of rows) {
        try {
          if (!row.name || !row.category || !row.price) {
            throw new Error('Missing required field (Name, Category, or Price)');
          }
          const category_id = await resolveCategoryId(row.category);
          const values = {
            sku: row.sku,
            name: row.name,
            brand: row.brand || null,
            category_id,
            short_description: row.short_description || null,
            description: row.description || null,
            price: parseFloat(row.price),
            sale_price: row.sale_price ? parseFloat(row.sale_price) : null,
            stock_qty: row.stock_qty ? parseInt(row.stock_qty, 10) : 0,
            weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
            lead_time_days: row.lead_time_days ? parseInt(row.lead_time_days, 10) : 0,
            tags: toList(row.tags),
            image_filenames: toList(row.image_filenames),
            is_featured: toBoolean(row.is_featured, false),
            is_active: toBoolean(row.is_active, true)
          };

          const existing = await Product.findOne({ where: { sku: row.sku } });
          if (existing) {
            await existing.update(values);
            report.push({ row: row.rowNumber, sku: row.sku, status: 'updated' });
          } else {
            await Product.create(values);
            report.push({ row: row.rowNumber, sku: row.sku, status: 'created' });
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

      return res.json({ summary, report });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
