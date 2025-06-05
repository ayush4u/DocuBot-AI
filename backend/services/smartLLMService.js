const tokenTracker = require('./tokenTracker');
const contextMemoryService = require('./contextMemoryService');

class SmartLLMService {
    constructor() {
        console.log('🤖 Smart LLM Service initialized');
        this.tokenTracker = tokenTracker;
        this.contextMemory = contextMemoryService;
    }

    // Extract entities from the question to understand context
    extractEntities(question) {
        const lowerQ = question.toLowerCase();
        
        // Vehicle type detection - be more specific to avoid false positives
        let vehicleType = null;
        if (lowerQ.includes('superbike') || (lowerQ.includes('bike') && lowerQ.includes('super'))) {
            vehicleType = 'superbikes';
        } else if (lowerQ.includes('supercar') || (lowerQ.includes('super') && lowerQ.includes('car') && !lowerQ.includes('document'))) {
            vehicleType = 'supercars';
        }
        
        // Intent detection
        let intent = 'general_inquiry';
        if (lowerQ.includes('list') || lowerQ.includes('top') || lowerQ.includes('best')) {
            intent = 'list_request';
        } else if (lowerQ.includes('explain') || lowerQ.includes('what is') || lowerQ.includes('how')) {
            intent = 'explanation_request';
        }
        
        return {
            vehicleType,
            intent,
            isVehicleQuestion: vehicleType !== null
        };
    }

