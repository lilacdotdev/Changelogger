import OpenAI from 'openai';
import { FileChange } from '../git/gitDataExtractor';

/**
 * Interface for OpenAI API configuration
 */
export interface OpenAIConfig {
	/** The OpenAI API key */
	apiKey: string;
	/** The model to use for completions */
	model: string;
	/** Maximum tokens for the response */
	maxTokens: number;
	/** Temperature for response creativity (0-1) */
	temperature: number;
}

/**
 * Interface for change summary request
 */
export interface ChangeSummaryRequest {
	/** The commit message */
	commitMessage: string;
	/** Array of file changes with diff content */
	fileChanges: FileChange[];
	/** Additional context for the AI */
	context?: string;
}

/**
 * Interface for change summary response
 */
export interface ChangeSummaryResponse {
	/** Whether the request was successful */
	success: boolean;
	/** The generated summary */
	summary?: string;
	/** Error message if request failed */
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
 * Service class for OpenAI API integration
 */
export class OpenAIService {
	private static instance: OpenAIService;
	private openai: OpenAI | null = null;
	private config: OpenAIConfig | null = null;

	/**
	 * Default configuration for OpenAI requests
	 */
	private static readonly DEFAULT_CONFIG: Omit<OpenAIConfig, 'apiKey'> = {
		model: 'gpt-3.5-turbo',
		maxTokens: 500,
		temperature: 0.3
	};

	/**
	 * Maximum total tokens to send to OpenAI (to prevent excessive costs)
	 */
	private static readonly MAX_PROMPT_TOKENS = 8000;

	/**
	 * Get the singleton instance of OpenAIService
	 */
	public static getInstance(): OpenAIService {
		if (!OpenAIService.instance) {
			OpenAIService.instance = new OpenAIService();
		}
		return OpenAIService.instance;
	}

	/**
	 * Initialize the OpenAI service with API key
	 * @param apiKey The OpenAI API key
	 * @param customConfig Optional custom configuration
	 * @returns Promise<boolean> Whether initialization was successful
	 */
	public async initialize(apiKey: string, customConfig?: Partial<OpenAIConfig>): Promise<boolean> {
		try {
			console.log('[OpenAIService] Initializing OpenAI service');

			if (!apiKey || apiKey.trim() === '') {
				console.error('[OpenAIService] API key is required for initialization');
				return false;
			}

			// Validate API key format
			if (!this.validateApiKey(apiKey)) {
				console.error('[OpenAIService] Invalid API key format');
				return false;
			}

			// Create configuration
			this.config = {
				apiKey: apiKey.trim(),
				...OpenAIService.DEFAULT_CONFIG,
				...customConfig
			};

			// Initialize OpenAI client
			this.openai = new OpenAI({
				apiKey: this.config.apiKey
			});

			// Test the connection
			const testResult = await this.testConnection();
			if (!testResult) {
				console.error('[OpenAIService] Connection test failed');
				this.openai = null;
				this.config = null;
				return false;
			}

			console.log('[OpenAIService] OpenAI service initialized successfully');
			return true;

		} catch (error) {
			console.error('[OpenAIService] Error initializing OpenAI service:', error);
			this.openai = null;
			this.config = null;
			return false;
		}
	}

