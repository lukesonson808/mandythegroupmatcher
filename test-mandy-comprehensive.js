/**
 * Comprehensive test script to verify Mandy responds to all messages with humor
 * Tests various conversation scenarios to ensure she's funny and engaging
 */

const mandyAgent = require('./agents/mandy-agent');
const claudeService = require('./services/claude-service');

// Comprehensive test scenarios
const testScenarios = [
  {
    name: "Math Question",
    message: "what's 2x2",
    expected: "Should answer correctly but with humor"
  },
  {
    name: "Geography Question",
    message: "what's the capital of France",
    expected: "Should answer correctly but with humor"
  },
  {
    name: "Awkward Situation",
    message: "this is awkward",
    expected: "Should acknowledge awkwardness with humor, break the ice"
  },
  {
    name: "Game Request",
    message: "can you send another game",
    expected: "Should acknowledge enthusiastically (game sending handled separately)"
  },
  {
    name: "Random Chat - Greeting",
    message: "hey",
    expected: "Should respond with humor and be engaging"
  },
  {
    name: "Random Chat - How are you",
    message: "how's it going",
    expected: "Should be conversational and funny"
  },
  {
    name: "Joke Request",
    message: "tell me a joke",
    expected: "Should tell a funny joke"
  },
  {
    name: "Complaint",
    message: "I'm bored",
    expected: "Should be funny and suggest games or activities"
  },
  {
    name: "Question About Matching",
    message: "why were we matched",
    expected: "Should acknowledge matching is done, focus on having fun with humor"
  },
  {
    name: "Random Statement",
    message: "I like pizza",
    expected: "Should respond with humor, not ignore it"
  },
  {
    name: "Question Without Name",
    message: "what time is it",
    expected: "Should respond (even without name mention) with humor"
  },
  {
    name: "Simple Acknowledgment",
    message: "ok",
    expected: "Should respond with humor, not ignore"
  },
  {
    name: "Emoji Only",
    message: "😄",
    expected: "Should respond with humor"
  },
  {
    name: "Random Question",
    message: "what's your favorite color",
    expected: "Should answer with humor"
  }
];

async function testMandyResponse(scenario, conversationHistory = []) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Testing: ${scenario.name}`);
  console.log(`📝 User: "${scenario.message}"`);
  console.log(`💭 Expected: ${scenario.expected}`);
  if (conversationHistory.length > 0) {
    console.log(`📚 Conversation history: ${conversationHistory.length} messages`);
  }
  console.log(`${'='.repeat(80)}\n`);

  try {
    const systemPrompt = mandyAgent.getSystemPrompt();
    const messages = [...conversationHistory];
    
    // Add current user message
    messages.push({ role: 'user', content: scenario.message });

    const response = await claudeService.chat(messages, {
      systemPrompt: systemPrompt,
      ...mandyAgent.getGenerationOptions(),
      temperature: 0.95,
      maxTokens: 200,
      timeout: 15000
    });

    // Remove any prefixes
    let cleanResponse = response.trim();
    cleanResponse = cleanResponse.replace(/^(Mandy\s+(The\s+)?(Matchmaker|Group\s+Matcher|Icebreaker)?:?\s*)/i, '');
    cleanResponse = cleanResponse.trim();

    console.log(`✅ Mandy's Response: "${cleanResponse}"`);
    console.log(`📊 Length: ${cleanResponse.length} chars`);
    
    // Check for humor indicators
    const humorIndicators = ['lol', 'haha', '😂', '😄', '😅', 'wait what', 'that\'s', 'unhinged', 'iconic', 'chaos', 'funny', 'hilarious'];
    const hasHumor = humorIndicators.some(indicator => cleanResponse.toLowerCase().includes(indicator));
    
    // Check if response exists (not empty)
    const hasResponse = cleanResponse.length > 0;
    
    // Check if it's engaging (not just "ok" or "sure")
    const isEngaging = cleanResponse.length > 10 && !['ok', 'sure', 'yes', 'no'].includes(cleanResponse.toLowerCase().trim());
    
    if (hasResponse) {
      console.log(`✅ Has response`);
    } else {
      console.log(`❌ No response generated`);
    }
    
    if (hasHumor) {
      console.log(`✅ Contains humor indicators`);
    } else {
      console.log(`⚠️  No obvious humor indicators - might need more personality`);
    }
    
    if (isEngaging) {
      console.log(`✅ Response is engaging`);
    } else {
      console.log(`⚠️  Response might be too short or generic`);
    }

    return { 
      scenario: scenario.name, 
      response: cleanResponse, 
      hasHumor, 
      hasResponse,
      isEngaging,
      passed: hasResponse && isEngaging
    };
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { scenario: scenario.name, error: error.message, passed: false };
  }
}

async function testConversationFlow() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TESTING CONVERSATION FLOW`);
  console.log(`${'='.repeat(80)}\n`);

  const conversationHistory = [];
  const flow = [
    { name: "Greeting", message: "hey" },
    { name: "Follow-up", message: "how's it going" },
    { name: "Random Question", message: "what's 2+2" },
    { name: "Statement", message: "I'm having fun" }
  ];

  for (const scenario of flow) {
    const result = await testMandyResponse(
      { name: scenario.name, message: scenario.message, expected: "Should respond with humor" },
      conversationHistory
    );
    
    if (result.response) {
      conversationHistory.push({ role: 'user', content: scenario.message });
      conversationHistory.push({ role: 'assistant', content: result.response });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function runAllTests() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 COMPREHENSIVE MANDY RESPONSE TESTING`);
  console.log(`${'='.repeat(80)}\n`);

  const results = [];
  
  // Test individual scenarios
  for (const scenario of testScenarios) {
    const result = await testMandyResponse(scenario);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test conversation flow
  await testConversationFlow();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);

  const successful = results.filter(r => r.passed).length;
  const withHumor = results.filter(r => r.hasHumor).length;
  const withResponse = results.filter(r => r.hasResponse).length;
  const engaging = results.filter(r => r.isEngaging).length;

  console.log(`✅ Successful responses: ${successful}/${testScenarios.length}`);
  console.log(`💬 Has response: ${withResponse}/${testScenarios.length}`);
  console.log(`😄 Responses with humor: ${withHumor}/${testScenarios.length}`);
  console.log(`🎯 Engaging responses: ${engaging}/${testScenarios.length}`);
  console.log(`\n📋 Individual Results:`);
  
  results.forEach(result => {
    if (result.error) {
      console.log(`  ❌ ${result.scenario}: ERROR - ${result.error}`);
    } else {
      const status = result.passed ? '✅' : '⚠️';
      const humor = result.hasHumor ? '😄' : '';
      console.log(`  ${status} ${humor} ${result.scenario}: "${result.response.substring(0, 60)}..."`);
    }
  });

  // Overall assessment
  console.log(`\n${'='.repeat(80)}`);
  if (successful >= testScenarios.length * 0.8 && withHumor >= testScenarios.length * 0.7) {
    console.log(`✅ OVERALL: Mandy is working well! Most responses are funny and engaging.`);
  } else if (successful >= testScenarios.length * 0.6) {
    console.log(`⚠️  OVERALL: Mandy is mostly working but could use more humor.`);
  } else {
    console.log(`❌ OVERALL: Mandy needs improvement - responses may be missing or not funny enough.`);
  }
  console.log(`${'='.repeat(80)}\n`);
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testMandyResponse, runAllTests, testConversationFlow };
