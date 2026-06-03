const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
const COMPRESSED_DIR = path.join(__dirname, '../public/compressed');

[UPLOAD_DIR, COMPRESSED_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|zip|svg/i;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext) || file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, true); // Accept all for folder zip
    }
  }
});

const multiUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ─── Image Compression ──────────────────────────────────────────────────────
router.post('/image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const quality = parseInt(req.body.quality) || 80;
  const format = req.body.format || 'jpeg';
  const outputId = uuidv4();
  const ext = format === 'png' ? '.png' : format === 'webp' ? '.webp' : '.jpg';
  const outputPath = path.join(COMPRESSED_DIR, outputId + ext);

  try {
    let pipeline = sharp(req.file.path).rotate(); // auto-rotate from EXIF

    if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 11), quality });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    }

    const info = await pipeline.toFile(outputPath);
    const originalSize = req.file.size;
    const compressedSize = info.size;

    const record = db.addCompression({
      id: outputId,
      type: 'image',
      originalName: req.file.originalname,
      originalSize,
      compressedSize,
      outputPath: `/compressed/${outputId + ext}`
    });

    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      originalSize,
      compressedSize,
      savedBytes: originalSize - compressedSize,
      savedPercent: record.savedPercent,
      originalSizeFormatted: formatBytes(originalSize),
      compressedSizeFormatted: formatBytes(compressedSize),
      downloadUrl: `/compressed/${outputId + ext}`,
      filename: req.file.originalname.replace(/\.[^.]+$/, '') + '_compressed' + ext
    });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ error: 'Image compression failed: ' + err.message });
  }
});

// ─── PDF Compression ─────────────────────────────────────────────────────────
router.post('/pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const outputId = uuidv4();
  const outputPath = path.join(COMPRESSED_DIR, outputId + '.pdf');

  try {
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    // Re-save with compression options
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50
    });

    fs.writeFileSync(outputPath, compressedBytes);

    const originalSize = req.file.size;
    const compressedSize = compressedBytes.length;

    const record = db.addCompression({
      id: outputId,
      type: 'pdf',
      originalName: req.file.originalname,
      originalSize,
      compressedSize,
      outputPath: `/compressed/${outputId}.pdf`
    });

    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      originalSize,
      compressedSize,
      savedBytes: originalSize - compressedSize,
      savedPercent: record.savedPercent,
      originalSizeFormatted: formatBytes(originalSize),
      compressedSizeFormatted: formatBytes(compressedSize),
      downloadUrl: `/compressed/${outputId}.pdf`,
      filename: req.file.originalname.replace('.pdf', '') + '_compressed.pdf',
      pages: pdfDoc.getPageCount()
    });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ error: 'PDF compression failed: ' + err.message });
  }
});

// ─── ZIP Compression (multiple files) ────────────────────────────────────────
router.post('/zip', multiUpload.array('files', 50), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const outputId = uuidv4();
  const outputPath = path.join(COMPRESSED_DIR, outputId + '.zip');
  const level = parseInt(req.body.level) || 9;
  const zipName = req.body.zipName || 'compressed';

  try {
    const originalSize = req.files.reduce((sum, f) => sum + f.size, 0);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      req.files.forEach(f => archive.file(f.path, { name: f.originalname }));
      archive.finalize();
    });

    const compressedSize = fs.statSync(outputPath).size;
    const record = db.addCompression({
      id: outputId,
      type: 'zip',
      originalName: `${req.files.length} files`,
      originalSize,
      compressedSize,
      outputPath: `/compressed/${outputId}.zip`
    });

    req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    res.json({
      success: true,
      originalSize,
      compressedSize,
      savedBytes: originalSize - compressedSize,
      savedPercent: record.savedPercent,
      originalSizeFormatted: formatBytes(originalSize),
      compressedSizeFormatted: formatBytes(compressedSize),
      downloadUrl: `/compressed/${outputId}.zip`,
      filename: zipName + '.zip',
      fileCount: req.files.length
    });
  } catch (err) {
    req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    console.error(err);
    res.status(500).json({ error: 'ZIP compression failed: ' + err.message });
  }
});

// ─── Folder to ZIP ────────────────────────────────────────────────────────────
router.post('/folder', multiUpload.array('files', 200), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const outputId = uuidv4();
  const outputPath = path.join(COMPRESSED_DIR, outputId + '.zip');
  const level = parseInt(req.body.level) || 9;
  const folderName = req.body.folderName || 'folder';

  try {
    const originalSize = req.files.reduce((sum, f) => sum + f.size, 0);
    const relativePaths = req.body.relativePaths ? JSON.parse(req.body.relativePaths) : null;

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      req.files.forEach((f, i) => {
        const entryName = relativePaths && relativePaths[i] ? relativePaths[i] : f.originalname;
        archive.file(f.path, { name: entryName });
      });
      archive.finalize();
    });

    const compressedSize = fs.statSync(outputPath).size;
    const record = db.addCompression({
      id: outputId,
      type: 'folder',
      originalName: `${folderName} (${req.files.length} files)`,
      originalSize,
      compressedSize,
      outputPath: `/compressed/${outputId}.zip`
    });

    req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    res.json({
      success: true,
      originalSize,
      compressedSize,
      savedBytes: originalSize - compressedSize,
      savedPercent: record.savedPercent,
      originalSizeFormatted: formatBytes(originalSize),
      compressedSizeFormatted: formatBytes(compressedSize),
      downloadUrl: `/compressed/${outputId}.zip`,
      filename: folderName + '_compressed.zip',
      fileCount: req.files.length
    });
  } catch (err) {
    req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    console.error(err);
    res.status(500).json({ error: 'Folder compression failed: ' + err.message });
  }
});

// ─── Stats & History ──────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const stats = db.getStats();
  const recent = db.getRecent(10);
  res.json({
    ...stats,
    totalFilesFormatted: stats.totalFiles.toLocaleString(),
    totalSavedFormatted: formatBytes(stats.totalSavedBytes),
    totalOriginalFormatted: formatBytes(stats.totalOriginalBytes),
    recent
  });
});

module.exports = router;
