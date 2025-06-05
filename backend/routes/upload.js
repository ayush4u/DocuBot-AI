const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { saveDocument } = require('../config/database');
const { enhancedRAGService } = require('../services/enhancedRAGService');
const { optionalAuth } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload and process a PDF document
 *     tags: [Upload]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: PDF file to upload
 *     responses:
 *       200:
 *         description: File uploaded and processed successfully
 *       400:
 *         description: Invalid file or upload error
 */
router.post('/', optionalAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user ID from JWT token if authenticated
    const userId = req.user?.userId || req.user?.email || 'anonymous';

    console.log(`📁 Processing upload: ${req.file.originalname} for user: ${userId}`);

    // Extract text from PDF
    const pdfBuffer = require('fs').readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    
    // Process document with Enhanced RAG system
    const ragResult = await enhancedRAGService.processDocument(
      req.file.originalname, 
      text, 
      userId,
      {
        uploadedAt: new Date().toISOString(),
        fileSize: req.file.size,
        pages: pdfData.numpages || 'unknown',
        originalName: req.file.originalname
      }
    );

    console.log(`✅ Document processed:`);
    console.log(`   - Text length: ${text.length} characters`);
    console.log(`   - Database saved: ${ragResult.databaseSaved ? 'Yes' : 'No'}`);
    console.log(`   - Vector stored: ${ragResult.vectorStored ? 'Yes' : 'No'}`);
    console.log(`   - Pages: ${pdfData.numpages || 'unknown'}`);

    // Clean up uploaded file
    require('fs').unlinkSync(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname, // Add this for frontend compatibility
      message: `📚 Successfully uploaded and processed "${req.file.originalname}"! 

✅ Document is now searchable and ready for AI-powered questions
📄 ${text.length.toLocaleString()} characters processed
🔍 Vector embeddings created for semantic search
💬 You can now ask detailed questions about this document!`,
      
      document: {
        filename: req.file.originalname,
        id: ragResult.filename, // Use filename as ID since no specific ID is returned
        textLength: text.length,
        pages: pdfData.numpages,
        processingResults: {
          databaseStored: ragResult.databaseSaved,
          vectorStored: ragResult.vectorStored,
          ragEnabled: ragResult.success
        }
      }
    });

  } catch (error) {
    console.error('❌ Upload processing error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        require('fs').unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('File cleanup error:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to process PDF file',
      details: error.message 
    });
  }
});

module.exports = router;
