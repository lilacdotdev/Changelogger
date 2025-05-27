import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * File operation result interface
 */
export interface FileOperationResult {
	/** Whether the operation was successful */
	success: boolean;
	/** Error message if operation failed */
	errorMessage?: string;
	/** The file content (for read operations) */
	content?: string;
	/** Additional context for debugging */
	context?: string;
}

/**
 * Utility class for safe file operations with error handling
 */
export class FileUtils {
	
	/**
	 * Safely read a file with comprehensive error handling
	 * @param filePath The path to the file to read
	 * @param encoding The file encoding (default: utf8)
	 * @returns FileOperationResult with file content or error information
	 */
	public static async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<FileOperationResult> {
		try {
			console.log(`[FileUtils] Reading file: ${filePath}`);

			if (!filePath || filePath.trim() === '') {
				const error = 'File path is empty or undefined';
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Empty file path provided'
				};
			}

			const resolvedPath = path.resolve(filePath);
			console.log(`[FileUtils] Resolved path: ${resolvedPath}`);

			// Check if file exists
			if (!fs.existsSync(resolvedPath)) {
				const error = `File does not exist: ${resolvedPath}`;
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: `Original path: ${filePath}`
				};
			}

			// Check if it's a file (not a directory)
			const stats = fs.statSync(resolvedPath);
			if (!stats.isFile()) {
				const error = `Path is not a file: ${resolvedPath}`;
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: `Is directory: ${stats.isDirectory()}`
				};
			}

			// Check read permissions
			try {
				fs.accessSync(resolvedPath, fs.constants.R_OK);
			} catch (accessError) {
				const error = `No read access to file: ${resolvedPath}`;
				console.error(`[FileUtils] ${error}`, accessError);
				return {
					success: false,
					errorMessage: error,
					context: `Access error: ${accessError instanceof Error ? accessError.message : String(accessError)}`
				};
			}

			// Read the file
			const content = fs.readFileSync(resolvedPath, encoding);
			console.log(`[FileUtils] Successfully read file: ${resolvedPath} (${content.length} characters)`);

			return {
				success: true,
				content
			};

		} catch (error) {
			const errorMessage = `Failed to read file: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[FileUtils] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: `File path: ${filePath}`
			};
		}
	}

	/**
	 * Safely write content to a file with comprehensive error handling
	 * @param filePath The path to the file to write
	 * @param content The content to write
	 * @param encoding The file encoding (default: utf8)
	 * @param createDirectories Whether to create parent directories if they don't exist
	 * @returns FileOperationResult indicating success or failure
	 */
	public static async writeFile(
		filePath: string, 
		content: string, 
		encoding: BufferEncoding = 'utf8',
		createDirectories: boolean = true
	): Promise<FileOperationResult> {
		try {
			console.log(`[FileUtils] Writing file: ${filePath} (${content.length} characters)`);

			if (!filePath || filePath.trim() === '') {
				const error = 'File path is empty or undefined';
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Empty file path provided'
				};
			}

			const resolvedPath = path.resolve(filePath);
			console.log(`[FileUtils] Resolved path: ${resolvedPath}`);

			// Get directory path
			const dirPath = path.dirname(resolvedPath);

			// Create directories if needed and requested
			if (createDirectories && !fs.existsSync(dirPath)) {
				console.log(`[FileUtils] Creating directories: ${dirPath}`);
				try {
					fs.mkdirSync(dirPath, { recursive: true });
				} catch (mkdirError) {
					const error = `Failed to create directories: ${dirPath}`;
					console.error(`[FileUtils] ${error}`, mkdirError);
					return {
						success: false,
						errorMessage: error,
						context: `Mkdir error: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`
					};
				}
			}

			// Check directory exists
			if (!fs.existsSync(dirPath)) {
				const error = `Directory does not exist: ${dirPath}`;
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: `File path: ${filePath}`
				};
			}

			// Check write permissions on directory
			try {
				fs.accessSync(dirPath, fs.constants.W_OK);
			} catch (accessError) {
				const error = `No write access to directory: ${dirPath}`;
				console.error(`[FileUtils] ${error}`, accessError);
				return {
					success: false,
					errorMessage: error,
					context: `Access error: ${accessError instanceof Error ? accessError.message : String(accessError)}`
				};
			}

			// If file exists, check write permissions
			if (fs.existsSync(resolvedPath)) {
				try {
					fs.accessSync(resolvedPath, fs.constants.W_OK);
				} catch (accessError) {
					const error = `No write access to file: ${resolvedPath}`;
					console.error(`[FileUtils] ${error}`, accessError);
					return {
						success: false,
						errorMessage: error,
						context: `Access error: ${accessError instanceof Error ? accessError.message : String(accessError)}`
					};
				}
			}

			// Write the file
			fs.writeFileSync(resolvedPath, content, encoding);
			console.log(`[FileUtils] Successfully wrote file: ${resolvedPath}`);

			return { success: true };

		} catch (error) {
			const errorMessage = `Failed to write file: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[FileUtils] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: `File path: ${filePath}, Content length: ${content?.length || 0}`
			};
		}
	}

	/**
	 * Safely append content to a file with comprehensive error handling
	 * @param filePath The path to the file to append to
	 * @param content The content to append
	 * @param encoding The file encoding (default: utf8)
	 * @param createIfNotExists Whether to create the file if it doesn't exist
	 * @returns FileOperationResult indicating success or failure
	 */
	public static async appendFile(
		filePath: string, 
		content: string, 
		encoding: BufferEncoding = 'utf8',
		createIfNotExists: boolean = true
	): Promise<FileOperationResult> {
		try {
			console.log(`[FileUtils] Appending to file: ${filePath} (${content.length} characters)`);

			if (!filePath || filePath.trim() === '') {
				const error = 'File path is empty or undefined';
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Empty file path provided'
				};
			}

			const resolvedPath = path.resolve(filePath);
			console.log(`[FileUtils] Resolved path: ${resolvedPath}`);

			// If file doesn't exist and we should create it, use writeFile
			if (!fs.existsSync(resolvedPath) && createIfNotExists) {
				console.log(`[FileUtils] File doesn't exist, creating: ${resolvedPath}`);
				return await this.writeFile(resolvedPath, content, encoding, true);
			}

			// Check if file exists
			if (!fs.existsSync(resolvedPath)) {
				const error = `File does not exist: ${resolvedPath}`;
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'File does not exist and createIfNotExists is false'
				};
			}

			// Check write permissions
			try {
				fs.accessSync(resolvedPath, fs.constants.W_OK);
			} catch (accessError) {
				const error = `No write access to file: ${resolvedPath}`;
				console.error(`[FileUtils] ${error}`, accessError);
				return {
					success: false,
					errorMessage: error,
					context: `Access error: ${accessError instanceof Error ? accessError.message : String(accessError)}`
				};
			}

			// Append to the file
			fs.appendFileSync(resolvedPath, content, encoding);
			console.log(`[FileUtils] Successfully appended to file: ${resolvedPath}`);

			return { success: true };

		} catch (error) {
			const errorMessage = `Failed to append to file: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[FileUtils] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: `File path: ${filePath}, Content length: ${content?.length || 0}`
			};
		}
	}

	/**
	 * Check if a file exists and is accessible
	 * @param filePath The path to check
	 * @returns boolean indicating if file exists and is accessible
	 */
	public static fileExists(filePath: string): boolean {
		try {
			if (!filePath || filePath.trim() === '') {
				console.error('[FileUtils] File path is empty for existence check');
				return false;
			}

			const resolvedPath = path.resolve(filePath);
			const exists = fs.existsSync(resolvedPath);
			
			if (exists) {
				const stats = fs.statSync(resolvedPath);
				const isFile = stats.isFile();
				console.log(`[FileUtils] File exists check: ${resolvedPath} - exists: ${exists}, isFile: ${isFile}`);
				return isFile;
			}

			console.log(`[FileUtils] File exists check: ${resolvedPath} - does not exist`);
			return false;

		} catch (error) {
			console.error(`[FileUtils] Error checking file existence for ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Get file size in bytes
	 * @param filePath The path to the file
	 * @returns number of bytes or -1 if error
	 */
	public static getFileSize(filePath: string): number {
		try {
			if (!this.fileExists(filePath)) {
				return -1;
			}

			const resolvedPath = path.resolve(filePath);
			const stats = fs.statSync(resolvedPath);
			const size = stats.size;
			
			console.log(`[FileUtils] File size: ${resolvedPath} - ${size} bytes`);
			return size;

		} catch (error) {
			console.error(`[FileUtils] Error getting file size for ${filePath}:`, error);
			return -1;
		}
	}

	/**
	 * Create a backup of a file before modifying it
	 * @param filePath The path to the file to backup
	 * @param backupSuffix The suffix to add to the backup file (default: .backup)
	 * @returns FileOperationResult indicating success or failure
	 */
	public static async createBackup(filePath: string, backupSuffix: string = '.backup'): Promise<FileOperationResult> {
		try {
			console.log(`[FileUtils] Creating backup of: ${filePath}`);

			if (!this.fileExists(filePath)) {
				const error = `Cannot backup file that does not exist: ${filePath}`;
				console.error(`[FileUtils] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'File does not exist'
				};
			}

			const readResult = await this.readFile(filePath);
			if (!readResult.success || !readResult.content) {
				console.error(`[FileUtils] Failed to read file for backup: ${filePath}`);
				return {
					success: false,
					errorMessage: 'Failed to read original file',
					context: readResult.errorMessage || 'Unknown error reading file'
				};
			}

			const backupPath = filePath + backupSuffix;
			const writeResult = await this.writeFile(backupPath, readResult.content);
			
			if (writeResult.success) {
				console.log(`[FileUtils] Successfully created backup: ${backupPath}`);
			}

			return writeResult;

		} catch (error) {
			const errorMessage = `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[FileUtils] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: `Original file: ${filePath}`
			};
		}
	}

	/**
	 * Show file operation error to user
	 * @param result The file operation result
	 * @param operation The operation that failed (for context)
	 */
	public static showFileError(result: FileOperationResult, operation: string): void {
		if (result.success) {
			return; // No error to show
		}

		const errorMessage = `Changelogger: ${operation} failed - ${result.errorMessage}`;
		console.error(`[FileUtils] Showing file error: ${errorMessage}`);
		
		if (result.context) {
			console.error(`[FileUtils] Error context: ${result.context}`);
		}

		vscode.window.showErrorMessage(errorMessage);
	}
} 