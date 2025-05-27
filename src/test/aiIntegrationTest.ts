import { OpenAIService } from '../ai/openaiService';
import { AIIntegrationService } from '../ai/aiIntegrationService';
import { ConfigurationManager } from '../config/configurationManager';

/**
 * Simple test function to verify OpenAI integration
 */
export async function testOpenAIIntegration(): Promise<void> {
	console.log('[Test] Starting OpenAI integration test');

	try {
		// Get configuration manager
		const configManager = ConfigurationManager.getInstance();
		
		// Check if test API key is available
		const apiKey = await configManager.getApiKey();
		if (!apiKey) {
			console.error('[Test] No API key found. Please set TEST_OPENAI_API_KEY in environment variables.');
			return;
		}

		console.log(`[Test] Found API key: ${apiKey.substring(0, 10)}...`);

		// Test OpenAI service directly
		const openaiService = OpenAIService.getInstance();
		const initResult = await openaiService.initialize(apiKey);
		
		if (!initResult) {
			console.error('[Test] Failed to initialize OpenAI service');
			return;
		}

		console.log('[Test] OpenAI service initialized successfully');

		// Test AI integration service
		const aiService = AIIntegrationService.getInstance();
		const testResult = await aiService.testIntegration();

		if (testResult.success) {
			console.log(`[Test] AI integration test successful!`);
			console.log(`[Test] Generated summary: ${testResult.summary}`);
			if (testResult.tokenUsage) {
				console.log(`[Test] Token usage: ${testResult.tokenUsage.totalTokens} tokens`);
			}
		} else {
			console.error(`[Test] AI integration test failed: ${testResult.errorMessage}`);
		}

	} catch (error) {
		console.error('[Test] Error during OpenAI integration test:', error);
	}
}

// Export for potential use in other test files
export { testOpenAIIntegration as default }; 