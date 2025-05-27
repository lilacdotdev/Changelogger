import * as vscode from 'vscode';
import { ValidationUtils } from '../utils/validation';

/**
 * Interface for extension configuration
 */
export interface ExtensionConfig {
	/** The OpenAI API key */
	openaiApiKey: string;
	/** The operating mode (base or ai) */
	mode: 'base' | 'ai';
	/** The changelog file path */
	changelogPath: string;
	/** Whether to auto-generate on commits */
	autoGenerate: boolean;
}

/**
 * Interface for configuration validation result
 */
export interface ConfigValidationResult {
	/** Whether the configuration is valid */
	isValid: boolean;
	/** Error message if validation failed */
	errorMessage?: string;
	/** Missing or invalid configuration keys */
	invalidKeys?: string[];
	/** Additional context for debugging */
	context?: string;
}

/**
 * Interface for API key management result
 */
export interface ApiKeyResult {
	/** Whether the operation was successful */
	success: boolean;
	/** Error message if operation failed */
	errorMessage?: string;
	/** Whether the API key is valid */
	isValid?: boolean;
	/** Additional context for debugging */
	context?: string;
}

/**
 * Service class for managing extension configuration
 */
export class ConfigurationManager {
	private static instance: ConfigurationManager;
	private static readonly CONFIGURATION_SECTION = 'changelogger';

	/**
	 * Environment variable names for API key fallback
	 */
	private static readonly ENV_API_KEY_NAMES = [
		'OPENAI_API_KEY',
		'TEST_OPENAI_API_KEY',
		'CHANGELOGGER_OPENAI_API_KEY'
	];

	/**
	 * Get the singleton instance of ConfigurationManager
	 */
	public static getInstance(): ConfigurationManager {
		if (!ConfigurationManager.instance) {
			ConfigurationManager.instance = new ConfigurationManager();
		}
		return ConfigurationManager.instance;
	}

