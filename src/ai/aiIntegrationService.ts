import { OpenAIService, ChangeSummaryRequest } from './openaiService';
import { ConfigurationManager } from '../config/configurationManager';
import { CommitInfo } from '../git/gitDataExtractor';

/**
 * Interface for AI integration result
 */
export interface AIIntegrationResult {
	/** Whether the integration was successful */
	success: boolean;
	/** The generated AI summary */
	summary?: string;
	/** Error message if integration failed */
	errorMessage?: string;
	/** Token usage information */
	tokenUsage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	/** Additional context for debugging */
	context?: string;
}

/**
 * Interface for AI service initialization result
 */
export interface AIInitializationResult {
	/** Whether initialization was successful */
	success: boolean;
	/** Error message if initialization failed */
	errorMessage?: string;
	/** Whether the service is ready for use */
	isReady: boolean;
	/** Additional context for debugging */
	context?: string;
}

/**
 * Service class for integrating AI capabilities with changelog generation
 */
export class AIIntegrationService {
	private static instance: AIIntegrationService;
	private openaiService: OpenAIService;
	private configManager: ConfigurationManager;
	private isInitialized: boolean = false;

	/**
	 * Get the singleton instance of AIIntegrationService
	 */
	public static getInstance(): AIIntegrationService {
		if (!AIIntegrationService.instance) {
			AIIntegrationService.instance = new AIIntegrationService();
		}
		return AIIntegrationService.instance;
	}

	/**
	 * Private constructor for singleton pattern
	 */
	private constructor() {
		this.openaiService = OpenAIService.getInstance();
		this.configManager = ConfigurationManager.getInstance();
	}

