import * as vscode from 'vscode';
import * as path from 'path';
import { CommitInfo, FileChange } from '../git/gitDataExtractor';
import { FileUtils, FileOperationResult } from '../utils/fileUtils';
import { ValidationUtils } from '../utils/validation';

/**
 * Interface for changelog generation options
 */
export interface ChangelogOptions {
	/** The mode to use: base or ai */
	mode: 'base' | 'ai';
	/** The path to the changelog file */
	changelogPath: string;
	/** The workspace root path */
	workspaceRoot: string;
	/** Whether to create a backup before modifying */
	createBackup: boolean;
}

/**
 * Interface for changelog generation result
 */
export interface ChangelogResult {
	/** Whether the generation was successful */
	success: boolean;
	/** Error message if generation failed */
	errorMessage?: string;
	/** The generated changelog entry */
	changelogEntry?: string;
	/** Additional context for debugging */
	context?: string;
	/** Statistics about the generation */
	stats?: {
		totalFiles: number;
		addedFiles: number;
		deletedFiles: number;
		modifiedFiles: number;
		aiProcessedFiles?: number;
	};
}

/**
 * Service class for generating changelog entries
 */
export class ChangelogGenerator {
	private static readonly CHANGELOG_SEPARATOR = '\n---\n';
	private static readonly DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'short'
	};

	/**
	 * Generate a changelog entry from commit information
	 * @param commitInfo The commit information to process
	 * @param options The changelog generation options
	 * @returns Promise<ChangelogResult> The generation result
	 */
	public static async generateChangelogEntry(
		commitInfo: CommitInfo,
		options: ChangelogOptions
	): Promise<ChangelogResult> {
		try {
			console.log(`[ChangelogGenerator] Generating changelog entry for commit: ${commitInfo.hash}`);
			console.log(`[ChangelogGenerator] Mode: ${options.mode}, Path: ${options.changelogPath}`);

			// Validate options
			const validationResult = this.validateOptions(options);
			if (!validationResult.isValid) {
				console.error(`[ChangelogGenerator] Options validation failed: ${validationResult.errorMessage}`);
				return {
					success: false,
					...(validationResult.errorMessage && { errorMessage: validationResult.errorMessage }),
					...(validationResult.context && { context: validationResult.context })
				};
			}

			// Generate the changelog entry content
			const changelogEntry = this.formatChangelogEntry(commitInfo, options.mode);
			console.log(`[ChangelogGenerator] Generated changelog entry (${changelogEntry.length} characters)`);

			// Write to changelog file
			const writeResult = await this.writeToChangelog(changelogEntry, options);
			if (!writeResult.success) {
				console.error(`[ChangelogGenerator] Failed to write changelog: ${writeResult.errorMessage}`);
				return {
					success: false,
					...(writeResult.errorMessage && { errorMessage: writeResult.errorMessage }),
					...(writeResult.context && { context: writeResult.context })
				};
			}

			// Generate statistics
			const stats = {
				totalFiles: commitInfo.fileChanges.length,
				addedFiles: commitInfo.fileChanges.filter(f => f.changeType === 'added').length,
				deletedFiles: commitInfo.fileChanges.filter(f => f.changeType === 'deleted').length,
				modifiedFiles: commitInfo.fileChanges.filter(f => f.changeType === 'modified').length,
				...(options.mode === 'ai' && {
					aiProcessedFiles: commitInfo.fileChanges.filter(f => f.includeInAI).length
				})
			};

			console.log(`[ChangelogGenerator] Successfully generated changelog entry`);
			return {
				success: true,
				changelogEntry,
				stats
			};

		} catch (error) {
			const errorMessage = `Failed to generate changelog entry: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ChangelogGenerator] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: `Commit: ${commitInfo.hash}, Mode: ${options.mode}`
			};
		}
	}

	/**
	 * Format commit information into a changelog entry
	 * @param commitInfo The commit information
	 * @param mode The generation mode (base or ai)
	 * @returns string The formatted changelog entry
	 */
	private static formatChangelogEntry(commitInfo: CommitInfo, mode: 'base' | 'ai'): string {
		try {
			console.log(`[ChangelogGenerator] Formatting changelog entry in ${mode} mode`);

			const lines: string[] = [];

			// Header with commit information
			lines.push(`## Commit: ${commitInfo.message}`);
			lines.push(`**Author:** ${commitInfo.author} <${commitInfo.email}>`);
			lines.push(`**Date:** ${commitInfo.date.toLocaleString('en-US', this.DATE_FORMAT_OPTIONS)}`);
			lines.push(`**Hash:** \`${commitInfo.hash.substring(0, 8)}\``);
			lines.push('');

			// File structure changes
			lines.push('### File Changes:');
			if (commitInfo.fileChanges.length === 0) {
				lines.push('- No file changes detected');
			} else {
				// Group changes by type for better readability
				const addedFiles = commitInfo.fileChanges.filter(f => f.changeType === 'added');
				const deletedFiles = commitInfo.fileChanges.filter(f => f.changeType === 'deleted');
				const modifiedFiles = commitInfo.fileChanges.filter(f => f.changeType === 'modified');

				if (addedFiles.length > 0) {
					lines.push('**Added:**');
					addedFiles.forEach(file => {
						lines.push(`- ${file.changeSymbol} ${file.filePath}`);
					});
					lines.push('');
				}

				if (modifiedFiles.length > 0) {
					lines.push('**Modified:**');
					modifiedFiles.forEach(file => {
						lines.push(`- ${file.changeSymbol} ${file.filePath}`);
					});
					lines.push('');
				}

				if (deletedFiles.length > 0) {
					lines.push('**Deleted:**');
					deletedFiles.forEach(file => {
						lines.push(`- ${file.changeSymbol} ${file.filePath}`);
					});
					lines.push('');
				}
			}

			// AI-powered summary section (placeholder for future implementation)
			if (mode === 'ai') {
				lines.push('### AI Summary:');
				const aiProcessedFiles = commitInfo.fileChanges.filter(f => f.includeInAI);
				if (aiProcessedFiles.length > 0) {
					lines.push('*AI-powered summary will be generated here in a future update.*');
					lines.push(`*Files processed for AI analysis: ${aiProcessedFiles.length}*`);
				} else {
					lines.push('*No files were processed for AI analysis (all files filtered or too large).*');
				}
				lines.push('');
			}

			// Statistics
			lines.push('### Statistics:');
			lines.push(`- Total files changed: ${commitInfo.fileChanges.length}`);
			
			const addedCount = commitInfo.fileChanges.filter(f => f.changeType === 'added').length;
			const modifiedCount = commitInfo.fileChanges.filter(f => f.changeType === 'modified').length;
			const deletedCount = commitInfo.fileChanges.filter(f => f.changeType === 'deleted').length;
			
			lines.push(`- Added: ${addedCount}, Modified: ${modifiedCount}, Deleted: ${deletedCount}`);
			
			if (mode === 'ai') {
				const aiFiles = commitInfo.fileChanges.filter(f => f.includeInAI);
				lines.push(`- Files processed for AI: ${aiFiles.length}`);
			}

			const result = lines.join('\n');
			console.log(`[ChangelogGenerator] Formatted changelog entry: ${result.length} characters`);
			return result;

		} catch (error) {
			console.error('[ChangelogGenerator] Error formatting changelog entry:', error);
			throw error;
		}
	}

	/**
	 * Write changelog entry to the changelog file
	 * @param changelogEntry The changelog entry to write
	 * @param options The changelog options
	 * @returns Promise<FileOperationResult> The write operation result
	 */
	private static async writeToChangelog(
		changelogEntry: string,
		options: ChangelogOptions
	): Promise<FileOperationResult> {
		try {
			console.log(`[ChangelogGenerator] Writing changelog to: ${options.changelogPath}`);

			const fullPath = path.isAbsolute(options.changelogPath)
				? options.changelogPath
				: path.join(options.workspaceRoot, options.changelogPath);

			console.log(`[ChangelogGenerator] Full changelog path: ${fullPath}`);

			// Create backup if requested and file exists
			if (options.createBackup && FileUtils.fileExists(fullPath)) {
				console.log('[ChangelogGenerator] Creating backup of existing changelog');
				const backupResult = await FileUtils.createBackup(fullPath);
				if (!backupResult.success) {
					console.warn(`[ChangelogGenerator] Backup creation failed: ${backupResult.errorMessage}`);
					// Continue anyway, don't fail the entire operation
				}
			}

			// Prepare the content to append
			const timestamp = new Date().toISOString();
			const entryWithSeparator = `\n${changelogEntry}\n${this.CHANGELOG_SEPARATOR}\n`;

			// Check if changelog file exists
			if (FileUtils.fileExists(fullPath)) {
				console.log('[ChangelogGenerator] Appending to existing changelog');
				return await FileUtils.appendFile(fullPath, entryWithSeparator);
			} else {
				console.log('[ChangelogGenerator] Creating new changelog file');
				const header = `# Changelog\n\nGenerated by Changelogger VS Code Extension\n${this.CHANGELOG_SEPARATOR}\n`;
				const initialContent = header + changelogEntry + `\n${this.CHANGELOG_SEPARATOR}\n`;
				return await FileUtils.writeFile(fullPath, initialContent);
			}

		} catch (error) {
			const errorMessage = `Failed to write changelog: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ChangelogGenerator] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: `Path: ${options.changelogPath}`
			};
		}
	}

	/**
	 * Validate changelog generation options
	 * @param options The options to validate
	 * @returns ValidationResult The validation result
	 */
	private static validateOptions(options: ChangelogOptions): {isValid: boolean, errorMessage?: string, context?: string} {
		try {
			console.log('[ChangelogGenerator] Validating changelog options');

			// Validate mode
			if (!options.mode || !['base', 'ai'].includes(options.mode)) {
				return {
					isValid: false,
					errorMessage: 'Invalid mode specified',
					context: `Mode: ${options.mode}, expected: base or ai`
				};
			}

			// Validate changelog path
			const pathValidation = ValidationUtils.validateChangelogPath(options.changelogPath, options.workspaceRoot);
			if (!pathValidation.isValid) {
				return {
					isValid: false,
					errorMessage: pathValidation.errorMessage,
					context: pathValidation.context
				};
			}

			// Validate workspace root
			const workspaceValidation = ValidationUtils.validateWorkspacePath(options.workspaceRoot);
			if (!workspaceValidation.isValid) {
				return {
					isValid: false,
					errorMessage: workspaceValidation.errorMessage,
					context: workspaceValidation.context
				};
			}

			console.log('[ChangelogGenerator] Options validation successful');
			return { isValid: true };

		} catch (error) {
			const errorMessage = `Options validation failed: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[ChangelogGenerator] ${errorMessage}`, error);
			return {
				isValid: false,
				errorMessage,
				context: 'Validation process failed'
			};
		}
	}

	/**
	 * Get the current changelog mode from VS Code configuration
	 * @returns string The current mode (base or ai)
	 */
	public static getCurrentMode(): 'base' | 'ai' {
		try {
			const config = vscode.workspace.getConfiguration('changelogger');
			const mode = config.get<string>('mode', 'base');
			
			if (mode === 'ai' || mode === 'base') {
				console.log(`[ChangelogGenerator] Current mode: ${mode}`);
				return mode;
			}

			console.warn(`[ChangelogGenerator] Invalid mode in config: ${mode}, defaulting to base`);
			return 'base';

		} catch (error) {
			console.error('[ChangelogGenerator] Error getting current mode:', error);
			return 'base';
		}
	}

	/**
	 * Get the current changelog path from VS Code configuration
	 * @returns string The current changelog path
	 */
	public static getCurrentChangelogPath(): string {
		try {
			const config = vscode.workspace.getConfiguration('changelogger');
			const path = config.get<string>('changelogPath', 'CHANGELOG.md');
			console.log(`[ChangelogGenerator] Current changelog path: ${path}`);
			return path;

		} catch (error) {
			console.error('[ChangelogGenerator] Error getting changelog path:', error);
			return 'CHANGELOG.md';
		}
	}

	/**
	 * Preview a changelog entry without writing to file
	 * @param commitInfo The commit information
	 * @param mode The generation mode
	 * @returns string The formatted changelog entry
	 */
	public static previewChangelogEntry(commitInfo: CommitInfo, mode: 'base' | 'ai'): string {
		try {
			console.log(`[ChangelogGenerator] Generating preview for commit: ${commitInfo.hash}`);
			return this.formatChangelogEntry(commitInfo, mode);

		} catch (error) {
			console.error('[ChangelogGenerator] Error generating preview:', error);
			return `Error generating preview: ${error instanceof Error ? error.message : String(error)}`;
		}
	}
} 