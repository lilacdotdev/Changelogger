import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Validation result interface
 */
export interface ValidationResult {
	/** Whether the validation passed */
	isValid: boolean;
	/** Error message if validation failed */
	errorMessage?: string;
	/** Additional context for the error */
	context?: string;
}

/**
 * Utility class for input validation and data validation
 */
export class ValidationUtils {
	
	/**
	 * Validate that a workspace folder exists and is accessible
	 * @param workspacePath The path to validate
	 * @returns ValidationResult indicating if the path is valid
	 */
	public static validateWorkspacePath(workspacePath: string): ValidationResult {
		try {
			console.log(`[ValidationUtils] Validating workspace path: ${workspacePath}`);

			if (!workspacePath || workspacePath.trim() === '') {
				const error = 'Workspace path is empty or undefined';
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: 'Empty workspace path provided'
				};
			}

			// Resolve the path to handle relative paths
			const resolvedPath = path.resolve(workspacePath);
			console.log(`[ValidationUtils] Resolved path: ${resolvedPath}`);

			// Check if path exists
			if (!fs.existsSync(resolvedPath)) {
				const error = `Workspace path does not exist: ${resolvedPath}`;
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: `Original path: ${workspacePath}`
				};
			}

			// Check if it's a directory
			const stats = fs.statSync(resolvedPath);
			if (!stats.isDirectory()) {
				const error = `Path is not a directory: ${resolvedPath}`;
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: `File type: ${stats.isFile() ? 'file' : 'unknown'}`
				};
			}

			// Check read permissions
			try {
				fs.accessSync(resolvedPath, fs.constants.R_OK);
			} catch (accessError) {
				const error = `No read access to workspace path: ${resolvedPath}`;
				console.error(`[ValidationUtils] ${error}`, accessError);
				return {
					isValid: false,
					errorMessage: error,
					context: `Access error: ${accessError instanceof Error ? accessError.message : String(accessError)}`
				};
			}

			console.log(`[ValidationUtils] Workspace path validation successful: ${resolvedPath}`);
			return { isValid: true };

		} catch (error) {
			const errorMessage = `Failed to validate workspace path: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ValidationUtils] ${errorMessage}`, error);
			return {
				isValid: false,
				errorMessage,
				context: `Original path: ${workspacePath}`
			};
		}
	}

	/**
	 * Validate OpenAI API key format
	 * @param apiKey The API key to validate
	 * @returns ValidationResult indicating if the API key format is valid
	 */
	public static validateOpenAIApiKey(apiKey: string): ValidationResult {
		try {
			console.log('[ValidationUtils] Validating OpenAI API key format');

			if (!apiKey || apiKey.trim() === '') {
				const error = 'API key is empty or undefined';
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: 'Empty API key provided'
				};
			}

			const trimmedKey = apiKey.trim();

			// Check if it starts with sk-
			if (!trimmedKey.startsWith('sk-')) {
				const error = 'OpenAI API key must start with "sk-"';
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: `Key starts with: ${trimmedKey.substring(0, 5)}...`
				};
			}

			// Check minimum length (OpenAI keys: old format ~48-50 chars, new format ~164 chars)
			if (trimmedKey.length < 40) {
				const error = 'OpenAI API key appears to be too short';
				console.error(`[ValidationUtils] ${error} (length: ${trimmedKey.length})`);
				return {
					isValid: false,
					errorMessage: error,
					context: `Key length: ${trimmedKey.length}, expected: 40+ characters`
				};
			}

			// Check maximum reasonable length (supports both old and new formats)
			if (trimmedKey.length > 200) {
				const error = 'OpenAI API key appears to be too long';
				console.error(`[ValidationUtils] ${error} (length: ${trimmedKey.length})`);
				return {
					isValid: false,
					errorMessage: error,
					context: `Key length: ${trimmedKey.length}, expected: less than 200 characters`
				};
			}

			// Check for valid characters (alphanumeric and some special characters)
			const validKeyPattern = /^sk-[A-Za-z0-9\-_]+$/;
			if (!validKeyPattern.test(trimmedKey)) {
				const error = 'OpenAI API key contains invalid characters';
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: 'Key should contain only letters, numbers, hyphens, and underscores'
				};
			}

			console.log('[ValidationUtils] OpenAI API key format validation successful');
			return { isValid: true };

		} catch (error) {
			const errorMessage = `Failed to validate API key: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ValidationUtils] ${errorMessage}`, error);
			return {
				isValid: false,
				errorMessage,
				context: 'Validation process failed'
			};
		}
	}

	/**
	 * Validate file path for changelog file
	 * @param filePath The file path to validate
	 * @param workspaceRoot The workspace root for relative path validation
	 * @returns ValidationResult indicating if the file path is valid
	 */
	public static validateChangelogPath(filePath: string, workspaceRoot: string): ValidationResult {
		try {
			console.log(`[ValidationUtils] Validating changelog path: ${filePath} in workspace: ${workspaceRoot}`);

			if (!filePath || filePath.trim() === '') {
				const error = 'Changelog file path is empty or undefined';
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: 'Empty file path provided'
				};
			}

			const trimmedPath = filePath.trim();

			// Check for invalid characters
			const invalidChars = /[<>:"|?*]/;
			if (invalidChars.test(trimmedPath)) {
				const error = 'Changelog path contains invalid characters';
				console.error(`[ValidationUtils] ${error}: ${trimmedPath}`);
				return {
					isValid: false,
					errorMessage: error,
					context: `Invalid characters found in: ${trimmedPath}`
				};
			}

			// Resolve the full path
			const fullPath = path.isAbsolute(trimmedPath) 
				? trimmedPath 
				: path.join(workspaceRoot, trimmedPath);

			console.log(`[ValidationUtils] Resolved changelog path: ${fullPath}`);

			// Check if the directory exists (file doesn't need to exist yet)
			const dirPath = path.dirname(fullPath);
			if (!fs.existsSync(dirPath)) {
				const error = `Directory for changelog file does not exist: ${dirPath}`;
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: `File path: ${trimmedPath}, Directory: ${dirPath}`
				};
			}

			// Check write permissions on the directory
			try {
				fs.accessSync(dirPath, fs.constants.W_OK);
			} catch (accessError) {
				const error = `No write access to changelog directory: ${dirPath}`;
				console.error(`[ValidationUtils] ${error}`, accessError);
				return {
					isValid: false,
					errorMessage: error,
					context: `Access error: ${accessError instanceof Error ? accessError.message : String(accessError)}`
				};
			}

			console.log(`[ValidationUtils] Changelog path validation successful: ${fullPath}`);
			return { isValid: true };

		} catch (error) {
			const errorMessage = `Failed to validate changelog path: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ValidationUtils] ${errorMessage}`, error);
			return {
				isValid: false,
				errorMessage,
				context: `File path: ${filePath}, Workspace: ${workspaceRoot}`
			};
		}
	}

	/**
	 * Show validation error to user with detailed information
	 * @param result The validation result to display
	 * @param action The action that failed (for context)
	 */
	public static showValidationError(result: ValidationResult, action: string): void {
		if (result.isValid) {
			return; // No error to show
		}

		const errorMessage = `Changelogger: ${action} failed - ${result.errorMessage}`;
		console.error(`[ValidationUtils] Showing validation error: ${errorMessage}`);
		
		if (result.context) {
			console.error(`[ValidationUtils] Error context: ${result.context}`);
		}

		vscode.window.showErrorMessage(errorMessage);
	}

	/**
	 * Validate that VS Code workspace is properly set up
	 * @returns ValidationResult indicating if workspace is ready
	 */
	public static validateVSCodeWorkspace(): ValidationResult {
		try {
			console.log('[ValidationUtils] Validating VS Code workspace setup');

			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				const error = 'No workspace folders found in VS Code';
				console.error(`[ValidationUtils] ${error}`);
				return {
					isValid: false,
					errorMessage: error,
					context: 'Please open a folder or workspace in VS Code'
				};
			}

			console.log(`[ValidationUtils] Found ${workspaceFolders.length} workspace folders`);
			
			// Validate each workspace folder
			for (let i = 0; i < workspaceFolders.length; i++) {
				const folder = workspaceFolders[i];
				const pathValidation = this.validateWorkspacePath(folder.uri.fsPath);
				
				if (!pathValidation.isValid) {
					const error = `Workspace folder ${i + 1} is invalid`;
					console.error(`[ValidationUtils] ${error}: ${folder.uri.fsPath}`);
					return {
						isValid: false,
						errorMessage: error,
						context: `${pathValidation.errorMessage} (${folder.uri.fsPath})`
					};
				}
			}

			console.log('[ValidationUtils] VS Code workspace validation successful');
			return { isValid: true };

		} catch (error) {
			const errorMessage = `Failed to validate VS Code workspace: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ValidationUtils] ${errorMessage}`, error);
			return {
				isValid: false,
				errorMessage,
				context: 'Workspace validation process failed'
			};
		}
	}
} 