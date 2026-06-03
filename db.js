const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      compressions: [],
      stats: {
        totalFiles: 0,
        totalSavedBytes: 0,
        totalOriginalBytes: 0,
        byType: {
          image: { count: 0, saved: 0 },
          pdf: { count: 0, saved: 0 },
          zip: { count: 0, saved: 0 },
          folder: { count: 0, saved: 0 }
        }
      }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function addCompression(record) {
  const db = readDB();
  const entry = {
    id: record.id,
    type: record.type,
    originalName: record.originalName,
    originalSize: record.originalSize,
    compressedSize: record.compressedSize,
    savedBytes: record.originalSize - record.compressedSize,
    savedPercent: (((record.originalSize - record.compressedSize) / record.originalSize) * 100).toFixed(1),
    outputPath: record.outputPath,
    createdAt: new Date().toISOString()
  };

  db.compressions.unshift(entry);
  if (db.compressions.length > 1000) db.compressions = db.compressions.slice(0, 1000);

  // Update stats
  db.stats.totalFiles++;
  db.stats.totalOriginalBytes += record.originalSize;
  db.stats.totalSavedBytes += entry.savedBytes;

  const typeKey = record.type === 'image' || record.type === 'jpg' || record.type === 'png' || record.type === 'webp' ? 'image' : record.type;
  if (db.stats.byType[typeKey]) {
    db.stats.byType[typeKey].count++;
    db.stats.byType[typeKey].saved += entry.savedBytes;
  }

  writeDB(db);
  return entry;
}

function getStats() {
  return readDB().stats;
}

function getRecent(limit = 20) {
  const db = readDB();
  return db.compressions.slice(0, limit);
}

module.exports = { addCompression, getStats, getRecent };
