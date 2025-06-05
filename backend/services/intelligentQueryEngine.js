/**
 * Intelligent Query Understanding Engine
 * 
 * This module provides human-level query comprehension that understands
 * user intent regardless of how they phrase their questions.
 */

class IntelligentQueryEngine {
    constructor() {
        // Intent patterns for various query types
        this.intentPatterns = {
            // Document listing intents - more specific patterns
            documentList: [
                /what.*documents?.*have.*been.*upload/i,
                /what.*files?.*have.*been.*upload/i,
                /show.*me.*all.*documents?/i,
                /list.*all.*documents?/i,
                /list.*my.*documents?/i,
                /list.*uploaded.*files/i,
                /what.*documents?.*are.*available/i,
                /what.*files?.*are.*available/i,
                /show.*uploaded.*documents?/i,
                /display.*document.*list/i,
                /which.*documents?.*upload/i,
                /how.*many.*documents?/i,
                /what.*files.*do.*have/i
            ],
            
            // Content extraction intents - expanded for specific document queries
            extraction: [
                /extract.*skills?/i,
                /what.*skills?/i,
                /list.*skills?/i,
                /find.*experience/i,
                /show.*qualifications?/i,
                /education.*details?/i,
                /work.*experience/i,
                /contact.*information/i,
                /phone.*number/i,
                /email.*address/i,
                /name.*person/i,
                /who.*is/i,
                /read.*document/i,
                /read.*resume/i,
                /read.*file/i,
                /read.*it/i,
                /what.*document.*contain/i,
                /what.*file.*contain/i,
                /what.*resume.*say/i,
                /tell.*me.*about.*document/i,
                /tell.*me.*about.*resume/i,
                /summarize.*document/i,
                /summarize.*resume/i
            ],
            
            // Summary intents - expanded for content queries
            summary: [
                /summarize/i,
                /summary.*of/i,
                /overview.*of/i,
                /tell.*about/i,
                /describe.*document/i,
                /what.*about/i,
                /main.*points/i,
                /key.*information/i,
                /brief.*about/i,
                /what.*does.*document.*say/i,
                /what.*does.*file.*contain/i,
                /what.*is.*in.*document/i,
                /what.*is.*in.*file/i,
                /tell.*me.*about.*document/i,
                /explain.*document/i,
                /content.*of.*document/i,
                /what.*document.*covers/i,
                /give.*me.*overview/i,
                /what.*can.*you.*tell.*me/i,
                /read.*this/i,
                /what.*this.*document/i
            ],
            
            // Comparison intents
            comparison: [
                /compare.*documents?/i,
                /difference.*between/i,
                /similarities.*between/i,
                /versus/i,
                /vs\.?/i,
                /better.*than/i,
                /contrast.*with/i
            ],
            
            // Search intents - for finding specific content
            search: [
                /find.*in/i,
                /search.*for/i,
                /look.*for/i,
                /where.*mentioned/i,
                /contains?.*mention/i,
                /appears?.*in/i,
                /what.*does.*it.*say.*about/i,
                /information.*about/i,
                /details.*about/i,
                /explain.*about/i,
                /tell.*me.*about/i,
                /what.*is.*said.*about/i
            ]
        };

        // Entity extraction patterns
        this.entityPatterns = {
            person: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
            company: /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g,
            skills: /\b(?:JavaScript|Python|React|Node\.js|SQL|Excel|Tally|SAP|Project Management|Accounting|Finance)\b/gi
        };

        // Keyword expansion for better retrieval
        this.synonyms = {
            'skills': ['expertise', 'abilities', 'competencies', 'proficiencies', 'capabilities'],
            'experience': ['background', 'history', 'work', 'employment', 'career'],
            'education': ['qualifications', 'degrees', 'studies', 'academic', 'learning'],
            'contact': ['phone', 'email', 'address', 'details', 'information'],
            'summary': ['overview', 'profile', 'about', 'description', 'brief'],
            'documents': ['files', 'uploads', 'papers', 'content'],
            'name': ['title', 'filename', 'called', 'named']
        };
    }

    /**
     * Analyze query with human-level intelligence
     * @param {string} query - User query
     * @param {Array} documents - Available documents
     * @returns {Object} Comprehensive query analysis
     */
    analyzeQuery(query, documents = []) {
        const analysis = {
            originalQuery: query,
            intent: this.detectIntent(query),
            entities: this.extractEntities(query),
            keywords: this.extractKeywords(query),
            expandedKeywords: this.expandKeywords(query),
            documentReferences: this.findDocumentReferences(query, documents),
            confidence: 0.8,
            searchTerms: [],
            expectedContent: [],
            temperature: 0.7
        };

        // Enhance analysis based on intent
        this.enhanceAnalysis(analysis, documents);
        
        return analysis;
    }

