const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_ENTRY_BYTES = 15 * 1024 * 1024;

// Extracts an uploaded images ZIP straight into targetDir. Every entry is
// written using only its basename (never the raw zip path) so a
// maliciously-crafted entry name like "../../etc/passwd" can't escape the
// upload directory (zip-slip). Returns a report of anything skipped
// (unsupported format, oversized when uncompressed) or overwritten, so the
// caller can show the admin exactly what happened, not just a final file
// count. Shared by product bulk-upload and QR code bulk-upload — both write
// zip-extracted images without a timestamp suffix (so their accompanying
// Excel can reference the exact filename), which is what makes filename
// collisions a real, if rare, risk worth reporting for both.
const extractImagesZip = async (
  zipFilePath,
  targetDir,
  { allowedExtensions, maxEntryBytes = DEFAULT_MAX_ENTRY_BYTES, checkCollision } = {}
) => {
  const zip = new AdmZip(zipFilePath);
  const zipReport = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const filename = path.basename(entry.entryName);
    if (!filename) continue;

    // macOS's Finder "Compress" adds a __MACOSX/ folder full of ._-prefixed
    // AppleDouble metadata sidecar files (one per real file, same name and
    // extension) plus .DS_Store — none of these are real images, but they'd
    // otherwise pass the extension check below and pollute the target dir.
    if (entry.entryName.startsWith('__MACOSX/') || filename.startsWith('._') || filename === '.DS_Store') {
      continue;
    }

    const ext = path.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      zipReport.push({
        filename,
        status: 'skipped',
        reason: `Unsupported format${ext ? ` (${ext})` : ''} — only ${allowedExtensions.join(', ')} allowed`
      });
      continue;
    }

    if (entry.header.size > maxEntryBytes) {
      zipReport.push({
        filename,
        status: 'skipped',
        reason: `File too large uncompressed (max ${Math.round(maxEntryBytes / (1024 * 1024))}MB)`
      });
      continue;
    }

    const targetPath = path.join(targetDir, filename);
    if (fs.existsSync(targetPath) && checkCollision) {
      const reason = await checkCollision(filename);
      if (reason) {
        zipReport.push({ filename, status: 'overwritten', reason });
      }
    }

    fs.writeFileSync(targetPath, entry.getData());
  }

  return zipReport;
};

module.exports = { extractImagesZip };