	/**
	 * Initialize the AI integration service
	 * @returns Promise<AIInitializationResult> The initialization result
	 */
	public async initialize(): Promise<AIInitializationResult> {
		try {
			console.log('[AIIntegrationService] Initializing AI integration service');

			// Check if AI mode is available
			const isAiModeAvailable = await this.configManager.isAiModeAvailable();
			if (!isAiModeAvailable) {
				const error = 'AI mode not available: API key not configured or invalid';
				console.warn(`[AIIntegrationService] ${error}`);
				return {
					success: false,
					errorMessage: error,
					isReady: false,
					context: 'Configure a valid OpenAI API key to enable AI features'
				};
			}

			// Get API key
			const apiKey = await this.configManager.getApiKey();
			if (!apiKey) {
				const error = 'No API key found for OpenAI service';
				console.error(`[AIIntegrationService] ${error}`);
				return {
					success: false,
					errorMessage: error,
					isReady: false,
					context: 'API key retrieval failed'
				};
			}

			// Initialize OpenAI service
			const initSuccess = await this.openaiService.initialize(apiKey);
			if (!initSuccess) {
				const error = 'Failed to initialize OpenAI service';
				console.error(`[AIIntegrationService] ${error}`);
				return {
					success: false,
					errorMessage: error,
					isReady: false,
					context: 'OpenAI service initialization failed'
				};
			}

			this.isInitialized = true;
			console.log('[AIIntegrationService] AI integration service initialized successfully');

			return {
				success: true,
				isReady: true
			};

		} catch (error) {
			const errorMessage = `Failed to initialize AI integration service: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[AIIntegrationService] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				isReady: false,
				context: 'AI integration initialization failed'
			};
		}
	}

	/**
	 * Generate AI-powered summary for commit changes
	 * @param commitInfo The commit information to summarize
	 * @param context Optional additional context for the AI
	 * @returns Promise<AIIntegrationResult> The AI integration result
	 */
	public async generateCommitSummary(commitInfo: CommitInfo, context?: string): Promise<AIIntegrationResult> {
		try {
			console.log(`[AIIntegrationService] Generating AI summary for commit: ${commitInfo.hash}`);

			// Ensure service is initialized
			if (!this.isInitialized) {
				console.log('[AIIntegrationService] Service not initialized, attempting initialization');
				const initResult = await this.initialize();
				if (!initResult.success) {
					console.error(`[AIIntegrationService] Initialization failed: ${initResult.errorMessage}`);
					return {
						success: false,
						errorMessage: initResult.errorMessage || 'Initialization failed',
						context: initResult.context || 'Service initialization failed'
					};
				}
			}

			// Validate commit info
			const validationResult = this.validateCommitInfo(commitInfo);
			if (!validationResult.isValid) {
				console.error(`[AIIntegrationService] Commit validation failed: ${validationResult.error}`);
				return {
					success: false,
					errorMessage: validationResult.error || 'Commit validation failed',
					context: 'Commit information validation failed'
				};
			}

			// Prepare the request for OpenAI
			const request: ChangeSummaryRequest = {
				commitMessage: commitInfo.message,
				fileChanges: commitInfo.fileChanges,
				...(context && { context })
			};

			// Generate summary using OpenAI
			const summaryResponse = await this.openaiService.generateChangeSummary(request);
			if (!summaryResponse.success) {
				console.error(`[AIIntegrationService] OpenAI summary generation failed: ${summaryResponse.errorMessage}`);
				return {
					success: false,
					errorMessage: summaryResponse.errorMessage || 'OpenAI summary generation failed',
					context: summaryResponse.context || 'OpenAI API request failed'
				};
			}

			console.log(`[AIIntegrationService] Successfully generated AI summary: ${summaryResponse.summary?.length} characters`);

			return {
				success: true,
				summary: summaryResponse.summary || 'No summary generated',
				...(summaryResponse.tokenUsage && { tokenUsage: summaryResponse.tokenUsage })
			};

		} catch (error) {
			const errorMessage = `Failed to generate AI commit summary: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[AIIntegrationService] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: 'AI summary generation failed'
			};
		}
	}

	/**
	 * Check if AI integration is ready for use
	 * @returns Promise<boolean> Whether AI integration is ready
	 */
	public async isReady(): Promise<boolean> {
		try {
			// Check if service is initialized
			if (!this.isInitialized) {
				return false;
			}

			// Check if OpenAI service is initialized
			if (!this.openaiService.isInitialized()) {
				return false;
			}

			// Check if AI mode is available
			const isAiModeAvailable = await this.configManager.isAiModeAvailable();
			return isAiModeAvailable;

		} catch (error) {
			console.error('[AIIntegrationService] Error checking readiness:', error);
			return false;
		}
	}

	/**
	 * Get the current AI service status
	 * @returns Promise<object> Status information
	 */
	public async getStatus(): Promise<object> {
		try {
			const isReady = await this.isReady();
			const config = this.configManager.getConfigurationSummary();
			const openaiConfig = this.openaiService.getConfig();

			return {
				isInitialized: this.isInitialized,
				isReady,
				openaiServiceInitialized: this.openaiService.isInitialized(),
				configuration: config,
				openaiModel: openaiConfig?.model || 'not configured',
				maxTokens: openaiConfig?.maxTokens || 'not configured'
			};

		} catch (error) {
			console.error('[AIIntegrationService] Error getting status:', error);
			return { error: 'Failed to get AI service status' };
		}
	}

	/**
	 * Reinitialize the AI service (useful when API key changes)
	 * @returns Promise<AIInitializationResult> The reinitialization result
	 */
	public async reinitialize(): Promise<AIInitializationResult> {
		try {
			console.log('[AIIntegrationService] Reinitializing AI integration service');

			// Dispose current services
			this.dispose();

			// Reinitialize
			return await this.initialize();

		} catch (error) {
			const errorMessage = `Failed to reinitialize AI integration service: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[AIIntegrationService] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				isReady: false,
				context: 'AI integration reinitialization failed'
			};
		}
	}

	/**
	 * Test the AI integration with a simple request
	 * @returns Promise<AIIntegrationResult> The test result
	 */
	public async testIntegration(): Promise<AIIntegrationResult> {
		try {
			console.log('[AIIntegrationService] Testing AI integration');

			// Ensure service is ready
			const isReady = await this.isReady();
			if (!isReady) {
				const error = 'AI integration not ready for testing';
				console.error(`[AIIntegrationService] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Service not initialized or configured properly'
				};
			}

			// Create a test commit info
			const testCommitInfo: CommitInfo = {
				hash: 'test123',
				message: 'Test commit for AI integration',
				author: 'Test User',
				email: 'test@example.com',
				date: new Date(),
				fileChanges: [
					{
						filePath: 'test.ts',
						changeType: 'modified',
						changeSymbol: '*',
						includeInAI: true,
						diffContent: '+ console.log("Hello, AI!");'
					}
				]
			};

			// Test the summary generation
			return await this.generateCommitSummary(testCommitInfo, 'This is a test of the AI integration');

		} catch (error) {
			const errorMessage = `AI integration test failed: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[AIIntegrationService] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: 'AI integration test failed'
			};
		}
	}

	/**
	 * Validate commit information for AI processing
	 * @param commitInfo The commit information to validate
	 * @returns object Validation result
	 */
	private validateCommitInfo(commitInfo: CommitInfo): { isValid: boolean; error?: string } {
		if (!commitInfo.message || commitInfo.message.trim() === '') {
			return { isValid: false, error: 'Commit message is required' };
		}

		if (!commitInfo.fileChanges || commitInfo.fileChanges.length === 0) {
			return { isValid: false, error: 'File changes are required' };
		}

		// Check if any files are marked for AI processing
		const aiFiles = commitInfo.fileChanges.filter(f => f.includeInAI && f.diffContent);
		if (aiFiles.length === 0) {
			return { isValid: false, error: 'No files available for AI processing' };
		}

		return { isValid: true };
	}

	/**
	 * Dispose of the AI integration service
	 */
	public dispose(): void {
		try {
			console.log('[AIIntegrationService] Disposing AI integration service');

			// Dispose OpenAI service
			this.openaiService.dispose();

			// Reset initialization state
			this.isInitialized = false;

			console.log('[AIIntegrationService] AI integration service disposed');

		} catch (error) {
			console.error('[AIIntegrationService] Error disposing AI integration service:', error);
		}
	}
} 