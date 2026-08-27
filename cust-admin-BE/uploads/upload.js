const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Images live on local/VM disk under IMAGE_UPLOAD_DIR (defaults to
// public/images, served statically at /static/images by app.js). On
// DigitalOcean this should point at a persistent volume mount.
const uploadDir = process.env.IMAGE_UPLOAD_DIR || path.join(__dirname, '../public/images');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(
      null,
      path.basename(file.originalname, path.extname(file.originalname)) +
        '-' +
        Date.now() +
        path.extname(file.originalname)
    );
  }
});

const multiImageUpload = multer({ storage }).array('images', 10);

// Product videos live on local/VM disk under VIDEO_UPLOAD_DIR (defaults to
// public/videos, served statically at /static/videos by app.js).
const videoDir = process.env.VIDEO_UPLOAD_DIR || path.join(__dirname, '../public/videos');
fs.mkdirSync(videoDir, { recursive: true });

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoDir),
  filename: (req, file, cb) => {
    cb(
      null,
      path.basename(file.originalname, path.extname(file.originalname)) +
        '-' +
        Date.now() +
        path.extname(file.originalname)
    );
  }
});

const ALLOWED_VIDEO_MIMETYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_VIDEO_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('Video must be MP4, WebM, or MOV'));
    }
    cb(null, true);
  }
}).single('video');

// QR code images live on local/VM disk under QR_UPLOAD_DIR (defaults to
// public/qrcodes, served statically at /api/static/qrcodes by app.js) —
// kept separate from product images since they're a distinct asset type
// managed from Settings, not the product catalog.
const qrDir = process.env.QR_UPLOAD_DIR || path.join(__dirname, '../public/qrcodes');
fs.mkdirSync(qrDir, { recursive: true });

// Spaces/parentheses/etc. in the original filename survive into the stored
// one elsewhere in this file (product images/videos) and are fine there —
// they're only ever rendered via a browser-parsed <img> tag, which is
// lenient about unencoded spaces in a URL. QR images are also embedded in
// an email (see mailer.js sendAppointmentQrCodeMail), where a mail client's
// own image proxy is far less forgiving, so these get sanitized at upload
// time rather than relying on every future reader to encode correctly.
const sanitizeFilenamePart = (name) => name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-');

const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, qrDir),
  filename: (req, file, cb) => {
    cb(
      null,
      sanitizeFilenamePart(path.basename(file.originalname, path.extname(file.originalname))) +
        '-' +
        Date.now() +
        path.extname(file.originalname)
    );
  }
});

const ALLOWED_QR_IMAGE_MIMETYPES = ['image/png', 'image/jpeg', 'image/webp'];

const qrImageUpload = multer({
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_QR_IMAGE_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('QR code image must be PNG, JPG, or WEBP'));
    }
    cb(null, true);
  }
}).single('image');

module.exports = {
  multiImageUpload,
  videoUpload,
  qrImageUpload,
  imageUploadDir: uploadDir,
  videoUploadDir: videoDir,
  qrUploadDir: qrDir
};
