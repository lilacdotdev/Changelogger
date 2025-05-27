import * as vscode from 'vscode';
import { GitExtension, Repository, API as GitAPI } from './gitExtensionTypes';

/**
 * Interface for git hook integration result
 */
export interface GitHookResult {
	/** Whether the integration was successful */
	success: boolean;
	/** Error message if integration failed */
	errorMessage?: string;
	/** Additional context for debugging */
	context?: string;
}

/**
 * Service class for integrating with VS Code's git extension
 */
export class GitHookIntegration {
	private static instance: GitHookIntegration;
	private gitAPI: GitAPI | null = null;
	private repositories: Repository[] = [];
	private disposables: vscode.Disposable[] = [];
	private onCommitCallback?: (repository: Repository) => Promise<void>;

	/**
	 * Get the singleton instance of GitHookIntegration
	 */
	public static getInstance(): GitHookIntegration {
		if (!GitHookIntegration.instance) {
			GitHookIntegration.instance = new GitHookIntegration();
		}
		return GitHookIntegration.instance;
	}

	/**
	 * Initialize the git hook integration
	 * @param onCommitCallback Callback function to execute when a commit is detected
	 * @returns Promise<GitHookResult> The initialization result
	 */
	public async initialize(onCommitCallback: (repository: Repository) => Promise<void>): Promise<GitHookResult> {
		try {
			console.log('[GitHookIntegration] Initializing git hook integration');

			this.onCommitCallback = onCommitCallback;

			// Get the git extension
			const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
			if (!gitExtension) {
				const error = 'VS Code git extension not found';
				console.error(`[GitHookIntegration] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Git extension is required for automatic commit detection'
				};
			}

			// Activate the git extension if not already active
			if (!gitExtension.isActive) {
				console.log('[GitHookIntegration] Activating git extension');
				await gitExtension.activate();
			}

			// Get the git API
			this.gitAPI = gitExtension.exports.getAPI(1);
			if (!this.gitAPI) {
				const error = 'Failed to get git API from extension';
				console.error(`[GitHookIntegration] ${error}`);
				return {
					success: false,
					errorMessage: error,
					context: 'Git API version 1 not available'
				};
			}

			console.log(`[GitHookIntegration] Git API initialized, found ${this.gitAPI.repositories.length} repositories`);

			// Set up repository monitoring
			await this.setupRepositoryMonitoring();

			console.log('[GitHookIntegration] Git hook integration initialized successfully');
			return { success: true };

		} catch (error) {
			const errorMessage = `Failed to initialize git hook integration: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[GitHookIntegration] ${errorMessage}`, error);
			return {
				success: false,
				errorMessage,
				context: 'Git hook integration initialization failed'
			};
		}
	}

	/**
	 * Set up monitoring for git repositories
	 * @returns Promise<void>
	 */
	private async setupRepositoryMonitoring(): Promise<void> {
		try {
			if (!this.gitAPI) {
				throw new Error('Git API not initialized');
			}

			console.log('[GitHookIntegration] Setting up repository monitoring');

			// Monitor existing repositories
			this.repositories = [...this.gitAPI.repositories];
			for (const repo of this.repositories) {
				this.setupRepositoryListeners(repo);
			}

			// Monitor for new repositories
			const onDidOpenRepository = this.gitAPI.onDidOpenRepository((repo: Repository) => {
				console.log(`[GitHookIntegration] New repository opened: ${repo.rootUri.fsPath}`);
				this.repositories.push(repo);
				this.setupRepositoryListeners(repo);
			});

			// Monitor for closed repositories
			const onDidCloseRepository = this.gitAPI.onDidCloseRepository((repo: Repository) => {
				console.log(`[GitHookIntegration] Repository closed: ${repo.rootUri.fsPath}`);
				this.repositories = this.repositories.filter(r => r !== repo);
			});

			this.disposables.push(onDidOpenRepository, onDidCloseRepository);

			console.log(`[GitHookIntegration] Monitoring ${this.repositories.length} repositories`);

		} catch (error) {
			console.error('[GitHookIntegration] Error setting up repository monitoring:', error);
			throw error;
		}
	}

	/**
	 * Set up listeners for a specific repository
	 * @param repository The repository to monitor
	 */
	private setupRepositoryListeners(repository: Repository): void {
		try {
			console.log(`[GitHookIntegration] Setting up listeners for repository: ${repository.rootUri.fsPath}`);

			// Monitor state changes (this includes commits)
			const onDidChangeState = repository.state.onDidChange(() => {
				this.handleRepositoryStateChange(repository);
			});

			// Monitor HEAD changes (more specific to commits)
			const onDidChangeRepository = repository.onDidChangeRepository(() => {
				this.handleRepositoryChange(repository);
			});

			this.disposables.push(onDidChangeState, onDidChangeRepository);

			console.log(`[GitHookIntegration] Listeners set up for repository: ${repository.rootUri.fsPath}`);

		} catch (error) {
			console.error(`[GitHookIntegration] Error setting up listeners for repository ${repository.rootUri.fsPath}:`, error);
		}
	}

	/**
	 * Handle repository state changes
	 * @param repository The repository that changed
	 */
	private async handleRepositoryStateChange(repository: Repository): Promise<void> {
		try {
			// Check if this is a commit-related change
			const workingTreeChanges = repository.state.workingTreeChanges.length;
			const indexChanges = repository.state.indexChanges.length;

			console.log(`[GitHookIntegration] Repository state change: ${repository.rootUri.fsPath} - Working: ${workingTreeChanges}, Index: ${indexChanges}`);

			// If working tree and index are clean, it might indicate a commit just happened
			if (workingTreeChanges === 0 && indexChanges === 0) {
				console.log(`[GitHookIntegration] Potential commit detected in: ${repository.rootUri.fsPath}`);
				await this.handlePotentialCommit(repository);
			}

		} catch (error) {
			console.error(`[GitHookIntegration] Error handling repository state change for ${repository.rootUri.fsPath}:`, error);
		}
	}

	/**
	 * Handle repository changes (HEAD changes)
	 * @param repository The repository that changed
	 */
	private async handleRepositoryChange(repository: Repository): Promise<void> {
		try {
			console.log(`[GitHookIntegration] Repository change detected: ${repository.rootUri.fsPath}`);
			await this.handlePotentialCommit(repository);

		} catch (error) {
			console.error(`[GitHookIntegration] Error handling repository change for ${repository.rootUri.fsPath}:`, error);
		}
	}

	/**
	 * Handle a potential commit event
	 * @param repository The repository where the commit might have occurred
	 */
	private async handlePotentialCommit(repository: Repository): Promise<void> {
		try {
			console.log(`[GitHookIntegration] Processing potential commit in: ${repository.rootUri.fsPath}`);

			// Check if auto-generation is enabled
			const config = vscode.workspace.getConfiguration('changelogger');
			const autoGenerate = config.get<boolean>('autoGenerate', false);

			if (!autoGenerate) {
				console.log('[GitHookIntegration] Auto-generation is disabled, skipping');
				return;
			}

			// Call the commit callback if provided
			if (this.onCommitCallback) {
				console.log(`[GitHookIntegration] Executing commit callback for: ${repository.rootUri.fsPath}`);
				await this.onCommitCallback(repository);
			} else {
				console.warn('[GitHookIntegration] No commit callback registered');
			}

		} catch (error) {
			console.error(`[GitHookIntegration] Error processing potential commit for ${repository.rootUri.fsPath}:`, error);
		}
	}

	/**
	 * Get all monitored repositories
	 * @returns Repository[] Array of monitored repositories
	 */
	public getRepositories(): Repository[] {
		return [...this.repositories];
	}

	/**
	 * Get a repository by path
	 * @param repoPath The repository path to find
	 * @returns Repository | undefined The found repository or undefined
	 */
	public getRepositoryByPath(repoPath: string): Repository | undefined {
		return this.repositories.find(repo => repo.rootUri.fsPath === repoPath);
	}

	/**
	 * Check if auto-generation is enabled
	 * @returns boolean Whether auto-generation is enabled
	 */
	public isAutoGenerationEnabled(): boolean {
		const config = vscode.workspace.getConfiguration('changelogger');
		return config.get<boolean>('autoGenerate', false);
	}

	/**
	 * Enable or disable auto-generation
	 * @param enabled Whether to enable auto-generation
	 * @returns Promise<void>
	 */
	public async setAutoGeneration(enabled: boolean): Promise<void> {
		try {
			console.log(`[GitHookIntegration] Setting auto-generation to: ${enabled}`);
			const config = vscode.workspace.getConfiguration('changelogger');
			await config.update('autoGenerate', enabled, vscode.ConfigurationTarget.Workspace);
			console.log(`[GitHookIntegration] Auto-generation updated to: ${enabled}`);

		} catch (error) {
			console.error(`[GitHookIntegration] Error setting auto-generation to ${enabled}:`, error);
			throw error;
		}
	}

	/**
	 * Dispose of all resources and stop monitoring
	 */
	public dispose(): void {
		try {
			console.log('[GitHookIntegration] Disposing git hook integration');

			// Dispose all event listeners
			for (const disposable of this.disposables) {
				disposable.dispose();
			}
			this.disposables = [];

			// Clear references
			this.repositories = [];
			this.gitAPI = null;
			this.onCommitCallback = undefined as any;

			console.log('[GitHookIntegration] Git hook integration disposed');

		} catch (error) {
			console.error('[GitHookIntegration] Error disposing git hook integration:', error);
		}
	}
} 