	/**
	 * Generate a summary of code changes using OpenAI
	 * @param request The change summary request
	 * @returns Promise<ChangeSummaryResponse> The summary response
	 */
	public async generateChangeSummary(request: ChangeSummaryRequest): Promise<ChangeSummaryResponse> {
		try {
			console.log('[OpenAIService] Generating change summary');

			// Validate service is initialized
			if (!this.openai || !this.config) {
				const error = 'OpenAI service not initialized';
				console.error(`[OpenAIService] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Service must be initialized with valid API key'
				};
			}

			// Validate request
			const validationResult = this.validateRequest(request);
			if (!validationResult.isValid) {
				console.error(`[OpenAIService] Request validation failed: ${validationResult.error}`);
				return {
					success: false,
					errorMessage: validationResult.error || 'Request validation failed',
					context: 'Request validation failed'
				};
			}

			// Build the prompt
			const prompt = this.buildPrompt(request);
			console.log(`[OpenAIService] Built prompt: ${prompt.length} characters`);

			// Check token limits
			const estimatedTokens = this.estimateTokens(prompt);
			if (estimatedTokens > OpenAIService.MAX_PROMPT_TOKENS) {
				const error = `Prompt too long: ${estimatedTokens} tokens (max: ${OpenAIService.MAX_PROMPT_TOKENS})`;
				console.error(`[OpenAIService] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Consider reducing the number of files or diff content'
				};
			}

			// Make the API request
			const completion = await this.openai.chat.completions.create({
				model: this.config.model,
				messages: [
					{
						role: 'system',
						content: 'You are a helpful assistant that summarizes code changes in a clear, concise manner. Focus on the functional impact and purpose of the changes.'
					},
					{
						role: 'user',
						content: prompt
					}
				],
				max_tokens: this.config.maxTokens,
				temperature: this.config.temperature
			});

			// Extract the response
			const summary = completion.choices[0]?.message?.content?.trim();
			if (!summary) {
				const error = 'No summary generated by OpenAI';
				console.error(`[OpenAIService] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'OpenAI returned empty response'
				};
			}

			console.log(`[OpenAIService] Successfully generated summary: ${summary.length} characters`);

			return {
				success: true,
				summary,
				tokenUsage: {
					promptTokens: completion.usage?.prompt_tokens || 0,
					completionTokens: completion.usage?.completion_tokens || 0,
					totalTokens: completion.usage?.total_tokens || 0
				}
			};

		} catch (error) {
			const errorMessage = `Failed to generate change summary: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[OpenAIService] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: 'OpenAI API request failed'
			};
		}
	}

	/**
	 * Test the OpenAI connection
	 * @returns Promise<boolean> Whether the connection test was successful
	 */
	private async testConnection(): Promise<boolean> {
		try {
			console.log('[OpenAIService] Testing OpenAI connection');

			if (!this.openai) {
				return false;
			}

			// Make a simple test request
			const completion = await this.openai.chat.completions.create({
				model: this.config!.model,
				messages: [
					{
						role: 'user',
						content: 'Test connection. Please respond with "OK".'
					}
				],
				max_tokens: 10,
				temperature: 0
			});

			const response = completion.choices[0]?.message?.content?.trim();
			const success = response !== undefined && response.length > 0;

			console.log(`[OpenAIService] Connection test ${success ? 'successful' : 'failed'}`);
			return success;

		} catch (error) {
			console.error('[OpenAIService] Connection test failed:', error);
			return false;
		}
	}

	/**
	 * Validate API key format
	 * @param apiKey The API key to validate
	 * @returns boolean Whether the API key format is valid
	 */
	private validateApiKey(apiKey: string): boolean {
		// OpenAI API keys start with 'sk-' and are typically 51 characters long
		const apiKeyRegex = /^sk-[a-zA-Z0-9]{48}$/;
		return apiKeyRegex.test(apiKey);
	}

	/**
	 * Validate the change summary request
	 * @param request The request to validate
	 * @returns object Validation result
	 */
	private validateRequest(request: ChangeSummaryRequest): { isValid: boolean; error?: string } {
		if (!request.commitMessage || request.commitMessage.trim() === '') {
			return { isValid: false, error: 'Commit message is required' };
		}

		if (!request.fileChanges || request.fileChanges.length === 0) {
			return { isValid: false, error: 'File changes are required' };
		}

		// Check if any files have diff content for AI processing
		const filesWithDiff = request.fileChanges.filter(f => f.includeInAI && f.diffContent);
		if (filesWithDiff.length === 0) {
			return { isValid: false, error: 'No files with diff content available for AI processing' };
		}

		return { isValid: true };
	}

	/**
	 * Build the prompt for OpenAI
	 * @param request The change summary request
	 * @returns string The formatted prompt
	 */
	private buildPrompt(request: ChangeSummaryRequest): string {
		const lines: string[] = [];

		lines.push('Please analyze the following git commit and provide a concise summary in 2 sentences or less.');
		lines.push('Focus on the functional impact and purpose of the changes.');
		lines.push('');
		lines.push(`Commit Message: ${request.commitMessage}`);
		lines.push('');

		// Add file structure overview
		lines.push('File Changes:');
		for (const file of request.fileChanges) {
			lines.push(`${file.changeSymbol} ${file.filePath} (${file.changeType})`);
		}
		lines.push('');

		// Add diff content for files marked for AI processing
		const filesWithDiff = request.fileChanges.filter(f => f.includeInAI && f.diffContent);
		if (filesWithDiff.length > 0) {
			lines.push('Code Changes:');
			for (const file of filesWithDiff) {
				lines.push(`\n--- ${file.filePath} ---`);
				lines.push(file.diffContent!);
			}
		}

		// Add context if provided
		if (request.context) {
			lines.push('');
			lines.push(`Additional Context: ${request.context}`);
		}

		return lines.join('\n');
	}

	/**
	 * Estimate token count for a prompt (rough approximation)
	 * @param text The text to estimate tokens for
	 * @returns number Estimated token count
	 */
	private estimateTokens(text: string): number {
		// Rough approximation: 1 token ≈ 4 characters for English text
		return Math.ceil(text.length / 4);
	}

	/**
	 * Get the current configuration
	 * @returns OpenAIConfig | null The current configuration
	 */
	public getConfig(): OpenAIConfig | null {
		return this.config ? { ...this.config } : null;
	}

	/**
	 * Check if the service is initialized
	 * @returns boolean Whether the service is initialized
	 */
	public isInitialized(): boolean {
		return this.openai !== null && this.config !== null;
	}

	/**
	 * Dispose of the OpenAI service
	 */
	public dispose(): void {
		console.log('[OpenAIService] Disposing OpenAI service');
		this.openai = null;
		this.config = null;
	}
} 