	/**
	 * Get the current extension configuration
	 * @returns ExtensionConfig The current configuration
	 */
	public getConfiguration(): ExtensionConfig {
		try {
			console.log('[ConfigurationManager] Getting current configuration');

			const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIGURATION_SECTION);

			const extensionConfig: ExtensionConfig = {
				openaiApiKey: config.get<string>('openaiApiKey', ''),
				mode: config.get<'base' | 'ai'>('mode', 'base'),
				changelogPath: config.get<string>('changelogPath', 'CHANGELOG.md'),
				autoGenerate: config.get<boolean>('autoGenerate', false)
			};

			console.log(`[ConfigurationManager] Configuration retrieved: mode=${extensionConfig.mode}, autoGenerate=${extensionConfig.autoGenerate}`);
			return extensionConfig;

		} catch (error) {
			console.error('[ConfigurationManager] Error getting configuration:', error);
			// Return default configuration on error
			return {
				openaiApiKey: '',
				mode: 'base',
				changelogPath: 'CHANGELOG.md',
				autoGenerate: false
			};
		}
	}

	/**
	 * Update a specific configuration value
	 * @param key The configuration key to update
	 * @param value The new value
	 * @param target The configuration target (workspace, global, etc.)
	 * @returns Promise<boolean> Whether the update was successful
	 */
	public async updateConfiguration<K extends keyof ExtensionConfig>(
		key: K,
		value: ExtensionConfig[K],
		target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
	): Promise<boolean> {
		try {
			console.log(`[ConfigurationManager] Updating configuration: ${key} = ${typeof value === 'string' && key === 'openaiApiKey' ? '[REDACTED]' : value}`);

			const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIGURATION_SECTION);
			await config.update(key, value, target);

			console.log(`[ConfigurationManager] Configuration updated successfully: ${key}`);
			return true;

		} catch (error) {
			console.error(`[ConfigurationManager] Error updating configuration ${key}:`, error);
			return false;
		}
	}

	/**
	 * Get the OpenAI API key from configuration or environment
	 * @returns Promise<string> The API key (empty string if not found)
	 */
	public async getApiKey(): Promise<string> {
		try {
			console.log('[ConfigurationManager] Getting OpenAI API key');

			// First, try to get from VS Code configuration
			const config = this.getConfiguration();
			if (config.openaiApiKey && config.openaiApiKey.trim() !== '') {
				console.log('[ConfigurationManager] API key found in VS Code configuration');
				return config.openaiApiKey.trim();
			}

			// Fallback to environment variables
			console.log('[ConfigurationManager] API key not found in configuration, checking environment variables');
			for (const envName of ConfigurationManager.ENV_API_KEY_NAMES) {
				const envValue = process.env[envName];
				if (envValue && envValue.trim() !== '') {
					console.log(`[ConfigurationManager] API key found in environment variable: ${envName}`);
					return envValue.trim();
				}
			}

			console.log('[ConfigurationManager] No API key found in configuration or environment');
			return '';

		} catch (error) {
			console.error('[ConfigurationManager] Error getting API key:', error);
			return '';
		}
	}

	/**
	 * Set the OpenAI API key in VS Code configuration
	 * @param apiKey The API key to set
	 * @param target The configuration target
	 * @returns Promise<ApiKeyResult> The operation result
	 */
	public async setApiKey(
		apiKey: string,
		target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
	): Promise<ApiKeyResult> {
		try {
			console.log('[ConfigurationManager] Setting OpenAI API key');

			// Validate the API key format
			const validation = ValidationUtils.validateOpenAIApiKey(apiKey);
			if (!validation.isValid) {
				console.error(`[ConfigurationManager] Invalid API key format: ${validation.errorMessage}`);
				return {
					success: false,
					isValid: false,
					errorMessage: validation.errorMessage || 'Invalid API key format',
					context: validation.context || 'API key validation failed'
				};
			}

			// Update the configuration
			const updateSuccess = await this.updateConfiguration('openaiApiKey', apiKey, target);
			if (!updateSuccess) {
				const error = 'Failed to update API key in configuration';
				console.error(`[ConfigurationManager] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Configuration update failed'
				};
			}

			console.log('[ConfigurationManager] API key set successfully');
			return {
				success: true,
				isValid: true
			};

		} catch (error) {
			const errorMessage = `Failed to set API key: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ConfigurationManager] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: 'API key setting operation failed'
			};
		}
	}

	/**
	 * Clear the OpenAI API key from configuration
	 * @param target The configuration target
	 * @returns Promise<boolean> Whether the operation was successful
	 */
	public async clearApiKey(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<boolean> {
		try {
			console.log('[ConfigurationManager] Clearing OpenAI API key');
			return await this.updateConfiguration('openaiApiKey', '', target);

		} catch (error) {
			console.error('[ConfigurationManager] Error clearing API key:', error);
			return false;
		}
	}

	/**
	 * Validate the current configuration
	 * @returns Promise<ConfigValidationResult> The validation result
	 */
	public async validateConfiguration(): Promise<ConfigValidationResult> {
		try {
			console.log('[ConfigurationManager] Validating configuration');

			const config = this.getConfiguration();
			const invalidKeys: string[] = [];
			const errors: string[] = [];

			// Validate mode
			if (!['base', 'ai'].includes(config.mode)) {
				invalidKeys.push('mode');
				errors.push(`Invalid mode: ${config.mode} (expected: base or ai)`);
			}

			// Validate changelog path
			if (!config.changelogPath || config.changelogPath.trim() === '') {
				invalidKeys.push('changelogPath');
				errors.push('Changelog path cannot be empty');
			}

			// For AI mode, validate API key
			if (config.mode === 'ai') {
				const apiKey = await this.getApiKey();
				if (!apiKey || apiKey.trim() === '') {
					invalidKeys.push('openaiApiKey');
					errors.push('OpenAI API key is required for AI mode');
				} else {
					const apiKeyValidation = ValidationUtils.validateOpenAIApiKey(apiKey);
					if (!apiKeyValidation.isValid) {
						invalidKeys.push('openaiApiKey');
						errors.push(`Invalid API key format: ${apiKeyValidation.errorMessage}`);
					}
				}
			}

			const isValid = invalidKeys.length === 0;
			const result: ConfigValidationResult = {
				isValid,
				...(invalidKeys.length > 0 && { invalidKeys }),
				...(errors.length > 0 && { errorMessage: errors.join('; ') })
			};

			console.log(`[ConfigurationManager] Configuration validation ${isValid ? 'passed' : 'failed'}`);
			return result;

		} catch (error) {
			const errorMessage = `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ConfigurationManager] ${errorMessage}`, error);
			return {
				isValid: false,
				errorMessage,
				context: 'Validation process failed'
			};
		}
	}

	/**
	 * Check if AI mode is available (API key is configured)
	 * @returns Promise<boolean> Whether AI mode is available
	 */
	public async isAiModeAvailable(): Promise<boolean> {
		try {
			const apiKey = await this.getApiKey();
			if (!apiKey || apiKey.trim() === '') {
				return false;
			}

			const validation = ValidationUtils.validateOpenAIApiKey(apiKey);
			return validation.isValid;

		} catch (error) {
			console.error('[ConfigurationManager] Error checking AI mode availability:', error);
			return false;
		}
	}

	/**
	 * Switch to AI mode if API key is available
	 * @returns Promise<ApiKeyResult> The operation result
	 */
	public async enableAiMode(): Promise<ApiKeyResult> {
		try {
			console.log('[ConfigurationManager] Enabling AI mode');

			// Check if API key is available
			const isAvailable = await this.isAiModeAvailable();
			if (!isAvailable) {
				const error = 'Cannot enable AI mode: valid API key not found';
				console.error(`[ConfigurationManager] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'API key required for AI mode'
				};
			}

			// Switch to AI mode
			const updateSuccess = await this.updateConfiguration('mode', 'ai');
			if (!updateSuccess) {
				const error = 'Failed to update mode to AI';
				console.error(`[ConfigurationManager] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Configuration update failed'
				};
			}

			console.log('[ConfigurationManager] AI mode enabled successfully');
			return { success: true };

		} catch (error) {
			const errorMessage = `Failed to enable AI mode: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ConfigurationManager] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: 'AI mode enablement failed'
			};
		}
	}

	/**
	 * Switch to base mode
	 * @returns Promise<boolean> Whether the operation was successful
	 */
	public async enableBaseMode(): Promise<boolean> {
		try {
			console.log('[ConfigurationManager] Enabling base mode');
			return await this.updateConfiguration('mode', 'base');

		} catch (error) {
			console.error('[ConfigurationManager] Error enabling base mode:', error);
			return false;
		}
	}

	/**
	 * Get configuration summary for debugging
	 * @returns object Configuration summary (with redacted API key)
	 */
	public getConfigurationSummary(): object {
		try {
			const config = this.getConfiguration();
			return {
				mode: config.mode,
				changelogPath: config.changelogPath,
				autoGenerate: config.autoGenerate,
				hasApiKey: config.openaiApiKey.length > 0,
				apiKeyLength: config.openaiApiKey.length
			};

		} catch (error) {
			console.error('[ConfigurationManager] Error getting configuration summary:', error);
			return { error: 'Failed to get configuration summary' };
		}
	}

	/**
	 * Reset configuration to defaults
	 * @param target The configuration target
	 * @returns Promise<boolean> Whether the operation was successful
	 */
	public async resetConfiguration(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<boolean> {
		try {
			console.log('[ConfigurationManager] Resetting configuration to defaults');

			const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIGURATION_SECTION);
			
			// Reset each configuration value to its default
			await config.update('openaiApiKey', '', target);
			await config.update('mode', 'base', target);
			await config.update('changelogPath', 'CHANGELOG.md', target);
			await config.update('autoGenerate', false, target);

			console.log('[ConfigurationManager] Configuration reset successfully');
			return true;

		} catch (error) {
			console.error('[ConfigurationManager] Error resetting configuration:', error);
			return false;
		}
	}
} 