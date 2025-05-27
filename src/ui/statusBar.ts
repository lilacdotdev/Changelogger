import * as vscode from 'vscode';
import { ConfigurationManager } from '../config/configurationManager';

/**
 * Service class for managing the status bar integration
 */
export class StatusBarService {
	private static instance: StatusBarService;
	private statusBarItem: vscode.StatusBarItem;
	private configManager: ConfigurationManager;

	/**
	 * Get the singleton instance of StatusBarService
	 */
	public static getInstance(): StatusBarService {
		if (!StatusBarService.instance) {
			StatusBarService.instance = new StatusBarService();
		}
		return StatusBarService.instance;
	}

	/**
	 * Private constructor for singleton pattern
	 */
	private constructor() {
		this.configManager = ConfigurationManager.getInstance();
		
		// Create status bar item
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		);
		
		// Set up click command for quick actions
		this.statusBarItem.command = 'changelogger.statusBarClick';
		this.statusBarItem.tooltip = 'Changelogger: Click for quick actions';
	}

	/**
	 * Initialize the status bar service
	 * @param context The extension context for registering commands
	 */
	public initialize(context: vscode.ExtensionContext): void {
		try {
			console.log('[StatusBarService] Initializing status bar service');

			// Register the status bar click command
			const statusBarClickDisposable = vscode.commands.registerCommand(
				'changelogger.statusBarClick',
				async () => {
					await this.showQuickActions();
				}
			);

			// Add to context subscriptions
			context.subscriptions.push(statusBarClickDisposable);
			context.subscriptions.push(this.statusBarItem);

			// Update the status bar display
			this.updateStatusBar();

			// Show the status bar item
			this.statusBarItem.show();

			// Listen for configuration changes to update status bar
			const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
				(event) => {
					if (event.affectsConfiguration('changelogger')) {
						this.updateStatusBar();
					}
				}
			);

			context.subscriptions.push(configChangeDisposable);

			console.log('[StatusBarService] Status bar service initialized successfully');

		} catch (error) {
			console.error('[StatusBarService] Error initializing status bar service:', error);
		}
	}

	/**
	 * Update the status bar display with current mode
	 */
	public updateStatusBar(): void {
		try {
			const config = this.configManager.getConfiguration();
			const mode = config.mode.toUpperCase();
			
			// Set icon based on mode
			const icon = mode === 'AI' ? '$(robot)' : '$(file-text)';
			
			// Update status bar text
			this.statusBarItem.text = `${icon} Changelogger: ${mode}`;
			
			// Update tooltip with more details
			this.statusBarItem.tooltip = `Changelogger: ${mode} Mode\nClick for quick actions`;

			console.log(`[StatusBarService] Status bar updated: ${mode} mode`);

		} catch (error) {
			console.error('[StatusBarService] Error updating status bar:', error);
			// Fallback display
			this.statusBarItem.text = '$(file-text) Changelogger';
			this.statusBarItem.tooltip = 'Changelogger: Click for actions';
		}
	}

	/**
	 * Show quick actions menu when status bar is clicked
	 */
	private async showQuickActions(): Promise<void> {
		try {
			console.log('[StatusBarService] Showing quick actions menu');

			const config = this.configManager.getConfiguration();
			const currentMode = config.mode.toUpperCase();
			const hasApiKey = config.openaiApiKey.length > 0;

			// Build quick actions based on current state
			const actions: string[] = [
				'$(play) Generate Changelog',
				`$(arrow-swap) Switch to ${currentMode === 'AI' ? 'BASE' : 'AI'} Mode`,
				'$(gear) Open Configuration',
			];

			// Add API key action if not set
			if (!hasApiKey) {
				actions.push('$(key) Set OpenAI API Key');
			}

			// Add test integration if in AI mode and has API key
			if (currentMode === 'AI' && hasApiKey) {
				actions.push('$(beaker) Test AI Integration');
			}

			const selection = await vscode.window.showQuickPick(actions, {
				placeHolder: `Changelogger Quick Actions (Current: ${currentMode} Mode)`,
				ignoreFocusOut: true
			});

			if (!selection) {
				return;
			}

			// Execute the selected action
			await this.executeQuickAction(selection);

		} catch (error) {
			console.error('[StatusBarService] Error showing quick actions:', error);
			vscode.window.showErrorMessage('Changelogger: Failed to show quick actions');
		}
	}

	/**
	 * Execute the selected quick action
	 * @param action The selected action string
	 */
	private async executeQuickAction(action: string): Promise<void> {
		try {
			console.log(`[StatusBarService] Executing quick action: ${action}`);

			if (action.includes('Generate Changelog')) {
				await vscode.commands.executeCommand('changelogger.generate');
			} else if (action.includes('Switch to')) {
				await vscode.commands.executeCommand('changelogger.toggleMode');
				// Update status bar after mode change
				this.updateStatusBar();
			} else if (action.includes('Open Configuration')) {
				await vscode.commands.executeCommand('changelogger.configure');
			} else if (action.includes('Set OpenAI API Key')) {
				await vscode.commands.executeCommand('changelogger.setApiKey');
				// Update status bar after API key change
				this.updateStatusBar();
			} else if (action.includes('Test AI Integration')) {
				// Execute test integration command (we'll add this to extension.ts)
				await vscode.commands.executeCommand('changelogger.testAI');
			}

		} catch (error) {
			console.error('[StatusBarService] Error executing quick action:', error);
			vscode.window.showErrorMessage(`Changelogger: Failed to execute action: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Show a temporary status message in the status bar
	 * @param message The message to show
	 * @param duration Duration in milliseconds (default: 3000)
	 */
	public showTemporaryMessage(message: string, duration: number = 3000): void {
		try {
			const originalText = this.statusBarItem.text;
			const originalTooltip = this.statusBarItem.tooltip;

			// Show temporary message
			this.statusBarItem.text = `$(info) ${message}`;
			this.statusBarItem.tooltip = message;

			// Restore original after duration
			setTimeout(() => {
				this.statusBarItem.text = originalText;
				this.statusBarItem.tooltip = originalTooltip;
			}, duration);

		} catch (error) {
			console.error('[StatusBarService] Error showing temporary message:', error);
		}
	}

	/**
	 * Hide the status bar item
	 */
	public hide(): void {
		this.statusBarItem.hide();
	}

	/**
	 * Show the status bar item
	 */
	public show(): void {
		this.statusBarItem.show();
	}

	/**
	 * Dispose of the status bar service
	 */
	public dispose(): void {
		try {
			console.log('[StatusBarService] Disposing status bar service');
			this.statusBarItem.dispose();
		} catch (error) {
			console.error('[StatusBarService] Error disposing status bar service:', error);
		}
	}
} 