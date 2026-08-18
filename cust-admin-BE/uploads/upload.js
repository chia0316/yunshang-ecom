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

module.exports = {
  multiImageUpload,
  videoUpload,
  imageUploadDir: uploadDir,
  videoUploadDir: videoDir
};
