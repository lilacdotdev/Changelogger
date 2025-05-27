// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitService } from './git/gitService';
import { GitDataExtractor } from './git/gitDataExtractor';
import { GitHookIntegration } from './git/gitHookIntegration';
import { ChangelogGenerator } from './changelog/changelogGenerator';
import { ValidationUtils } from './utils/validation';
import { Repository } from './git/gitExtensionTypes';

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "changelogger" is now active!');

	// Get the GitService instance
	const gitService = GitService.getInstance();
	const gitHookIntegration = GitHookIntegration.getInstance();

	// Initialize git hook integration for automatic commit detection
	initializeGitHookIntegration(gitHookIntegration);

	// Register the main changelog generation command
	const generateDisposable = vscode.commands.registerCommand('changelogger.generate', async () => {
		await executeChangelogGeneration();
	});

	// Register the configuration command
	const configureDisposable = vscode.commands.registerCommand('changelogger.configure', () => {
		try {
			console.log('[Extension] Changelogger: Configuration command triggered');
			// TODO: Implement configuration panel
			vscode.window.showInformationMessage('Changelogger: Configuration panel coming soon!');
		} catch (error) {
			console.error('[Extension] Error in changelogger.configure command:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Configuration failed: ${errorMessage}`);
		}
	});

	// Register the API key setting command
	const setApiKeyDisposable = vscode.commands.registerCommand('changelogger.setApiKey', () => {
		try {
			console.log('[Extension] Changelogger: Set API Key command triggered');
			// TODO: Implement API key setting logic
			vscode.window.showInformationMessage('Changelogger: API key setting coming soon!');
		} catch (error) {
			console.error('[Extension] Error in changelogger.setApiKey command:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: API key setting failed: ${errorMessage}`);
		}
	});

	// Register the mode toggle command
	const toggleModeDisposable = vscode.commands.registerCommand('changelogger.toggleMode', async () => {
		try {
			console.log('[Extension] Changelogger: Toggle Mode command triggered');
			await toggleChangeloggerMode();
		} catch (error) {
			console.error('[Extension] Error in changelogger.toggleMode command:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Mode toggle failed: ${errorMessage}`);
		}
	});

	/**
	 * Initialize git hook integration for automatic commit detection
	 */
	async function initializeGitHookIntegration(hookIntegration: GitHookIntegration): Promise<void> {
		try {
			console.log('[Extension] Initializing git hook integration');

			const result = await hookIntegration.initialize(async (repository: Repository) => {
				console.log(`[Extension] Auto-generating changelog for repository: ${repository.rootUri.fsPath}`);
				await executeChangelogGeneration(repository.rootUri.fsPath);
			});

			if (result.success) {
				console.log('[Extension] Git hook integration initialized successfully');
			} else {
				console.warn(`[Extension] Git hook integration failed: ${result.errorMessage}`);
				// Don't show error to user for hook integration failure, just log it
			}

		} catch (error) {
			console.error('[Extension] Error initializing git hook integration:', error);
		}
	}

	/**
	 * Execute changelog generation for the current workspace or specified repository
	 */
	async function executeChangelogGeneration(specificRepoPath?: string): Promise<void> {
		try {
			console.log('[Extension] Executing changelog generation');

			// Validate VS Code workspace
			const workspaceValidation = ValidationUtils.validateVSCodeWorkspace();
			if (!workspaceValidation.isValid) {
				ValidationUtils.showValidationError(workspaceValidation, 'Workspace validation');
				return;
			}

			// Get repository to process
			let targetRepo;
			if (specificRepoPath) {
				// Use specific repository path (from git hook)
				targetRepo = await gitService.detectGitRepository(specificRepoPath);
			} else {
				// Detect repositories in workspace (manual trigger)
				const repositories = await gitService.detectWorkspaceRepositories();
				if (repositories.length === 0) {
					console.error('[Extension] No git repositories found in workspace');
					vscode.window.showErrorMessage('Changelogger: No git repositories found in the current workspace. Please ensure you have a git repository initialized.');
					return;
				}
				targetRepo = repositories[0]; // Use first repository for now
			}

			if (!targetRepo) {
				console.error('[Extension] Failed to get target repository');
				vscode.window.showErrorMessage('Changelogger: Failed to access git repository.');
				return;
			}

			console.log(`[Extension] Processing repository: ${targetRepo.rootPath}`);

			// Get current mode and settings
			const mode = ChangelogGenerator.getCurrentMode();
			const changelogPath = ChangelogGenerator.getCurrentChangelogPath();

			console.log(`[Extension] Mode: ${mode}, Changelog path: ${changelogPath}`);

			// Extract git data from latest commit
			const includeAIData = mode === 'ai';
			const gitDataResult = await GitDataExtractor.extractLatestCommit(
				targetRepo.git,
				targetRepo.rootPath,
				includeAIData
			);

			if (!gitDataResult.success || !gitDataResult.commitInfo) {
				console.error(`[Extension] Failed to extract git data: ${gitDataResult.errorMessage}`);
				vscode.window.showErrorMessage(`Changelogger: Failed to extract commit data: ${gitDataResult.errorMessage}`);
				return;
			}

			console.log(`[Extension] Extracted commit data: ${gitDataResult.commitInfo.hash}`);

			// Generate changelog entry
			const changelogOptions = {
				mode,
				changelogPath,
				workspaceRoot: targetRepo.rootPath,
				createBackup: true
			};

			const changelogResult = await ChangelogGenerator.generateChangelogEntry(
				gitDataResult.commitInfo,
				changelogOptions
			);

			if (!changelogResult.success) {
				console.error(`[Extension] Failed to generate changelog: ${changelogResult.errorMessage}`);
				vscode.window.showErrorMessage(`Changelogger: Failed to generate changelog: ${changelogResult.errorMessage}`);
				return;
			}

			// Show success message with statistics
			const stats = changelogResult.stats;
			if (stats) {
				const message = `Changelogger: Successfully generated changelog entry! ` +
					`Files: ${stats.totalFiles} (${stats.addedFiles} added, ${stats.modifiedFiles} modified, ${stats.deletedFiles} deleted)` +
					(stats.aiProcessedFiles !== undefined ? `, AI processed: ${stats.aiProcessedFiles}` : '');
				
				vscode.window.showInformationMessage(message);
			} else {
				vscode.window.showInformationMessage('Changelogger: Successfully generated changelog entry!');
			}

			console.log('[Extension] Changelog generation completed successfully');

		} catch (error) {
			console.error('[Extension] Error in changelog generation:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Failed to generate changelog: ${errorMessage}`);
		}
	}

	/**
	 * Toggle between base and AI modes
	 */
	async function toggleChangeloggerMode(): Promise<void> {
		try {
			console.log('[Extension] Toggling changelogger mode');

			const config = vscode.workspace.getConfiguration('changelogger');
			const currentMode = config.get<string>('mode', 'base');
			const newMode = currentMode === 'base' ? 'ai' : 'base';

			await config.update('mode', newMode, vscode.ConfigurationTarget.Workspace);

			console.log(`[Extension] Mode toggled from ${currentMode} to ${newMode}`);
			vscode.window.showInformationMessage(`Changelogger: Mode changed to ${newMode.toUpperCase()}`);

		} catch (error) {
			console.error('[Extension] Error toggling mode:', error);
			throw error;
		}
	}

	// Add all disposables to subscriptions
	context.subscriptions.push(
		generateDisposable,
		configureDisposable,
		setApiKeyDisposable,
		toggleModeDisposable
	);

	// Log successful activation
	console.log('[Extension] Changelogger extension activated successfully');
}

/**
 * This method is called when your extension is deactivated
 */
export function deactivate() {
	console.log('[Extension] Changelogger extension deactivated');
	
	// Clear git service cache
	try {
		const gitService = GitService.getInstance();
		gitService.clearCache();
		console.log('[Extension] Git service cache cleared');
	} catch (error) {
		console.error('[Extension] Error clearing git service cache:', error);
	}

	// Dispose git hook integration
	try {
		const gitHookIntegration = GitHookIntegration.getInstance();
		gitHookIntegration.dispose();
		console.log('[Extension] Git hook integration disposed');
	} catch (error) {
		console.error('[Extension] Error disposing git hook integration:', error);
	}
}
