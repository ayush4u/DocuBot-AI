const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const { enhancedRAGService } = require('../services/enhancedRAGService');
const { advancedRAGService } = require('../services/advancedRAGService');
const { chatData, chatDocuments } = require('./chatManagement');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for file uploads
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

/**
 * @swagger
 * /chats/{chatId}/upload:
 *   post:
 *     summary: Upload PDF document to a specific chat
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID to upload document to
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload
 *             required:
 *               - file
 *     responses:
 *       200:
 *         description: Document uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 chatId:
 *                   type: string
 *                 document:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: number
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *                 processing:
 *                   type: object
 *                   properties:
 *                     pages:
 *                       type: integer
 *                     chunks:
 *                       type: integer
 *                     vectors:
 *                       type: integer
 *                     processingTime:
 *                       type: number
 *                 chatContext:
 *                   type: object
 *                   properties:
 *                     totalDocuments:
 *                       type: integer
 *                     ragEnabled:
 *                       type: boolean
 *       400:
 *         description: Invalid file or request
 *       404:
 *         description: Chat not found
 */
router.post('/:chatId/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Verify chat exists and belongs to user (check Supabase database)
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id, title')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      console.log(`❌ Chat verification failed for ${chatId}:`, chatError?.message || 'Chat not found');
      return res.status(404).json({ error: 'Chat not found' });
    }

    console.log(`✅ Chat verified: ${chat.title} (${chatId}) for user ${userId}`);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const startTime = Date.now();
    console.log(`📄 Processing PDF upload for chat ${chatId}: ${req.file.originalname}`);

    // Read and parse PDF
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const content = pdfData.text;

    if (!content || content.trim().length === 0) {
      fs.unlinkSync(req.file.path); // Clean up file
      return res.status(400).json({ error: 'PDF appears to be empty or unreadable' });
    }

    // Generate unique document ID for this chat (use proper UUID format)
    const documentId = uuidv4();
    
    // Process document with Advanced RAG (using chat-specific user context)
    const chatUserId = `${userId}_${chatId}`; // Unique context per chat
    
    // Use Advanced RAG for better multi-document processing
    const result = await advancedRAGService.processDocument(
      req.file.originalname,
      content,
      chatUserId,
      {
        chatId,
        documentId,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        pages: pdfData.numpages,
        documentType: 'pdf',
        processingVersion: 'advanced-rag-v2'
      }
    );

    // Create document record
    const documentRecord = {
      id: documentId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      pages: pdfData.numpages,
      chatId,
      userId,
      uploadedAt: new Date(),
      processed: true,
      chunks: result.chunksCreated || 0
    };

    // Save document to Supabase database
    const { data: savedDoc, error: saveError } = await supabase
      .from('documents')
      .insert([
        {
          id: documentId,
          chat_id: chatId,
          filename: req.file.filename,
          original_name: req.file.originalname,
          file_size: req.file.size,
          pages: pdfData.numpages,
          text_content: content.substring(0, 10000), // Store first 10k chars
          summary: result.summary || null,
          uploaded_at: new Date().toISOString()
        }
      ]);

    if (saveError) {
      console.error('❌ Error saving document to database:', JSON.stringify(saveError, null, 2));
      // Continue anyway - don't fail the upload if database save fails
    } else {
      console.log(`✅ Document saved to database: ${documentId} in chat ${chatId}`);
      console.log('📄 Saved document data:', JSON.stringify(savedDoc, null, 2));
    }

    // Add document to chat's document list (legacy in-memory storage)
    if (!chatDocuments.has(chatId)) {
      chatDocuments.set(chatId, []);
    }
    chatDocuments.get(chatId).push(documentRecord);

    // Update chat's updated timestamp
    chat.updatedAt = new Date();

    const processingTime = Date.now() - startTime;
    const totalDocuments = chatDocuments.get(chatId).length;

    console.log(`✅ Document processed for chat ${chatId}:
   - File: ${req.file.originalname}
   - Pages: ${pdfData.numpages}
   - Chunks: ${result.chunksCreated || 0}
   - Processing time: ${processingTime}ms
   - Total documents in chat: ${totalDocuments}`);

    res.json({
      message: `Document uploaded and processed successfully for chat`,
      chatId,
      document: {
        id: documentId,
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size,
        uploadedAt: documentRecord.uploadedAt
      },
      processing: {
        pages: pdfData.numpages,
        chunks: result.chunksCreated || 0,
        vectors: result.embeddings || 0,
        processingTime
      },
      chatContext: {
        totalDocuments,
        ragEnabled: true
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      error: 'Failed to process document',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /chats/{chatId}/documents:
 *   get:
 *     summary: Get all documents in a specific chat
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: List of documents in the chat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chatId:
 *                   type: string
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       filename:
 *                         type: string
 *                       originalName:
 *                         type: string
 *                       size:
 *                         type: number
 *                       pages:
 *                         type: integer
 *                       chunks:
 *                         type: integer
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                 ragEnabled:
 *                   type: boolean
 *       404:
 *         description: Chat not found
 */
router.get('/:chatId/documents', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Verify chat exists and belongs to user (check Supabase database)
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id, title')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get documents from Supabase database
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, filename, original_name, file_size, pages, uploaded_at')
      .eq('chat_id', chatId)
      .order('uploaded_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json({
      chatId,
      documents: (documents || []).map(doc => ({
        id: doc.id,
        filename: doc.filename,
        originalName: doc.original_name,
        size: doc.file_size,
        pages: doc.pages,
        uploadedAt: doc.uploaded_at
      })),
      total: (documents || []).length,
      ragEnabled: (documents || []).length > 0
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

/**
 * @swagger
 * /chats/{chatId}/documents/{documentId}:
 *   delete:
 *     summary: Delete a document from a specific chat
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Chat or document not found
 */
router.delete('/:chatId/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const { chatId, documentId } = req.params;
    const userId = req.user.userId;

    // Verify chat exists and belongs to user (check Supabase database)
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id, title')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get document from Supabase database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, filename, file_path')
      .eq('id', documentId)
      .eq('chat_id', chatId)
      .single();
    
    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from Supabase database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('chat_id', chatId);

    if (deleteError) {
      console.error('Error deleting document from database:', deleteError);
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    // Clean up physical file
    try {
      const filePath = path.join(__dirname, '../uploads', document.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.warn('Warning: Could not delete physical file:', fileError.message);
    }

    // Get remaining document count
    const { data: remainingDocs, error: countError } = await supabase
      .from('documents')
      .select('id')
      .eq('chat_id', chatId);

    const documentsRemaining = remainingDocs ? remainingDocs.length : 0;

    console.log(`🗑️ Deleted document ${documentId} from chat ${chatId}`);

    res.json({ 
      message: 'Document deleted successfully',
      documentsRemaining: documentsRemaining,
      ragEnabled: documentsRemaining > 0
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
