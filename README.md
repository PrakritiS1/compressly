# Compressly — All-in-One File Compressor

A full-stack file compression website built with Node.js, Express, Sharp, and pdf-lib.

## Features
- **Image Compressor** — JPEG, PNG, WebP with quality control
- **JPG Compressor** — Optimized JPEG with mozjpeg
- **PDF Compressor** — Object-stream PDF compression
- **ZIP Compressor** — Multi-file ZIP with level control
- **Folder Compressor** — Entire folder to ZIP with path preservation
- **JSON Database** — Tracks all compressions, stats, history
- **Auto Cleanup** — Files deleted after 1 hour

## Local Development

```bash
npm install
npm start
# Visit http://localhost:3000
```

## Deployment Options

### 1. Render.com (Free)
1. Push to GitHub
2. Create a new "Web Service" on render.com
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Deploy!

### 2. Railway.app
1. Push to GitHub
2. Connect repo on railway.app
3. Auto-deploys on push

### 3. Heroku
```bash
heroku create your-app-name
git push heroku main
```

### 4. VPS (DigitalOcean, Linode, etc.)
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and run
git clone <your-repo>
cd compressly
npm install

# Use PM2 for production
npm install -g pm2
pm2 start server.js --name compressly
pm2 startup
pm2 save

# Nginx reverse proxy (optional)
# Point nginx to localhost:3000
```

### 5. Custom Port
Set environment variable: `PORT=8080 npm start`

## File Structure
```
compressly/
├── server.js          # Express app entry point
├── db.js              # JSON file database
├── routes/
│   └── compress.js    # All compression API routes
├── public/
│   ├── index.html     # Frontend
│   ├── css/style.css  # Styles
│   ├── js/app.js      # Frontend JavaScript
│   ├── uploads/       # Temp uploaded files (auto-cleaned)
│   └── compressed/    # Output files (auto-cleaned after 1hr)
└── data/
    └── db.json        # Stats & history database (auto-created)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/compress/image | Compress image (JPEG/PNG/WebP) |
| POST | /api/compress/pdf | Compress PDF |
| POST | /api/compress/zip | Create ZIP from multiple files |
| POST | /api/compress/folder | Compress folder to ZIP |
| GET  | /api/compress/stats | Get stats & recent history |

## Environment Variables
- `PORT` — Server port (default: 3000)
