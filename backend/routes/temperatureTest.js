const express = require('express');
const temperatureConfig = require('../config/temperatureConfig');
const { advancedRAGService } = require('../services/advancedRAGService');
const router = express.Router();

/**
 * Test different temperature settings with the same query
 * POST /api/temperature/test
 */
router.post('/test', async (req, res) => {
    try {
        const { query, userId = 'test-user' } = req.body;
        
        if (!query) {
            return res.status(400).json({
                error: 'Query is required'
            });
        }

        console.log(`🌡️ Testing temperature variations for query: "${query}"`);

        // Test different temperature presets
        const temperatures = [
            { name: 'factual', value: temperatureConfig.getTemperature('factual') },
            { name: 'conservative', value: temperatureConfig.getTemperature('conservative') },
            { name: 'balanced', value: temperatureConfig.getTemperature('balanced') },
            { name: 'creative', value: temperatureConfig.getTemperature('creative') }
        ];

        const results = [];

        for (const temp of temperatures) {
            try {
                console.log(`🧪 Testing ${temp.name} (${temp.value})...`);
                
                const result = await advancedRAGService.processQuery(query, userId, {
                    temperature: temp.value,
                    useCache: false // Disable cache for testing
                });

                results.push({
                    temperatureName: temp.name,
                    temperatureValue: temp.value,
                    response: result.response,
                    metadata: result.metadata
                });

            } catch (error) {
                console.error(`❌ Error testing ${temp.name}:`, error.message);
                results.push({
                    temperatureName: temp.name,
                    temperatureValue: temp.value,
                    error: error.message
                });
            }
        }

        // Get auto-selected temperature
        const autoAnalysis = temperatureConfig.analyzePromptForTemperature(query);
        
        res.json({
            query,
            autoSelectedTemperature: autoAnalysis,
            temperatureTests: results,
            explanation: {
                factual: "Very low randomness - deterministic, precise answers",
                conservative: "Low randomness - focused, accurate responses", 
                balanced: "Medium randomness - good mix of accuracy and variety",
                creative: "High randomness - diverse, creative responses"
            }
        });

    } catch (error) {
        console.error('❌ Temperature test error:', error);
        res.status(500).json({
            error: 'Temperature test failed',
            message: error.message
        });
    }
});

/**
 * Get all available temperature presets
 * GET /api/temperature/presets
 */
router.get('/presets', (req, res) => {
    try {
        const presets = temperatureConfig.getAllPresets();
        
        res.json({
            presets,
            explanation: {
                "0.0-0.3": "Very focused, deterministic responses",
                "0.4-0.7": "Balanced creativity and accuracy", 
                "0.8-1.0": "High creativity, more varied responses",
                "1.0+": "Very creative but potentially less coherent"
            },
            useCases: {
                factual: "When you need precise, factual information",
                analysis: "For data analysis and comparisons",
                summary: "When summarizing documents",
                balanced: "For general conversation",
                creative: "For brainstorming and creative tasks"
            }
        });
    } catch (error) {
        console.error('❌ Get presets error:', error);
        res.status(500).json({
            error: 'Failed to get temperature presets',
            message: error.message
        });
    }
});

/**
 * Analyze a query and get temperature recommendation
 * POST /api/temperature/analyze
 */
router.post('/analyze', (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                error: 'Query is required'
            });
        }

        const analysis = temperatureConfig.analyzePromptForTemperature(query);
        const ragTemperature = temperatureConfig.getRAGTemperature('general');
        
        res.json({
            query,
            analysis,
            ragSystemRecommendation: {
                temperature: ragTemperature,
                reasoning: "Optimized for document-based retrieval tasks"
            },
            tips: {
                factual: "Use for 'What is...', 'When did...', data extraction",
                analysis: "Use for 'Compare...', 'Analyze...', 'Evaluate...'",
                creative: "Use for 'Brainstorm...', 'Imagine...', 'Create...'"
            }
        });

    } catch (error) {
        console.error('❌ Query analysis error:', error);
        res.status(500).json({
            error: 'Query analysis failed',
            message: error.message
        });
    }
});

module.exports = router;
