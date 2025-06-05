require('dotenv').config();
const smartLLMService = require('./services/smartLLMService');

async function testSmartLLMService() {
    console.log('🚀 Testing Smart LLM Service...\n');
    
    const testQuestions = [
        "Can you list top 5 super bikes?",
        "What are the fastest supercars?", 
        "Explain what is JavaScript",
        "Tell me about machine learning",
        "Hello, how are you?"
    ];
    
    for (const question of testQuestions) {
        console.log(`\n❓ Question: "${question}"`);
        console.log('─'.repeat(50));
        
        try {
            const result = await smartLLMService.generateResponse(question);
            
            console.log(`📤 Response Type: ${result.type}`);
            console.log(`🔧 Source: ${result.source}`);
            console.log(`🤖 Model: ${result.model}`);
            if (result.entities) {
                console.log(`🧠 Detected: ${JSON.stringify(result.entities)}`);
            }
            console.log(`\n💬 Response:\n${result.response}`);
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }
        
        console.log('\n' + '='.repeat(70));
    }
}

if (require.main === module) {
    testSmartLLMService();
}

module.exports = { testSmartLLMService };
