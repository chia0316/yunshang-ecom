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

module.exports = {
  multiImageUpload
};