    /**
     * Detect user intent from query
     */
    detectIntent(query) {
        for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(query)) {
                    return {
                        type: intent,
                        confidence: 0.9,
                        pattern: pattern.source
                    };
                }
            }
        }

        // Fallback intent detection
        if (query.includes('?')) {
            return { type: 'question', confidence: 0.7 };
        }
        
        return { type: 'general', confidence: 0.5 };
    }

    /**
     * Extract entities from query
     */
    extractEntities(query) {
        const entities = {};
        
        for (const [type, pattern] of Object.entries(this.entityPatterns)) {
            const matches = query.match(pattern);
            if (matches) {
                entities[type] = [...new Set(matches)]; // Remove duplicates
            }
        }
        
        return entities;
    }

    /**
     * Extract and expand keywords
     */
    extractKeywords(query) {
        // Basic keyword extraction
        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => 
                word.length > 2 && 
                !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'can', 'you', 'what', 'how', 'where', 'when', 'why', 'who', 'are', 'is', 'was', 'were', 'have', 'has', 'had'].includes(word)
            );
        
        return [...new Set(words)];
    }

    /**
     * Expand keywords with synonyms
     */
    expandKeywords(query) {
        const keywords = this.extractKeywords(query);
        const expanded = [...keywords];
        
        keywords.forEach(keyword => {
            if (this.synonyms[keyword]) {
                expanded.push(...this.synonyms[keyword]);
            }
        });
        
        return [...new Set(expanded)];
    }

    /**
     * Find document references in query
     */
    findDocumentReferences(query, documents) {
        const references = [];
        const queryLower = query.toLowerCase();
        
        documents.forEach(doc => {
            const filename = doc.filename || doc.original_name || '';
            const originalName = doc.original_name || '';
            
            // Check if document is mentioned by name
            if (queryLower.includes(filename.toLowerCase()) ||
                queryLower.includes(originalName.toLowerCase())) {
                references.push({
                    document: doc,
                    type: 'explicit',
                    confidence: 0.9
                });
            }
        });
        
        return references;
    }

    /**
     * Enhance analysis based on intent and context
     */
    enhanceAnalysis(analysis, documents) {
        const { intent } = analysis;
        
        switch (intent.type) {
            case 'documentList':
                analysis.expectedContent = ['filename', 'original_name', 'uploaded_at'];
                analysis.searchTerms = ['documents', 'files', 'uploaded'];
                analysis.temperature = 0.1; // Factual
                analysis.confidence = 0.95;
                break;
                
            case 'extraction':
                analysis.expectedContent = ['skills', 'experience', 'education', 'contact'];
                analysis.searchTerms = this.expandKeywords(analysis.originalQuery);
                analysis.temperature = 0.3; // Precise extraction
                break;
                
            case 'summary':
                analysis.expectedContent = ['overview', 'main_points', 'key_info'];
                analysis.searchTerms = ['summary', 'overview', 'about'];
                analysis.temperature = 0.4; // Balanced summarization
                break;
                
            case 'comparison':
                analysis.expectedContent = ['differences', 'similarities', 'comparison'];
                analysis.searchTerms = analysis.expandedKeywords;
                analysis.temperature = 0.3; // Analytical
                break;
                
            case 'search':
                analysis.expectedContent = ['specific_info', 'mentions', 'references'];
                analysis.searchTerms = analysis.expandedKeywords;
                analysis.temperature = 0.2; // Precise search
                break;
                
            default:
                analysis.expectedContent = ['general_info'];
                analysis.searchTerms = analysis.expandedKeywords;
                analysis.temperature = 0.7; // Balanced
        }

        // Add document-specific search terms if documents are available
        if (documents.length > 0) {
            analysis.searchTerms.push(
                ...documents.map(doc => doc.original_name?.split('.')[0] || doc.filename?.split('.')[0]).filter(Boolean)
            );
        }
    }

    /**
     * Generate optimal search queries for vector retrieval
     */
    generateSearchQueries(analysis) {
        const queries = [analysis.originalQuery];
        
        // Add reformulated queries based on intent
        switch (analysis.intent.type) {
            case 'documentList':
                queries.push(
                    'uploaded documents files list',
                    'document names filenames'
                );
                break;
                
            case 'extraction':
                if (analysis.originalQuery.includes('name')) {
                    queries.push('name person contact information');
                }
                if (analysis.originalQuery.includes('file')) {
                    queries.push('filename document name title');
                }
                break;
        }
        
        // Add keyword-based queries
        if (analysis.expandedKeywords.length > 0) {
            queries.push(analysis.expandedKeywords.join(' '));
        }
        
        return [...new Set(queries)];
    }

    /**
     * Determine if query needs document content vs metadata
     */
    needsDocumentContent(analysis) {
        const contentIntents = ['extraction', 'summary', 'search', 'comparison'];
        return contentIntents.includes(analysis.intent.type);
    }

    /**
     * Determine if query can be answered with just metadata
     */
    canAnswerWithMetadata(analysis) {
        const metadataIntents = ['documentList'];
        return metadataIntents.includes(analysis.intent.type);
    }
}

module.exports = new IntelligentQueryEngine();
