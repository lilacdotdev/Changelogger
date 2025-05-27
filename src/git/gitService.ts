import * as vscode from 'vscode';
import { simpleGit, SimpleGit, GitError } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface for git repository information
 */
export interface GitRepository {
	/* The simple-git instance for this repository */
	git: SimpleGit;
	/* The root path of the git repository */
	rootPath: string;
	/* Whether this is a valid git repository */
	isValid: boolean;
}

/**
 * Service class for git operations and repository management
 */
export class GitService {
	private static instance: GitService;
	private repositories: Map<string, GitRepository> = new Map();

	/**
	 * Get the singleton instance of GitService
	 */
	public static getInstance(): GitService {
		if (!GitService.instance) {
			GitService.instance = new GitService();
		}
		return GitService.instance;
	}

	/**
	 * Detect and validate git repository in the current workspace
	 * @param workspacePath The workspace path to check for git repository
	 * @returns Promise<GitRepository | null> Repository information or null if not found
	 */
	public async detectGitRepository(workspacePath: string): Promise<GitRepository | null> {
		try {
			console.log(`[GitService] Detecting git repository in: ${workspacePath}`);
			
			// Check if workspace path exists
			if (!fs.existsSync(workspacePath)) {
				console.error(`[GitService] Workspace path does not exist: ${workspacePath}`);
				vscode.window.showErrorMessage(`Changelogger: Workspace path does not exist: ${workspacePath}`);
				return null;
			}

			// Check if we already have this repository cached
			if (this.repositories.has(workspacePath)) {
				const cachedRepo = this.repositories.get(workspacePath)!;
				console.log(`[GitService] Using cached repository for: ${workspacePath}`);
				return cachedRepo;
			}

			// Look for .git directory
			const gitPath = await this.findGitDirectory(workspacePath);
			if (!gitPath) {
				console.error(`[GitService] No .git directory found in workspace: ${workspacePath}`);
				vscode.window.showErrorMessage(`Changelogger: No git repository found in workspace: ${workspacePath}. Please initialize a git repository first.`);
				return null;
			}

			// Create simple-git instance
			const git = simpleGit(workspacePath);
			
			// Validate that it's a proper git repository
			const isRepo = await this.validateGitRepository(git, workspacePath);
			if (!isRepo) {
				console.error(`[GitService] Invalid git repository at: ${workspacePath}`);
				vscode.window.showErrorMessage(`Changelogger: Invalid git repository at: ${workspacePath}`);
				return null;
			}

			// Create repository object
			const repository: GitRepository = {
				git,
				rootPath: workspacePath,
				isValid: true
			};

			// Cache the repository
			this.repositories.set(workspacePath, repository);
			console.log(`[GitService] Successfully detected and cached git repository: ${workspacePath}`);
			
			return repository;

		} catch (error) {
			console.error(`[GitService] Error detecting git repository in ${workspacePath}:`, error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Failed to detect git repository: ${errorMessage}`);
			return null;
		}
	}

	/**
	 * Find the .git directory in the workspace or parent directories
	 * @param startPath The path to start searching from
	 * @returns Promise<string | null> Path to the git repository root or null
	 */
	private async findGitDirectory(startPath: string): Promise<string | null> {
		try {
			let currentPath = path.resolve(startPath);
			const maxDepth = 10; // Prevent infinite loops
			let depth = 0;

			while (depth < maxDepth) {
				const gitPath = path.join(currentPath, '.git');
				console.log(`[GitService] Checking for .git at: ${gitPath}`);

				if (fs.existsSync(gitPath)) {
					const stats = fs.statSync(gitPath);
					if (stats.isDirectory() || stats.isFile()) {
						console.log(`[GitService] Found .git at: ${gitPath}`);
						return currentPath;
					}
				}

				// Move to parent directory
				const parentPath = path.dirname(currentPath);
				if (parentPath === currentPath) {
					// Reached root directory
					break;
				}
				currentPath = parentPath;
				depth++;
			}

			console.log(`[GitService] No .git directory found after searching ${depth} levels from: ${startPath}`);
			return null;

		} catch (error) {
			console.error(`[GitService] Error finding .git directory from ${startPath}:`, error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Error searching for git repository: ${errorMessage}`);
			return null;
		}
	}

	/**
	 * Validate that the git repository is properly initialized and accessible
	 * @param git The simple-git instance
	 * @param repoPath The repository path for error messages
	 * @returns Promise<boolean> Whether the repository is valid
	 */
	private async validateGitRepository(git: SimpleGit, repoPath: string): Promise<boolean> {
		try {
			console.log(`[GitService] Validating git repository at: ${repoPath}`);

			// Check if git is properly initialized
			const isRepo = await git.checkIsRepo();
			if (!isRepo) {
				console.error(`[GitService] Path is not a git repository: ${repoPath}`);
				return false;
			}

			// Try to get git status to ensure repository is accessible
			await git.status();
			console.log(`[GitService] Git repository validation successful: ${repoPath}`);
			return true;

		} catch (error) {
			console.error(`[GitService] Git repository validation failed for ${repoPath}:`, error);
			
			if (error instanceof GitError) {
				console.error(`[GitService] Git error details: ${error.message}`);
				vscode.window.showErrorMessage(`Changelogger: Git error - ${error.message}`);
			} else {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error(`[GitService] Validation error: ${errorMessage}`);
				vscode.window.showErrorMessage(`Changelogger: Repository validation failed: ${errorMessage}`);
			}
			
			return false;
		}
	}

	/**
	 * Get the current workspace folders and detect git repositories
	 * @returns Promise<GitRepository[]> Array of detected git repositories
	 */
	public async detectWorkspaceRepositories(): Promise<GitRepository[]> {
		try {
			console.log('[GitService] Detecting repositories in workspace folders');

			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				console.error('[GitService] No workspace folders found');
				vscode.window.showErrorMessage('Changelogger: No workspace folders found. Please open a folder or workspace.');
				return [];
			}

			const repositories: GitRepository[] = [];

			for (const folder of workspaceFolders) {
				console.log(`[GitService] Processing workspace folder: ${folder.uri.fsPath}`);
				const repo = await this.detectGitRepository(folder.uri.fsPath);
				if (repo) {
					repositories.push(repo);
				}
			}

			if (repositories.length === 0) {
				console.warn('[GitService] No git repositories found in any workspace folder');
				vscode.window.showWarningMessage('Changelogger: No git repositories found in the current workspace.');
			} else {
				console.log(`[GitService] Found ${repositories.length} git repositories in workspace`);
			}

			return repositories;

		} catch (error) {
			console.error('[GitService] Error detecting workspace repositories:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Failed to detect workspace repositories: ${errorMessage}`);
			return [];
		}
	}

	/**
	 * Clear the repository cache
	 */
	public clearCache(): void {
		console.log('[GitService] Clearing repository cache');
		this.repositories.clear();
	}

	/**
	 * Get a cached repository by path
	 * @param workspacePath The workspace path
	 * @returns GitRepository | null
	 */
	public getCachedRepository(workspacePath: string): GitRepository | null {
		return this.repositories.get(workspacePath) || null;
	}
} 