    // Try various free LLM APIs with configurable parameters
    async tryFreeAPIs(question, userId = 'anonymous', options = {}) {
        const {
            temperature = 0.7,
            maxTokens = 500,
            model = 'llama-3.1-8b-instant'
        } = options;

        // Get conversation context for better responses
        let messages = [{ role: 'user', content: question }];
        
        if (userId !== 'anonymous') {
            try {
                const contextData = await this.contextMemory.buildSmartContext(userId, question, 1000);
                if (contextData.conversationsUsed > 0) {
                    console.log(`🧠 Using conversation context: ${contextData.conversationsUsed} past conversations`);
                    
                    // Build proper ChatGPT-style message array
                    messages = [];
                    
                    // Add conversation history
                    contextData.relevantConversations.forEach(conv => {
                        messages.push({ role: 'user', content: conv.userMessage });
                        messages.push({ role: 'assistant', content: conv.botResponse });
                    });
                    
                    // Add current question
                    messages.push({ role: 'user', content: question });
                    
                    console.log(`📝 Sending ${messages.length} messages to LLM (${contextData.totalTokens} context tokens)`);
                }
            } catch (error) {
                console.log('⚠️ Context retrieval failed, using question only:', error.message);
            }
        }
        
        // Try Groq API first (best free option)
        try {
            console.log(`🚀 Trying Groq API with temperature: ${temperature}...`);
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,  // Now includes conversation history!
                    max_tokens: maxTokens,
                    temperature: temperature
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    console.log('✅ Groq API success!');
                    
                    // Save this conversation to context memory
                    if (userId !== 'anonymous') {
                        await this.contextMemory.saveConversationContext(
                            userId,
                            question,
                            data.choices[0].message.content,
                            { 
                                model: 'llama-3.1-8b-instant',
                                source: 'groq',
                                messagesUsed: messages.length
                            }
                        );
                    }
                    
                    return {
                        success: true,
                        response: data.choices[0].message.content,
                        source: 'Groq AI (Llama 3.1)',
                        model: 'llama-3.1-8b-instant',
                        contextUsed: messages.length > 1
                    };
                }
            } else {
                console.log('❌ Groq API failed:', response.status, await response.text());
            }
        } catch (error) {
            console.log('❌ Groq API error:', error.message);
        }
        
        // Try OpenRouter as backup (has free models)
        try {
            console.log('🔄 Trying OpenRouter API...');
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Knowledge Base ChatBot'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'user',
                            content: question
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    console.log('✅ OpenRouter API success!');
                    return {
                        success: true,
                        response: data.choices[0].message.content,
                        source: 'OpenRouter (GPT-3.5)',
                        model: 'gpt-3.5-turbo'
                    };
                }
            } else {
                console.log('❌ OpenRouter API failed:', response.status, await response.text());
            }
        } catch (error) {
            console.log('❌ OpenRouter API error:', error.message);
        }
        
        return null;
    }

    // Generate contextual fallback responses
    generateContextualResponse(question, entities) {
        console.log('🧠 Generating contextual response for:', entities);
        
        if (entities.isVehicleQuestion) {
            if (entities.vehicleType === 'superbikes') {
                if (entities.intent === 'list_request') {
                    return `Here are some of the top superbikes known for their exceptional performance:

🏍️ **Top Superbikes:**
1. **Kawasaki Ninja H2R** - Track-only beast with 310+ HP
2. **Ducati Panigale V4 R** - MotoGP-derived technology  
3. **BMW S1000RR** - Perfect balance of power and handling
4. **Yamaha YZF-R1M** - Advanced electronics and aerodynamics
5. **Honda CBR1000RR-R Fireblade SP** - Race-bred precision
6. **Aprilia RSV4 1100 Factory** - Italian engineering excellence
7. **Suzuki GSX-R1000R** - Legendary performance heritage

These machines represent the pinnacle of motorcycle engineering, designed for ultimate speed and track performance. Each offers unique characteristics in terms of power delivery, handling, and technology.`;
                } else {
                    return `Superbikes are the ultimate expression of motorcycle performance engineering. These high-performance machines are designed for maximum speed, acceleration, and track capability.

**Key Characteristics:**
- Engines typically 1000cc+ with 180-220+ horsepower
- Advanced aerodynamics and lightweight construction
- Sophisticated electronics (traction control, wheelie control, multiple riding modes)
- Track-focused geometry and suspension
- Premium components throughout

**Popular Categories:**
- Japanese superbikes (Yamaha, Honda, Kawasaki, Suzuki)
- European superbikes (Ducati, BMW, Aprilia)
- Track-only variants with even more extreme performance

Would you like to know more about any specific aspect of superbikes?`;
                }
            } else if (entities.vehicleType === 'supercars') {
                if (entities.intent === 'list_request') {
                    return `Here are some of the most prestigious supercars known for their incredible performance:

🏎️ **Top Supercars:**
1. **Bugatti Chiron** - 1,479 HP, 261 mph top speed
2. **McLaren 720S** - 710 HP, stunning aerodynamics
3. **Ferrari SF90 Stradale** - 986 HP hybrid powerhouse
4. **Lamborghini Aventador SVJ** - 759 HP, track-focused beast
5. **Porsche 911 GT2 RS** - 690 HP, legendary handling
6. **Koenigsegg Jesko** - 1,600 HP potential, Swedish engineering
7. **Pagani Huayra** - Artistic design meets extreme performance

These represent the pinnacle of automotive engineering, combining massive power with cutting-edge technology and stunning design.`;
                } else {
                    return `Supercars represent the absolute pinnacle of automotive performance and engineering excellence. These exclusive machines are designed to deliver breathtaking speed, handling, and visual impact.

**Key Characteristics:**
- Extremely powerful engines (500+ HP typical)
- Advanced aerodynamics and lightweight materials
- Cutting-edge technology and electronics
- Exotic styling and premium materials
- Limited production numbers

**Performance Focus:**
- 0-60 mph times under 3 seconds
- Top speeds often exceeding 200 mph
- Track-tuned suspension and braking systems
- Advanced traction and stability control

Would you like to know more about any specific supercar brand or technology?`;
                }
            }
        }
        
        // General responses for non-vehicle questions
        switch (entities.intent) {
            case 'explanation_request':
                return `I'd be happy to explain that topic! However, without access to real-time AI models, I can provide general information based on common knowledge. 

For the most accurate and detailed explanations, I recommend:
- Checking official documentation
- Consulting expert sources
- Using specialized knowledge bases

What specific aspect would you like me to focus on?`;
                
            case 'list_request':
                return `I understand you're looking for a list! While I can provide some general information, for comprehensive and up-to-date lists, I'd recommend:

- Official industry sources
- Recent reviews and comparisons  
- Expert recommendations
- Current market data

Could you provide more specific details about what kind of list you're looking for?`;
                
            default:
                return `Thank you for your question! I'm designed to help with various topics, particularly around vehicles, technology, and general knowledge.

**I can help with:**
- Superbikes and motorcycle information
- Supercars and automotive topics  
- Technology explanations
- General knowledge questions

**Current Status:**
I'm currently using contextual responses while working to integrate with advanced AI models. For the most detailed and current information, you might want to check specialized sources.

How can I assist you further?`;
        }
    }

    // Main method to generate responses with configurable temperature
    async generateResponse(question, options = {}) {
        console.log('🤖 Smart LLM Service processing:', question);
        
        const userId = options.userId || 'anonymous';
        const temperature = options.temperature || 0.7;
        const maxTokens = options.maxTokens || 500;
        const model = options.model || 'llama-3.1-8b-instant';
        
        console.log(`🌡️ Using temperature: ${temperature}, maxTokens: ${maxTokens}, model: ${model}`);
        
        // Check rate limits
        const limitCheck = this.tokenTracker.checkLimits(userId, 'groq');
        if (!limitCheck.withinLimit) {
            console.log(`🚫 Rate limit exceeded for user ${userId}`);
            return {
                response: `Daily request limit reached (${limitCheck.requestsUsed}/${limitCheck.requestsUsed + limitCheck.requestsRemaining}). Please try again tomorrow.`,
                source: 'Rate Limit System',
                model: 'rate_limit',
                type: 'rate_limit_exceeded',
                usage: limitCheck
            };
        }
        
        // Extract context from the question
        const entities = this.extractEntities(question);
        
        // Estimate input tokens
        const inputTokens = this.tokenTracker.estimateTokens(question);
        console.log(`📊 Estimated input tokens: ${inputTokens}`);
        
        // Try real AI APIs first with temperature options
        const aiResponse = await this.tryFreeAPIs(question, userId, {
            temperature,
            maxTokens,
            model
        });
        if (aiResponse && aiResponse.success) {
            // Estimate output tokens and track usage
            const outputTokens = this.tokenTracker.estimateTokens(aiResponse.response);
            const usage = this.tokenTracker.trackUsage(userId, inputTokens, outputTokens, aiResponse.model);
            
            console.log(`📊 Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${inputTokens + outputTokens}`);
            console.log(`📈 Daily usage: ${usage.requestCount} requests, ${usage.totalTokens} tokens`);
            
            return {
                response: aiResponse.response,
                source: aiResponse.source,
                model: aiResponse.model,
                type: 'ai_generated',
                temperature,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    dailyUsage: usage,
                    limits: this.tokenTracker.checkLimits(userId, 'groq')
                }
            };
        }
        
        // Fallback to contextual responses
        console.log('🔄 Using contextual fallback response');
        const contextualResponse = this.generateContextualResponse(question, entities);
        
        // Track fallback usage
        const outputTokens = this.tokenTracker.estimateTokens(contextualResponse);
        const usage = this.tokenTracker.trackUsage(userId, inputTokens, outputTokens, 'contextual_ai');
        
        return {
            response: contextualResponse,
            source: 'Smart Contextual System',
            model: 'contextual_ai',
            type: 'contextual',
            entities: entities,
            temperature,
            usage: {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                dailyUsage: usage,
                limits: this.tokenTracker.checkLimits(userId, 'groq')
            }
        };
    }
}

module.exports = new SmartLLMService();
