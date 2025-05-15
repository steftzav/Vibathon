const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Function to sanitize filename
const sanitizeFilename = (filename) => {
  const basename = path.basename(filename);
  return basename.replace(/[^\w\s.]/g, '_');
};

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const originalName = sanitizeFilename(file.originalname);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    
    let finalName = originalName;
    let counter = 1;
    
    while (fs.existsSync(path.join(__dirname, 'public', 'uploads', finalName))) {
      finalName = `${nameWithoutExt} (${counter})${ext}`;
      counter++;
    }
    
    cb(null, finalName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Get example files
app.get('/api/examples', (req, res) => {
  const examplesDir = path.join(__dirname, 'public', 'examples');
  try {
    if (!fs.existsSync(examplesDir)) {
      fs.mkdirSync(examplesDir, { recursive: true });
    }
    const files = fs.readdirSync(examplesDir);
    res.json({ files });
  } catch (error) {
    console.error('Error reading examples directory:', error);
    res.status(500).json({ error: 'Failed to read examples directory' });
  }
});

// Handle file upload
app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Process each file
    const processedFiles = files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      path: `/uploads/${file.filename}`
    }));

    res.json({
      message: 'Files uploaded successfully',
      files: processedFiles
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ 
      message: 'Error uploading files',
      error: error.message 
    });
  }
});

// Error handling for file size limit
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File is too large. Maximum size is 10MB'
      });
    }
  }
  next(error);
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// Serve example files statically
app.use('/examples', express.static(path.join(__dirname, 'public', 'examples')));

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Files will be uploaded to: ${path.join(__dirname, 'public', 'uploads')}`);
  console.log(`Example files are served from: ${path.join(__dirname, 'public', 'examples')}`);
});