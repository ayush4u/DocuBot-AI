/**
 * Temperature Configuration for AI Models
 * 
 * Temperature controls the randomness/creativity of AI responses:
 * - 0.0-0.3: Very focused, deterministic, factual
 * - 0.4-0.7: Balanced creativity and accuracy
 * - 0.8-1.0: High creativity, more varied responses
 * - 1.0+: Very creative but potentially less coherent
 */

class TemperatureConfig {
    constructor() {
        // Default temperature settings for different use cases
        this.presets = {
            // Very conservative - for factual, precise responses
            factual: 0.1,
            conservative: 0.3,
            
            // Balanced - for general conversation
            balanced: 0.7,
            default: 0.7,
            
            // Creative - for brainstorming, creative writing
            creative: 0.9,
            experimental: 1.2,
            
            // Context-aware settings
            rag: 0.3,          // For RAG systems - want precise document-based answers
            chat: 0.7,         // For general chat
            analysis: 0.2,     // For data analysis
            summary: 0.4,      // For summarization
            comparison: 0.3,   // For comparing documents
            extraction: 0.1    // For extracting specific information
        };

        // Model-specific temperature limits
        this.modelLimits = {
            'llama-3.1-8b-instant': { min: 0.0, max: 2.0, default: 0.7 },
            'llama-3.1-70b-versatile': { min: 0.0, max: 2.0, default: 0.7 },
            'mixtral-8x7b-32768': { min: 0.0, max: 2.0, default: 0.7 },
            'gemma-7b-it': { min: 0.0, max: 2.0, default: 0.7 }
        };
    }

    /**
     * Get temperature for a specific use case
     * @param {string} useCase - The use case (factual, creative, etc.)
     * @param {number} customTemp - Custom temperature override
     * @returns {number} Temperature value
     */
    getTemperature(useCase = 'default', customTemp = null) {
        if (customTemp !== null) {
            return this.validateTemperature(customTemp);
        }
        
        return this.presets[useCase] || this.presets.default;
    }

    /**
     * Get temperature based on query type for RAG systems
     * @param {string} queryType - Type of query (summary, comparison, etc.)
     * @returns {number} Appropriate temperature
     */
    getRAGTemperature(queryType) {
        const ragTemperatures = {
            'summary': 0.4,
            'comparison': 0.3,
            'extraction': 0.1,
            'search': 0.2,
            'multi-document': 0.3,
            'document-specific': 0.2,
            'general': 0.3,
            'analysis': 0.2,
            'creative': 0.8
        };

        return ragTemperatures[queryType] || ragTemperatures.general;
    }

    /**
     * Validate temperature value
     * @param {number} temp - Temperature to validate
     * @returns {number} Valid temperature value
     */
    validateTemperature(temp) {
        if (typeof temp !== 'number' || isNaN(temp)) {
            return this.presets.default;
        }
        
        // Clamp between 0 and 2
        return Math.max(0, Math.min(2, temp));
    }

    /**
     * Get temperature recommendation based on prompt analysis
     * @param {string} prompt - The input prompt
     * @returns {object} Temperature recommendation with reasoning
     */
    analyzePromptForTemperature(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        
        // Keywords that suggest different temperature needs
        const factualKeywords = ['fact', 'data', 'statistics', 'number', 'date', 'when', 'where', 'who'];
        const creativeKeywords = ['creative', 'imagine', 'brainstorm', 'idea', 'story', 'write'];
        const analysisKeywords = ['analyze', 'compare', 'evaluate', 'assess', 'examine'];
        const summaryKeywords = ['summary', 'summarize', 'overview', 'main points'];

        let recommendation = {
            temperature: this.presets.default,
            reasoning: 'Using default balanced temperature',
            useCase: 'default'
        };

        if (factualKeywords.some(keyword => lowerPrompt.includes(keyword))) {
            recommendation = {
                temperature: this.presets.factual,
                reasoning: 'Factual query detected - using low temperature for precision',
                useCase: 'factual'
            };
        } else if (creativeKeywords.some(keyword => lowerPrompt.includes(keyword))) {
            recommendation = {
                temperature: this.presets.creative,
                reasoning: 'Creative task detected - using high temperature for variety',
                useCase: 'creative'
            };
        } else if (analysisKeywords.some(keyword => lowerPrompt.includes(keyword))) {
            recommendation = {
                temperature: this.presets.analysis,
                reasoning: 'Analysis task detected - using low temperature for accuracy',
                useCase: 'analysis'
            };
        } else if (summaryKeywords.some(keyword => lowerPrompt.includes(keyword))) {
            recommendation = {
                temperature: this.presets.summary,
                reasoning: 'Summarization task detected - using moderate temperature',
                useCase: 'summary'
            };
        }

        return recommendation;
    }

    /**
     * Get all available presets
     * @returns {object} All temperature presets
     */
    getAllPresets() {
        return { ...this.presets };
    }

    /**
     * Add or update a custom preset
     * @param {string} name - Preset name
     * @param {number} temperature - Temperature value
     */
    setCustomPreset(name, temperature) {
        this.presets[name] = this.validateTemperature(temperature);
    }
}

module.exports = new TemperatureConfig();
