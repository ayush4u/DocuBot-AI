const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const { advancedRAGService } = require('../services/advancedRAGService');
const documentParser = require('../services/documentParser');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for multi-file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit per file
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Check if file format is supported
    if (documentParser.isSupported(file.mimetype)) {
      cb(null, true);
    } else {
      const supportedExts = documentParser.getSupportedExtensions().join(', ');
      cb(new Error(`Unsupported file format. Supported formats: ${supportedExts}`), false);
    }
  }
});

/**
 * @swagger
 * /chats/{chatId}/upload-multiple:
 *   post:
 *     summary: Upload multiple documents to a chat
 *     tags: [Chat Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Multiple files to upload
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *       400:
 *         description: Invalid request or unsupported file format
 *       401:
 *         description: Unauthorized
 */
router.post('/:chatId/upload-multiple', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded',
        supportedFormats: documentParser.getSupportedExtensions()
      });
    }

    console.log(`📚 Processing ${files.length} files for chat ${chatId}, user: ${userId}`);

    const results = [];
    const errors = [];
    let totalProcessingTime = 0;

    // Process each file
    for (const file of files) {
      const startTime = Date.now();
      
      try {
        console.log(`📄 Processing: ${file.originalname} (${file.mimetype})`);

        // Parse document using the appropriate parser
        const parseResult = await documentParser.parseDocument(
          file.path, 
          file.mimetype, 
          file.originalname
        );

        // Process with Advanced RAG Service
        const ragResult = await advancedRAGService.processDocument(
          file.originalname,
          parseResult.text,
          `${userId}_${chatId}`,
          {
            uploadedAt: new Date().toISOString(),
            fileSize: file.size,
            pages: parseResult.pages,
            originalName: file.originalname,
            format: documentParser.getFormatName(file.mimetype),
            chatId: chatId,
            ...parseResult.metadata
          }
        );

        const processingTime = Date.now() - startTime;
        totalProcessingTime += processingTime;

        // Save to database
        const documentData = {
          id: uuidv4(),
          chat_id: chatId,
          filename: file.filename,
          original_name: file.originalname,
          file_size: file.size,
          pages: parseResult.pages,
          text_content: parseResult.text,
          summary: parseResult.text.substring(0, 500) + '...',
          uploaded_at: new Date().toISOString(),
          format: documentParser.getFormatName(file.mimetype),
          metadata: parseResult.metadata
        };

        const { data: savedDoc, error: dbError } = await supabase
          .from('documents')
          .insert(documentData)
          .select()
          .single();

        if (dbError) {
          console.error('Database save error:', dbError);
          throw new Error('Failed to save document to database');
        }

        results.push({
          id: savedDoc.id,
          filename: file.originalname,
          originalName: file.originalname,
          size: file.size,
          format: documentParser.getFormatName(file.mimetype),
          pages: parseResult.pages,
          uploadedAt: documentData.uploaded_at,
          processingTime,
          textLength: parseResult.text.length,
          metadata: parseResult.metadata,
          ragResult: {
            success: ragResult.success,
            vectorStored: ragResult.vectorStored,
            databaseSaved: ragResult.databaseSaved
          }
        });

        console.log(`✅ Successfully processed: ${file.originalname}`);
        console.log(`   - Text length: ${parseResult.text.length} characters`);
        console.log(`   - Format: ${documentParser.getFormatName(file.mimetype)}`);
        console.log(`   - Processing time: ${processingTime}ms`);

      } catch (error) {
        console.error(`❌ Error processing ${file.originalname}:`, error.message);
        errors.push({
          filename: file.originalname,
          error: error.message
        });
      } finally {
        // Clean up uploaded file
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to cleanup ${file.path}:`, cleanupError.message);
        }
      }
    }

    // Get total document count for this chat
    const { count: totalDocuments } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId);

    const response = {
      message: `Successfully processed ${results.length} out of ${files.length} documents`,
      chatId,
      results,
      errors,
      summary: {
        totalUploaded: files.length,
        successful: results.length,
        failed: errors.length,
        totalProcessingTime,
        averageProcessingTime: Math.round(totalProcessingTime / files.length),
        supportedFormats: documentParser.getSupportedExtensions()
      },
      chatContext: {
        totalDocuments: totalDocuments || 0,
        ragEnabled: true,
        multiDocumentSearch: true
      }
    };

    if (results.length > 0) {
      response.successMessage = `🎉 ${results.length} documents successfully uploaded and processed!
      
📚 Documents are now searchable across multiple formats:
${results.map(r => `   📄 ${r.filename} (${r.format})`).join('\n')}

🔍 You can now ask questions across all your documents:
   • "Compare information between documents"
   • "Find specific data across all files"
   • "Summarize content from multiple sources"
   
🧠 Enhanced cross-document AI search is ready!`;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Multi-file upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process uploads',
      details: error.message,
      supportedFormats: documentParser.getSupportedExtensions()
    });
  }
});

/**
 * @swagger
 * /chats/{chatId}/upload-single:
 *   post:
 *     summary: Upload a single document to a chat (enhanced)
 *     tags: [Chat Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Single file to upload
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid request or unsupported file format
 *       401:
 *         description: Unauthorized
 */
router.post('/:chatId/upload-single', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        supportedFormats: documentParser.getSupportedExtensions()
      });
    }

    console.log(`📄 Processing single file: ${file.originalname} for chat ${chatId}`);

    const startTime = Date.now();

    // Parse document
    const parseResult = await documentParser.parseDocument(
      file.path, 
      file.mimetype, 
      file.originalname
    );

    // Process with Advanced RAG Service
    const ragResult = await advancedRAGService.processDocument(
      file.originalname,
      parseResult.text,
      `${userId}_${chatId}`,
      {
        uploadedAt: new Date().toISOString(),
        fileSize: file.size,
        pages: parseResult.pages,
        originalName: file.originalname,
        format: documentParser.getFormatName(file.mimetype),
        chatId: chatId,
        ...parseResult.metadata
      }
    );

    const processingTime = Date.now() - startTime;

    // Save to database
    const documentData = {
      id: uuidv4(),
      chat_id: chatId,
      filename: file.filename,
      original_name: file.originalname,
      file_size: file.size,
      pages: parseResult.pages,
      text_content: parseResult.text,
      summary: parseResult.text.substring(0, 500) + '...',
      uploaded_at: new Date().toISOString(),
      format: documentParser.getFormatName(file.mimetype),
      metadata: parseResult.metadata
    };

    const { data: savedDoc, error: dbError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single();

    if (dbError) {
      console.error('Database save error:', dbError);
      throw new Error('Failed to save document to database');
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Get total document count
    const { count: totalDocuments } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId);

    res.json({
      message: "Document uploaded and processed successfully for chat",
      chatId,
      document: {
        id: savedDoc.id,
        filename: file.originalname,
        originalName: file.originalname,
        size: file.size,
        format: documentParser.getFormatName(file.mimetype),
        uploadedAt: documentData.uploaded_at
      },
      processing: {
        pages: parseResult.pages,
        chunks: ragResult.chunks || 'N/A',
        vectors: ragResult.vectorCount || 0,
        processingTime,
        textLength: parseResult.text.length,
        metadata: parseResult.metadata
      },
      chatContext: {
        totalDocuments: totalDocuments || 0,
        ragEnabled: true
      }
    });

  } catch (error) {
    // Clean up file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file:', cleanupError);
      }
    }

    console.error('❌ Single file upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process upload',
      details: error.message,
      supportedFormats: documentParser.getSupportedExtensions()
    });
  }
});

/**
 * @swagger
 * /chats/supported-formats:
 *   get:
 *     summary: Get list of supported document formats
 *     tags: [Chat Documents]
 *     responses:
 *       200:
 *         description: List of supported formats
 */
router.get('/supported-formats', (req, res) => {
  res.json({
    supportedFormats: documentParser.getSupportedExtensions(),
    formatDetails: {
      documents: ['.pdf', '.docx', '.doc'],
      spreadsheets: ['.xlsx', '.xls', '.csv'],
      text: ['.txt', '.md'],
      data: ['.json', '.yaml', '.yml']
    },
    limits: {
      maxFileSize: '25MB',
      maxFiles: 10,
      totalSizeLimit: '250MB'
    }
  });
});

module.exports = router;
