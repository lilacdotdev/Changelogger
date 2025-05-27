import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';
import { GitService } from '../git/gitService';
import { ConfigurationManager } from '../config/configurationManager';
import { ValidationUtils } from '../utils/validation';

suite('Changelogger Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting Changelogger extension tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('undefined_publisher.changelogger'));
	});

	test('Commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		
		// Check that our commands are registered
		assert.ok(commands.includes('changelogger.generate'), 'Generate command should be registered');
		assert.ok(commands.includes('changelogger.configure'), 'Configure command should be registered');
		assert.ok(commands.includes('changelogger.setApiKey'), 'Set API Key command should be registered');
		assert.ok(commands.includes('changelogger.toggleMode'), 'Toggle Mode command should be registered');
		assert.ok(commands.includes('changelogger.testAI'), 'Test AI command should be registered');
	});

	test('GitService singleton should work', () => {
		const gitService1 = GitService.getInstance();
		const gitService2 = GitService.getInstance();
		
		assert.strictEqual(gitService1, gitService2, 'GitService should be a singleton');
	});

	test('ConfigurationManager singleton should work', () => {
		const configManager1 = ConfigurationManager.getInstance();
		const configManager2 = ConfigurationManager.getInstance();
		
		assert.strictEqual(configManager1, configManager2, 'ConfigurationManager should be a singleton');
	});

	test('Configuration should have default values', () => {
		const configManager = ConfigurationManager.getInstance();
		const config = configManager.getConfiguration();
		
		assert.strictEqual(config.mode, 'base', 'Default mode should be base');
		assert.strictEqual(config.changelogPath, 'CHANGELOG.md', 'Default changelog path should be CHANGELOG.md');
		assert.strictEqual(config.autoGenerate, false, 'Default auto-generate should be false');
	});

	test('API key validation should work correctly', () => {
		// Test valid API key
		const validKey = 'sk-' + 'a'.repeat(48); // 51 characters total
		const validResult = ValidationUtils.validateOpenAIApiKey(validKey);
		assert.ok(validResult.isValid, 'Valid API key should pass validation');

		// Test invalid API key (wrong prefix)
		const invalidPrefix = 'ak-' + 'a'.repeat(48);
		const invalidPrefixResult = ValidationUtils.validateOpenAIApiKey(invalidPrefix);
		assert.ok(!invalidPrefixResult.isValid, 'Invalid prefix should fail validation');

		// Test invalid API key (too short)
		const tooShort = 'sk-abc';
		const tooShortResult = ValidationUtils.validateOpenAIApiKey(tooShort);
		assert.ok(!tooShortResult.isValid, 'Too short API key should fail validation');

		// Test empty API key
		const emptyResult = ValidationUtils.validateOpenAIApiKey('');
		assert.ok(!emptyResult.isValid, 'Empty API key should fail validation');
	});

	test('VS Code workspace validation should work', () => {
		const workspaceValidation = ValidationUtils.validateVSCodeWorkspace();
		// This should pass in the test environment
		assert.ok(workspaceValidation.isValid, 'VS Code workspace should be valid in test environment');
	});

	test('Sample arithmetic test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
		assert.strictEqual(2, [1, 2, 3].indexOf(3));
	});
});
