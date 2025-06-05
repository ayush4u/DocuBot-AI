const { pipeline } = require('@xenova/transformers');

class EmbeddingService {
  constructor() {
    this.embedder = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🚀 Initializing Free Embedding Service...');
      
      // Use Xenova Transformers for local embeddings (completely free)
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2', // Fast, lightweight, multilingual embeddings
        { 
          quantized: true,  // Faster inference
          device: 'cpu'     // CPU only (free)
        }
      );

      this.isInitialized = true;
      console.log('✅ Free Embedding Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Embedding Service initialization failed:', error);
      console.log('🔄 Falling back to ChromaDB built-in embeddings...');
      this.isInitialized = false;
    }
  }

  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty for embedding generation');
    }

    try {
      // Try local embeddings first
      if (this.isInitialized && this.embedder) {
        console.log('📊 Generating embedding with Xenova Transformers...');
        const embedding = await this.embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(embedding.data);
      }

      // Fallback: Use simple text preprocessing for ChromaDB built-in
      console.log('📊 Using ChromaDB built-in embeddings...');
      return null; // ChromaDB will handle this automatically
      
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      return null; // Let ChromaDB handle it
    }
  }

  async generateBatchEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    try {
      if (this.isInitialized && this.embedder) {
        console.log(`📊 Generating ${texts.length} embeddings in batch...`);
        const embeddings = [];
        
        // Process in small batches to avoid memory issues
        const batchSize = 10;
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const batchEmbeddings = await Promise.all(
            batch.map(text => this.generateEmbedding(text))
          );
          embeddings.push(...batchEmbeddings);
        }
        
        return embeddings;
      }

      // ChromaDB will handle batch embeddings automatically
      return texts.map(() => null);
      
    } catch (error) {
      console.error('❌ Batch embedding generation failed:', error);
      return texts.map(() => null);
    }
  }

  // Enhanced text preprocessing for better embeddings
  preprocessText(text) {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[^\w\s\.,!?-]/g, '')  // Remove special characters
      .toLowerCase()                   // Lowercase for consistency
      .slice(0, 512);                 // Limit length for embedding models
  }

  // Get embedding statistics
  getStats() {
    return {
      initialized: this.isInitialized,
      model: this.isInitialized ? 'Xenova/all-MiniLM-L6-v2' : 'ChromaDB built-in',
      type: this.isInitialized ? 'local' : 'chromadb',
      free: true,
      multilingual: true
    };
  }
}

// Export singleton instance
const embeddingService = new EmbeddingService();

module.exports = {
  embeddingService,
  EmbeddingService
};
