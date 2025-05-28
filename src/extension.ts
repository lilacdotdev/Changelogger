// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitService } from './git/gitService';
import { GitDataExtractor } from './git/gitDataExtractor';
import { GitHookIntegration } from './git/gitHookIntegration';
import { ChangelogGenerator } from './changelog/changelogGenerator';
import { ValidationUtils } from './utils/validation';
import { Repository } from './git/gitExtensionTypes';
import { ConfigurationManager } from './config/configurationManager';
import { AIIntegrationService } from './ai/aiIntegrationService';
import { StatusBarService } from './ui/statusBar';

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "changelogger" is now active!');

	// Get service instances
	const gitService = GitService.getInstance();
	const gitHookIntegration = GitHookIntegration.getInstance();
	const configManager = ConfigurationManager.getInstance();
	const aiService = AIIntegrationService.getInstance();
	const statusBarService = StatusBarService.getInstance();

	// Initialize services
	initializeGitHookIntegration(gitHookIntegration);
	statusBarService.initialize(context);

	// Register the main changelog generation command
	const generateDisposable = vscode.commands.registerCommand('changelogger.generate', async () => {
		await executeChangelogGeneration();
	});

	// Register the configuration command
	const configureDisposable = vscode.commands.registerCommand('changelogger.configure', async () => {
		try {
			console.log('[Extension] Changelogger: Configuration command triggered');
			await showConfigurationPanel();
		} catch (error) {
			console.error('[Extension] Error in changelogger.configure command:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Configuration failed: ${errorMessage}`);
		}
	});

	// Register the API key setting command
	const setApiKeyDisposable = vscode.commands.registerCommand('changelogger.setApiKey', async () => {
		try {
			console.log('[Extension] Changelogger: Set API Key command triggered');
			await setOpenAIApiKey();
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

	// Register the test AI integration command
	const testAIDisposable = vscode.commands.registerCommand('changelogger.testAI', async () => {
		try {
			console.log('[Extension] Changelogger: Test AI command triggered');
			await testAIIntegration();
		} catch (error) {
			console.error('[Extension] Error in changelogger.testAI command:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: AI test failed: ${errorMessage}`);
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

			// Show temporary status in status bar
			statusBarService.showTemporaryMessage('Generating changelog...', 2000);

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

			// Validate configuration for AI mode
			if (mode === 'ai') {
				const configValidation = await configManager.validateConfiguration();
				if (!configValidation.isValid) {
					console.warn(`[Extension] AI mode configuration invalid: ${configValidation.errorMessage}`);
					const switchToBase = await vscode.window.showWarningMessage(
						`Changelogger: AI mode is not properly configured. ${configValidation.errorMessage}`,
						'Switch to Base Mode',
						'Configure API Key',
						'Cancel'
					);

					if (switchToBase === 'Switch to Base Mode') {
						await configManager.enableBaseMode();
						statusBarService.updateStatusBar();
						vscode.window.showInformationMessage('Changelogger: Switched to Base mode');
					} else if (switchToBase === 'Configure API Key') {
						await setOpenAIApiKey();
						return; // Exit and let user retry
					} else {
						return; // User cancelled
					}
				}
			}

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
				let message = `Changelogger: Successfully generated changelog entry! ` +
					`Files: ${stats.totalFiles} (${stats.addedFiles} added, ${stats.modifiedFiles} modified, ${stats.deletedFiles} deleted)`;
				
				if (stats.aiProcessedFiles !== undefined) {
					message += `, AI processed: ${stats.aiProcessedFiles}`;
					if (stats.aiSummaryGenerated) {
						message += ' ✓';
					}
					if (stats.tokenUsage) {
						message += ` (${stats.tokenUsage.totalTokens} tokens)`;
					}
				}
				
				vscode.window.showInformationMessage(message);
				statusBarService.showTemporaryMessage('Changelog generated!', 3000);
			} else {
				vscode.window.showInformationMessage('Changelogger: Successfully generated changelog entry!');
				statusBarService.showTemporaryMessage('Changelog generated!', 3000);
			}

			console.log('[Extension] Changelog generation completed successfully');

		} catch (error) {
			console.error('[Extension] Error in changelog generation:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Changelogger: Failed to generate changelog: ${errorMessage}`);
			statusBarService.showTemporaryMessage('Generation failed!', 3000);
		}
	}

	/**
	 * Show configuration panel with current settings
	 */
	async function showConfigurationPanel(): Promise<void> {
		try {
			console.log('[Extension] Showing configuration panel');

			// Get current configuration and status
			const config = configManager.getConfiguration();
			const aiStatus = await aiService.getStatus() as any;
			const currentMode = config.mode.toUpperCase();
			const hasApiKey = config.openaiApiKey.length > 0;

			// Build status information
			const statusInfo = [
				`📊 Current Status:`,
				`   Mode: ${currentMode}`,
				`   API Key: ${hasApiKey ? 'Configured ✓' : 'Not Set ❌'}`,
				`   AI Service: ${aiStatus.isReady ? 'Ready ✓' : 'Not Ready ❌'}`,
				`   Auto Generate: ${config.autoGenerate ? 'Enabled ✓' : 'Disabled ❌'}`,
				`   Changelog Path: ${config.changelogPath}`,
				``,
				`⚙️ Configuration Options:`
			];

			// Build action items with better organization
			const actions: string[] = [
				'$(key) Set OpenAI API Key',
				`$(arrow-swap) Switch to ${currentMode === 'AI' ? 'BASE' : 'AI'} Mode`,
				'$(file-text) Change Changelog Path',
				`$(${config.autoGenerate ? 'circle-slash' : 'play'}) ${config.autoGenerate ? 'Disable' : 'Enable'} Auto Generate`,
				'$(beaker) Test AI Integration',
				'$(gear) Advanced Settings',
				'$(trash) Reset Configuration'
			];

			// Show status first, then actions
			const allItems = [...statusInfo, ...actions];

			const selection = await vscode.window.showQuickPick(allItems, {
				placeHolder: `Changelogger Configuration (Current: ${currentMode} Mode)`,
				ignoreFocusOut: true,
				canPickMany: false
			});

			if (!selection || selection.startsWith('📊') || selection.startsWith('   ') || selection.startsWith('⚙️') || selection === '') {
				return; // User cancelled or selected status info
			}

			// Execute the selected action
			await executeConfigurationAction(selection);

		} catch (error) {
			console.error('[Extension] Error showing configuration panel:', error);
			throw error;
		}
	}

	/**
	 * Execute the selected configuration action
	 * @param action The selected action string
	 */
	async function executeConfigurationAction(action: string): Promise<void> {
		try {
			console.log(`[Extension] Executing configuration action: ${action}`);

			if (action.includes('Set OpenAI API Key')) {
				await setOpenAIApiKey();
			} else if (action.includes('Switch to')) {
				await toggleChangeloggerMode();
			} else if (action.includes('Change Changelog Path')) {
				await changeChangelogPath();
			} else if (action.includes('Auto Generate')) {
				await toggleAutoGenerate();
			} else if (action.includes('Test AI Integration')) {
				await testAIIntegration();
			} else if (action.includes('Advanced Settings')) {
				await showAdvancedSettings();
			} else if (action.includes('Reset Configuration')) {
				await resetConfiguration();
			}

		} catch (error) {
			console.error('[Extension] Error executing configuration action:', error);
			vscode.window.showErrorMessage(`Changelogger: Failed to execute action: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Change the changelog file path
	 */
	async function changeChangelogPath(): Promise<void> {
		try {
			const config = configManager.getConfiguration();
			const currentPath = config.changelogPath;

			const newPath = await vscode.window.showInputBox({
				prompt: 'Enter the changelog file path (relative to workspace root)',
				value: currentPath,
				placeHolder: 'CHANGELOG.md',
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (!value || value.trim() === '') {
						return 'Changelog path cannot be empty';
					}
					if (value.includes('..') || value.startsWith('/')) {
						return 'Path must be relative to workspace root';
					}
					return null;
				}
			});

			if (!newPath || newPath === currentPath) {
				return;
			}

			await configManager.updateConfiguration('changelogPath', newPath);
			vscode.window.showInformationMessage(`Changelogger: Changelog path updated to ${newPath}`);

		} catch (error) {
			console.error('[Extension] Error changing changelog path:', error);
			throw error;
		}
	}

	/**
	 * Show advanced settings panel
	 */
	async function showAdvancedSettings(): Promise<void> {
		try {
			const advancedActions = [
				'$(info) View Configuration Summary',
				'$(eye) Show API Key Status',
				'$(file-code) Open Settings JSON',
				'$(refresh) Reinitialize AI Service',
				'$(bug) View Service Status',
				'$(arrow-left) Back to Main Configuration'
			];

			const selection = await vscode.window.showQuickPick(advancedActions, {
				placeHolder: 'Advanced Configuration Options',
				ignoreFocusOut: true
			});

			if (!selection) {
				return;
			}

			if (selection.includes('View Configuration Summary')) {
				const summary = configManager.getConfigurationSummary();
				const summaryText = JSON.stringify(summary, null, 2);
				vscode.window.showInformationMessage(`Configuration Summary:\n${summaryText}`, { modal: true });
			} else if (selection.includes('Show API Key Status')) {
				const apiKey = await configManager.getApiKey();
				const hasKey = apiKey.length > 0;
				const keyStatus = hasKey ? `Configured (${apiKey.length} characters)` : 'Not configured';
				vscode.window.showInformationMessage(`API Key Status: ${keyStatus}`);
			} else if (selection.includes('Open Settings JSON')) {
				await vscode.commands.executeCommand('workbench.action.openSettings', 'changelogger');
			} else if (selection.includes('Reinitialize AI Service')) {
				vscode.window.showInformationMessage('Reinitializing AI service...');
				const result = await aiService.reinitialize();
				if (result.success) {
					vscode.window.showInformationMessage('AI service reinitialized successfully');
				} else {
					vscode.window.showErrorMessage(`Failed to reinitialize AI service: ${result.errorMessage}`);
				}
			} else if (selection.includes('View Service Status')) {
				const status = await aiService.getStatus();
				const statusText = JSON.stringify(status, null, 2);
				vscode.window.showInformationMessage(`Service Status:\n${statusText}`, { modal: true });
			} else if (selection.includes('Back to Main Configuration')) {
				await showConfigurationPanel();
			}

		} catch (error) {
			console.error('[Extension] Error in advanced settings:', error);
			throw error;
		}
	}

	/**
	 * Set OpenAI API key through user input
	 */
	async function setOpenAIApiKey(): Promise<void> {
		try {
			console.log('[Extension] Setting OpenAI API key');

			const apiKey = await vscode.window.showInputBox({
				prompt: 'Enter your OpenAI API Key',
				placeHolder: 'sk-...',
				password: true,
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (!value || value.trim() === '') {
						return 'API key cannot be empty';
					}
					const validation = ValidationUtils.validateOpenAIApiKey(value);
					return validation.isValid ? null : validation.errorMessage;
				}
			});

			if (!apiKey) {
				console.log('[Extension] API key input cancelled');
				return;
			}

			const result = await configManager.setApiKey(apiKey);
			if (result.success) {
				vscode.window.showInformationMessage('Changelogger: OpenAI API key set successfully!');
				
				// Reinitialize AI service
				await aiService.reinitialize();
				
				// Update status bar
				statusBarService.updateStatusBar();
				
				// Offer to switch to AI mode
				const switchMode = await vscode.window.showInformationMessage(
					'Would you like to switch to AI mode now?',
					'Yes',
					'No'
				);
				
				if (switchMode === 'Yes') {
					await configManager.enableAiMode();
					statusBarService.updateStatusBar();
					vscode.window.showInformationMessage('Changelogger: Switched to AI mode');
				}
			} else {
				vscode.window.showErrorMessage(`Changelogger: Failed to set API key: ${result.errorMessage}`);
			}

		} catch (error) {
			console.error('[Extension] Error setting API key:', error);
			throw error;
		}
	}

	/**
	 * Toggle between base and AI modes
	 */
	async function toggleChangeloggerMode(): Promise<void> {
		try {
			console.log('[Extension] Toggling changelogger mode');

			const config = configManager.getConfiguration();
			const currentMode = config.mode;
			const newMode = currentMode === 'base' ? 'ai' : 'base';

			if (newMode === 'ai') {
				// Check if AI mode is available
				const isAvailable = await configManager.isAiModeAvailable();
				if (!isAvailable) {
					const setApiKey = await vscode.window.showWarningMessage(
						'AI mode requires a valid OpenAI API key. Would you like to set one now?',
						'Set API Key',
						'Cancel'
					);
					
					if (setApiKey === 'Set API Key') {
						await setOpenAIApiKey();
					}
					return;
				}
				
				await configManager.enableAiMode();
			} else {
				await configManager.enableBaseMode();
			}

			// Update status bar
			statusBarService.updateStatusBar();

			console.log(`[Extension] Mode toggled from ${currentMode} to ${newMode}`);
			vscode.window.showInformationMessage(`Changelogger: Mode changed to ${newMode.toUpperCase()}`);

		} catch (error) {
			console.error('[Extension] Error toggling mode:', error);
			throw error;
		}
	}

	/**
	 * Toggle auto-generation setting
	 */
	async function toggleAutoGenerate(): Promise<void> {
		try {
			const config = configManager.getConfiguration();
			const newValue = !config.autoGenerate;
			
			await configManager.updateConfiguration('autoGenerate', newValue);
			vscode.window.showInformationMessage(`Changelogger: Auto-generation ${newValue ? 'enabled' : 'disabled'}`);

		} catch (error) {
			console.error('[Extension] Error toggling auto-generation:', error);
			throw error;
		}
	}

	/**
	 * Reset configuration to defaults
	 */
	async function resetConfiguration(): Promise<void> {
		try {
			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to reset all Changelogger configuration to defaults?',
				'Yes',
				'No'
			);

			if (confirm === 'Yes') {
				await configManager.resetConfiguration();
				statusBarService.updateStatusBar();
				vscode.window.showInformationMessage('Changelogger: Configuration reset to defaults');
			}

		} catch (error) {
			console.error('[Extension] Error resetting configuration:', error);
			throw error;
		}
	}

	/**
	 * Test AI integration
	 */
	async function testAIIntegration(): Promise<void> {
		try {
			console.log('[Extension] Testing AI integration');
			vscode.window.showInformationMessage('Changelogger: Testing AI integration...');
			statusBarService.showTemporaryMessage('Testing AI...', 5000);
			
			// Check if AI service is ready
			const isReady = await aiService.isReady();
			if (!isReady) {
				console.log('[Extension] AI service not ready, attempting initialization...');
				const initResult = await aiService.initialize();
				
				if (!initResult.success) {
					console.error('[Extension] AI service initialization failed:', initResult.errorMessage);
					vscode.window.showErrorMessage(`Changelogger: AI initialization failed: ${initResult.errorMessage}`);
					statusBarService.showTemporaryMessage('AI init failed!', 3000);
					return;
				}
			}
			
			// Run the integration test
			const result = await aiService.testIntegration();
			
			if (result.success) {
				console.log('[Extension] AI integration test successful');
				vscode.window.showInformationMessage(`Changelogger: AI integration test successful! Summary: ${result.summary}`);
				statusBarService.showTemporaryMessage('AI test passed!', 3000);
			} else {
				console.error('[Extension] AI integration test failed:', result.errorMessage);
				vscode.window.showErrorMessage(`Changelogger: AI integration test failed: ${result.errorMessage}`);
				statusBarService.showTemporaryMessage('AI test failed!', 3000);
			}

		} catch (error) {
			console.error('[Extension] Error testing AI integration:', error);
			throw error;
		}
	}

	// Add all disposables to subscriptions
	context.subscriptions.push(
		generateDisposable,
		configureDisposable,
		setApiKeyDisposable,
		toggleModeDisposable,
		testAIDisposable
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

	// Dispose AI integration service
	try {
		const aiService = AIIntegrationService.getInstance();
		aiService.dispose();
		console.log('[Extension] AI integration service disposed');
	} catch (error) {
		console.error('[Extension] Error disposing AI integration service:', error);
	}

	// Dispose status bar service
	try {
		const statusBarService = StatusBarService.getInstance();
		statusBarService.dispose();
		console.log('[Extension] Status bar service disposed');
	} catch (error) {
		console.error('[Extension] Error disposing status bar service:', error);
	}
}
