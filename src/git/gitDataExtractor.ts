import { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface for file change information
 */
export interface FileChange {
	/** The file path relative to repository root */
	filePath: string;
	/** The type of change: added, deleted, modified */
	changeType: 'added' | 'deleted' | 'modified';
	/** The symbol to display in changelog (+, -, *) */
	changeSymbol: '+' | '-' | '*';
	/** The diff content for this file (for AI processing) */
	diffContent?: string;
	/** Whether this file should be sent to AI (after filtering) */
	includeInAI: boolean;
	/** File size in bytes */
	fileSize?: number;
}

/**
 * Interface for commit information
 */
export interface CommitInfo {
	/** The commit hash */
	hash: string;
	/** The commit message */
	message: string;
	/** The author name */
	author: string;
	/** The author email */
	email: string;
	/** The commit date */
	date: Date;
	/** Array of file changes in this commit */
	fileChanges: FileChange[];
}

/**
 * Interface for git data extraction result
 */
export interface GitDataResult {
	/** Whether the extraction was successful */
	success: boolean;
	/** Error message if extraction failed */
	errorMessage?: string;
	/** The extracted commit information */
	commitInfo?: CommitInfo;
	/** Additional context for debugging */
	context?: string;
}

/**
 * Service class for extracting git data and analyzing changes
 */
export class GitDataExtractor {
	private static readonly MAX_DIFF_SIZE = 50000; // 50KB limit for AI processing
	private static readonly CLOGIGNORE_FILE = '.clogignore';

	/**
	 * Extract data from the most recent commit
	 * @param git The simple-git instance
	 * @param repoPath The repository root path
	 * @param includeAIData Whether to extract diff data for AI processing
	 * @returns Promise<GitDataResult> The extraction result
	 */
	public static async extractLatestCommit(
		git: SimpleGit, 
		repoPath: string, 
		includeAIData: boolean = false
	): Promise<GitDataResult> {
		try {
			console.log(`[GitDataExtractor] Extracting latest commit data from: ${repoPath}`);
			console.log(`[GitDataExtractor] Include AI data: ${includeAIData}`);

			// Get the latest commit
			const log = await git.log({ maxCount: 1 });
			if (!log.latest) {
				const error = 'No commits found in repository';
				console.error(`[GitDataExtractor] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Repository has no commit history'
				};
			}

			const latestCommit = log.latest;
			console.log(`[GitDataExtractor] Latest commit: ${latestCommit.hash} - ${latestCommit.message}`);

			// Get file changes for this commit
			const fileChanges = await this.extractFileChanges(git, latestCommit.hash, repoPath, includeAIData);

			// Create commit info object
			const commitInfo: CommitInfo = {
				hash: latestCommit.hash,
				message: latestCommit.message,
				author: latestCommit.author_name,
				email: latestCommit.author_email,
				date: new Date(latestCommit.date),
				fileChanges
			};

			console.log(`[GitDataExtractor] Successfully extracted commit data: ${fileChanges.length} file changes`);

			return {
				success: true,
				commitInfo
			};

		} catch (error) {
			const errorMessage = `Failed to extract latest commit: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[GitDataExtractor] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: `Repository: ${repoPath}`
			};
		}
	}

	/**
	 * Extract file changes for a specific commit
	 * @param git The simple-git instance
	 * @param commitHash The commit hash to analyze
	 * @param repoPath The repository root path
	 * @param includeAIData Whether to extract diff content for AI processing
	 * @returns Promise<FileChange[]> Array of file changes
	 */
	private static async extractFileChanges(
		git: SimpleGit, 
		commitHash: string, 
		repoPath: string, 
		includeAIData: boolean
	): Promise<FileChange[]> {
		try {
			console.log(`[GitDataExtractor] Extracting file changes for commit: ${commitHash}`);

			// Get the diff summary for this commit
			const diffSummary = await git.diffSummary([`${commitHash}~1`, commitHash]);
			console.log(`[GitDataExtractor] Found ${diffSummary.files.length} changed files`);

			// Load ignore patterns
			const ignorePatterns = includeAIData ? await this.loadClogIgnorePatterns(repoPath) : [];
			console.log(`[GitDataExtractor] Loaded ${ignorePatterns.length} .clogignore patterns`);

			const fileChanges: FileChange[] = [];

			for (const file of diffSummary.files) {
				try {
					console.log(`[GitDataExtractor] Processing file: ${file.file}`);

					// Determine change type and symbol
					let changeType: 'added' | 'deleted' | 'modified';
					let changeSymbol: '+' | '-' | '*';

					// Check if this is a text file with insertion/deletion data
					if ('insertions' in file && 'deletions' in file) {
						if (file.insertions > 0 && file.deletions === 0) {
							changeType = 'added';
							changeSymbol = '+';
						} else if (file.insertions === 0 && file.deletions > 0) {
							changeType = 'deleted';
							changeSymbol = '-';
						} else {
							changeType = 'modified';
							changeSymbol = '*';
						}
					} else {
						// For binary files or files without insertion/deletion data, assume modified
						changeType = 'modified';
						changeSymbol = '*';
					}

					// Check if file should be included in AI processing
					const includeInAI = includeAIData && 
						changeType !== 'deleted' && 
						!this.isFileIgnored(file.file, ignorePatterns);

					let diffContent: string | undefined;
					let fileSize: number | undefined;

					// Extract diff content if needed for AI processing
					if (includeInAI) {
						const diffResult = await this.extractFileDiff(git, commitHash, file.file);
						if (diffResult.success && diffResult.content) {
							diffContent = diffResult.content;
							fileSize = diffResult.content.length;

							// Check size limit
							if (fileSize > this.MAX_DIFF_SIZE) {
								console.warn(`[GitDataExtractor] File ${file.file} diff too large (${fileSize} bytes), excluding from AI`);
								diffContent = undefined;
								fileSize = undefined;
							}
						}
					}

					const fileChange: FileChange = {
						filePath: file.file,
						changeType,
						changeSymbol,
						includeInAI: includeInAI && diffContent !== undefined,
						...(diffContent !== undefined && { diffContent }),
						...(fileSize !== undefined && { fileSize })
					};

					fileChanges.push(fileChange);
					console.log(`[GitDataExtractor] Added file change: ${file.file} (${changeSymbol}) - AI: ${fileChange.includeInAI}`);

				} catch (fileError) {
					console.error(`[GitDataExtractor] Error processing file ${file.file}:`, fileError);
					// Continue with other files
				}
			}

			console.log(`[GitDataExtractor] Successfully processed ${fileChanges.length} file changes`);
			return fileChanges;

		} catch (error) {
			console.error(`[GitDataExtractor] Error extracting file changes for commit ${commitHash}:`, error);
			throw error;
		}
	}

	/**
	 * Extract diff content for a specific file
	 * @param git The simple-git instance
	 * @param commitHash The commit hash
	 * @param filePath The file path
	 * @returns Promise<{success: boolean, content?: string, error?: string}> The diff extraction result
	 */
	private static async extractFileDiff(
		git: SimpleGit, 
		commitHash: string, 
		filePath: string
	): Promise<{success: boolean, content?: string, error?: string}> {
		try {
			console.log(`[GitDataExtractor] Extracting diff for file: ${filePath}`);

			// Get the diff for this specific file with context
			const diff = await git.diff([`${commitHash}~1`, commitHash, '--', filePath]);
			
			if (!diff || diff.trim() === '') {
				console.warn(`[GitDataExtractor] No diff content found for file: ${filePath}`);
				return {
					success: false,
					error: 'No diff content found'
				};
			}

			// Filter to only include changed lines with context
			const filteredDiff = this.filterDiffToChangedLines(diff);
			
			console.log(`[GitDataExtractor] Successfully extracted diff for ${filePath} (${filteredDiff.length} characters)`);
			return {
				success: true,
				content: filteredDiff
			};

		} catch (error) {
			const errorMessage = `Failed to extract diff for ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[GitDataExtractor] ${errorMessage}`, error);
			return {
				success: false,
				error: errorMessage
			};
		}
	}

	/**
	 * Filter diff content to only include changed lines with context
	 * @param diff The full diff content
	 * @returns string The filtered diff content
	 */
	private static filterDiffToChangedLines(diff: string): string {
		try {
			const lines = diff.split('\n');
			const filteredLines: string[] = [];
			let inHunk = false;

			for (const line of lines) {
				// Keep file headers
				if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('+++') || line.startsWith('---')) {
					filteredLines.push(line);
					continue;
				}

				// Hunk headers (@@)
				if (line.startsWith('@@')) {
					filteredLines.push(line);
					inHunk = true;
					continue;
				}

				// If we're in a hunk, include changed lines and context
				if (inHunk) {
					// Include added lines (+), removed lines (-), and context lines ( )
					if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
						filteredLines.push(line);
					}
				}
			}

			const result = filteredLines.join('\n');
			console.log(`[GitDataExtractor] Filtered diff from ${lines.length} to ${filteredLines.length} lines`);
			return result;

		} catch (error) {
			console.error('[GitDataExtractor] Error filtering diff content:', error);
			return diff; // Return original diff if filtering fails
		}
	}

	/**
	 * Load .clogignore patterns from the repository
	 * @param repoPath The repository root path
	 * @returns Promise<string[]> Array of ignore patterns
	 */
	private static async loadClogIgnorePatterns(repoPath: string): Promise<string[]> {
		try {
			const clogignorePath = path.join(repoPath, this.CLOGIGNORE_FILE);
			console.log(`[GitDataExtractor] Looking for .clogignore at: ${clogignorePath}`);

			if (!fs.existsSync(clogignorePath)) {
				console.log('[GitDataExtractor] No .clogignore file found, using default patterns');
				return this.getDefaultIgnorePatterns();
			}

			const content = fs.readFileSync(clogignorePath, 'utf8');
			const patterns = content
				.split('\n')
				.map(line => line.trim())
				.filter(line => line && !line.startsWith('#')) // Remove empty lines and comments
				.filter(line => line.length > 0);

			console.log(`[GitDataExtractor] Loaded ${patterns.length} patterns from .clogignore`);
			return patterns;

		} catch (error) {
			console.error('[GitDataExtractor] Error loading .clogignore patterns:', error);
			return this.getDefaultIgnorePatterns();
		}
	}

	/**
	 * Get default ignore patterns when .clogignore is not found
	 * @returns string[] Default ignore patterns
	 */
	private static getDefaultIgnorePatterns(): string[] {
		return [
			'*.log',
			'*.tmp',
			'*.temp',
			'node_modules/**',
			'.git/**',
			'dist/**',
			'build/**',
			'*.min.js',
			'*.min.css',
			'package-lock.json',
			'yarn.lock'
		];
	}

	/**
	 * Check if a file should be ignored based on patterns
	 * @param filePath The file path to check
	 * @param patterns Array of ignore patterns (gitignore syntax)
	 * @returns boolean Whether the file should be ignored
	 */
	private static isFileIgnored(filePath: string, patterns: string[]): boolean {
		try {
			for (const pattern of patterns) {
				if (this.matchesPattern(filePath, pattern)) {
					console.log(`[GitDataExtractor] File ${filePath} matches ignore pattern: ${pattern}`);
					return true;
				}
			}
			return false;

		} catch (error) {
			console.error(`[GitDataExtractor] Error checking ignore patterns for ${filePath}:`, error);
			return false; // Don't ignore on error
		}
	}

	/**
	 * Check if a file path matches a gitignore-style pattern
	 * @param filePath The file path to check
	 * @param pattern The pattern to match against
	 * @returns boolean Whether the file matches the pattern
	 */
	private static matchesPattern(filePath: string, pattern: string): boolean {
		try {
			// Convert gitignore pattern to regex
			let regexPattern = pattern
				.replace(/\./g, '\\.')  // Escape dots
				.replace(/\*/g, '.*')   // Convert * to .*
				.replace(/\?/g, '.')    // Convert ? to .
				.replace(/\//g, '\\/'); // Escape forward slashes

			// Handle directory patterns ending with /**
			if (pattern.endsWith('/**')) {
				regexPattern = pattern.slice(0, -3).replace(/\./g, '\\.').replace(/\*/g, '.*') + '(/.*)?';
			}

			// Handle patterns starting with /
			if (pattern.startsWith('/')) {
				regexPattern = '^' + regexPattern.slice(1);
			} else {
				regexPattern = '(^|/)' + regexPattern;
			}

			regexPattern += '$';

			const regex = new RegExp(regexPattern);
			return regex.test(filePath);

		} catch (error) {
			console.error(`[GitDataExtractor] Error matching pattern ${pattern} against ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Get summary statistics for the extracted data
	 * @param commitInfo The commit information
	 * @returns object Summary statistics
	 */
	public static getCommitSummary(commitInfo: CommitInfo): {
		totalFiles: number;
		addedFiles: number;
		deletedFiles: number;
		modifiedFiles: number;
		aiProcessedFiles: number;
		totalDiffSize: number;
	} {
		const summary = {
			totalFiles: commitInfo.fileChanges.length,
			addedFiles: commitInfo.fileChanges.filter(f => f.changeType === 'added').length,
			deletedFiles: commitInfo.fileChanges.filter(f => f.changeType === 'deleted').length,
			modifiedFiles: commitInfo.fileChanges.filter(f => f.changeType === 'modified').length,
			aiProcessedFiles: commitInfo.fileChanges.filter(f => f.includeInAI).length,
			totalDiffSize: commitInfo.fileChanges
				.filter(f => f.fileSize)
				.reduce((total, f) => total + (f.fileSize || 0), 0)
		};

		console.log(`[GitDataExtractor] Commit summary:`, summary);
		return summary;
	}
} 