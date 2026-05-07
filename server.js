const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage });

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join', (clientId) => {
    socket.join(clientId);
    console.log(`Socket joined client room: ${clientId}`);
  });
});

app.post('/compress', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const clientId = req.body.clientId;
  const inputPath = req.file.path;
  const outputFileName = `compressed-${req.file.filename}`;
  const outputPath = path.join(outputDir, outputFileName);

  console.log(`Starting compression for: ${inputPath} (Client: ${clientId})`);

  ffmpeg(inputPath)
    .outputOptions([
      '-vcodec libx264',
      '-crf 28',         // Strong compression (lower quality, smaller size)
      '-preset slow',    // Slower encoding = better compression ratio
      "-vf scale='min(1280,iw)':-2", // Downscale to 720p max
      '-acodec aac',
      '-b:a 128k'        // Standard audio bitrate
    ])
    .on('progress', (progress) => {
      if (clientId) {
        io.to(clientId).emit('progress', {
          percent: progress.percent ? progress.percent.toFixed(2) : 0,
          timemark: progress.timemark
        });
      }
    })
    .on('end', () => {
      console.log('Compression finished!');
      
      const originalSize = fs.statSync(inputPath).size;
      const compressedSize = fs.statSync(outputPath).size;
      const ratio = (originalSize / compressedSize).toFixed(1);
      
      if (clientId) {
        io.to(clientId).emit('complete', {
          downloadUrl: `/download/${outputFileName}`,
          originalSize,
          compressedSize,
          ratio
        });
      }
      
      fs.unlinkSync(inputPath);
    })
    .on('error', (err) => {
      console.error('Error during compression:', err);
      if (clientId) {
        io.to(clientId).emit('error', { message: err.message });
      }
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    })
    .save(outputPath);

  res.json({ message: 'Compression started' });
});

app.get('/download/:filename', (req, res) => {
  const file = path.join(outputDir, req.params.filename);
  res.download(file, (err) => {
    if (!err) {
      setTimeout(() => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }, 60000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
