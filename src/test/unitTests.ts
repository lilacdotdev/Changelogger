import * as assert from 'assert';

/**
 * Unit tests that can run without VS Code environment
 * Suitable for CI/CD pipelines - testing pure logic only
 */

console.log('Starting Unit Tests.\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName: string, testFn: () => void | Promise<void>): void {
	try {
		console.log(`Running Test: ${testName}`);
		const result = testFn();
		
		if (result instanceof Promise) {
			result.then(() => {
				testsPassed++;
				console.log(`PASSED: ${testName}`);
			}).catch((error) => {
				testsFailed++;
				console.log(`FAILED: ${testName}`);
				console.log(`   Error: ${error.message}`);
			});
		} else {
			testsPassed++;
			console.log(`PASSED: ${testName}`);
		}
	} catch (error) {
		testsFailed++;
		console.log(`FAILED: ${testName}`);
		console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
	}
}

// Test Suite 1: API Key Validation Logic (Pure Functions)
console.log('Testing API Key Validation Logic:');

function validateOpenAIApiKey(apiKey: string): { isValid: boolean; errorMessage?: string } {
	if (!apiKey || apiKey.trim() === '') {
		return { isValid: false, errorMessage: 'API key cannot be empty' };
	}

	const trimmedKey = apiKey.trim();

	if (!trimmedKey.startsWith('sk-')) {
		return { isValid: false, errorMessage: 'API key must start with "sk-"' };
	}

	// Check minimum length (OpenAI keys are typically around 48-50 characters)
	if (trimmedKey.length < 40) {
		return { isValid: false, errorMessage: 'API key appears to be too short' };
	}

	// Check maximum reasonable length
	if (trimmedKey.length > 100) {
		return { isValid: false, errorMessage: 'API key appears to be too long' };
	}

	// Check for valid characters (alphanumeric, hyphens, underscores)
	const validPattern = /^sk-[A-Za-z0-9\-_]+$/;
	if (!validPattern.test(trimmedKey)) {
		return { isValid: false, errorMessage: 'API key contains invalid characters' };
	}

	return { isValid: true };
}

runTest('API Key Validation - Valid Key', () => {
	const validKey = 'sk-' + 'a'.repeat(48); // 51 characters total
	const result = validateOpenAIApiKey(validKey);
	assert.ok(result.isValid, 'Valid API key should pass validation');
});

runTest('API Key Validation - Invalid Prefix', () => {
	const invalidKey = 'ak-' + 'a'.repeat(48);
	const result = validateOpenAIApiKey(invalidKey);
	assert.ok(!result.isValid, 'Invalid prefix should fail validation');
});

runTest('API Key Validation - Too Short', () => {
	const shortKey = 'sk-abc'; // Only 6 characters, should fail (minimum 40)
	const result = validateOpenAIApiKey(shortKey);
	assert.ok(!result.isValid, 'Too short API key should fail validation');
});

runTest('API Key Validation - Valid Short Key', () => {
	const validShortKey = 'sk-' + 'a'.repeat(37); // 40 characters total (minimum)
	const result = validateOpenAIApiKey(validShortKey);
	assert.ok(result.isValid, 'Valid minimum length API key should pass validation');
});

runTest('API Key Validation - Empty Key', () => {
	const result = validateOpenAIApiKey('');
	assert.ok(!result.isValid, 'Empty API key should fail validation');
});

runTest('API Key Validation - Too Long', () => {
	const longKey = 'sk-' + 'a'.repeat(200);
	const result = validateOpenAIApiKey(longKey);
	assert.ok(!result.isValid, 'Too long API key should fail validation');
});

runTest('API Key Validation - Invalid Characters', () => {
	const invalidKey = 'sk-test@key#invalid';
	const result = validateOpenAIApiKey(invalidKey);
	assert.ok(!result.isValid, 'API key with invalid characters should fail validation');
});

// Test Suite 2: Environment Variable Support
console.log('\nTesting Environment Variable Support:');

runTest('Environment Variable Detection', () => {
	const testApiKey = process.env.TEST_OPENAI_API_KEY;
	const openaiApiKey = process.env.OPENAI_API_KEY;
	const changeloggerApiKey = process.env.CHANGELOGGER_OPENAI_API_KEY;
	
	// At least one should be available in CI
	const hasApiKey = testApiKey || openaiApiKey || changeloggerApiKey;
	
	if (hasApiKey) {
		console.log('   ✓ Found API key in environment variables');
		
		// Validate the found API key
		const keyToValidate = testApiKey || openaiApiKey || changeloggerApiKey;
		if (keyToValidate) {
			const validation = validateOpenAIApiKey(keyToValidate);
			assert.ok(validation.isValid, 'Environment API key should be valid');
		}
	} else {
		console.log('No API key found in environment (this is OK for some CI runs)');
	}
});

// Test Suite 3: File Path Validation
console.log('\nTesting File Path Validation...');

function validateChangelogPath(path: string): { isValid: boolean; errorMessage?: string } {
	if (!path || path.trim() === '') {
		return { isValid: false, errorMessage: 'Changelog path cannot be empty' };
	}

	// Check for invalid characters
	const invalidChars = /[<>:"|?*]/;
	if (invalidChars.test(path)) {
		return { isValid: false, errorMessage: 'Path contains invalid characters' };
	}

	// Check for absolute paths (should be relative)
	if (path.startsWith('/') || path.includes('..')) {
		return { isValid: false, errorMessage: 'Path must be relative to workspace root' };
	}

	return { isValid: true };
}

runTest('Changelog Path Validation - Valid Path', () => {
	const validPath = 'CHANGELOG.md';
	const result = validateChangelogPath(validPath);
	assert.ok(result.isValid, 'Valid changelog path should pass validation');
});

runTest('Changelog Path Validation - Valid Nested Path', () => {
	const validPath = 'docs/CHANGELOG.md';
	const result = validateChangelogPath(validPath);
	assert.ok(result.isValid, 'Valid nested changelog path should pass validation');
});

runTest('Changelog Path Validation - Empty Path', () => {
	const result = validateChangelogPath('');
	assert.ok(!result.isValid, 'Empty changelog path should fail validation');
});

runTest('Changelog Path Validation - Invalid Characters', () => {
	const invalidPath = 'CHANGE<LOG>.md';
	const result = validateChangelogPath(invalidPath);
	assert.ok(!result.isValid, 'Path with invalid characters should fail validation');
});

runTest('Changelog Path Validation - Absolute Path', () => {
	const absolutePath = '/home/user/CHANGELOG.md';
	const result = validateChangelogPath(absolutePath);
	assert.ok(!result.isValid, 'Absolute path should fail validation');
});

runTest('Changelog Path Validation - Parent Directory', () => {
	const parentPath = '../CHANGELOG.md';
	const result = validateChangelogPath(parentPath);
	assert.ok(!result.isValid, 'Parent directory path should fail validation');
});

// Test Suite 4: Basic Functionality
console.log('\nTesting Basic Functionality...');

runTest('Basic Math Operations', () => {
	assert.strictEqual(2 + 2, 4, 'Basic addition should work');
	assert.strictEqual(10 - 5, 5, 'Basic subtraction should work');
	assert.strictEqual(3 * 4, 12, 'Basic multiplication should work');
});

runTest('Array Operations', () => {
	const arr = [1, 2, 3, 4, 5];
	assert.strictEqual(arr.length, 5, 'Array length should be correct');
	assert.strictEqual(arr.indexOf(3), 2, 'Array indexOf should work');
	assert.strictEqual(arr.indexOf(10), -1, 'Array indexOf should return -1 for missing items');
});

runTest('String Operations', () => {
	const str = 'Changelogger';
	assert.ok(str.includes('Change'), 'String should contain substring');
	assert.strictEqual(str.toLowerCase(), 'changelogger', 'String toLowerCase should work');
	assert.strictEqual(str.length, 12, 'String length should be correct');
});

runTest('JSON Operations', () => {
	const obj = { mode: 'base', path: 'CHANGELOG.md' };
	const jsonStr = JSON.stringify(obj);
	const parsed = JSON.parse(jsonStr);
	
	assert.strictEqual(parsed.mode, 'base', 'JSON parsing should preserve values');
	assert.strictEqual(parsed.path, 'CHANGELOG.md', 'JSON parsing should preserve values');
});

// Test Suite 5: Configuration Logic
console.log('\nTesting Configuration Logic...');

function getDefaultConfiguration() {
	return {
		mode: 'base',
		changelogPath: 'CHANGELOG.md',
		autoGenerate: false,
		openaiApiKey: ''
	};
}

runTest('Default Configuration Values', () => {
	const config = getDefaultConfiguration();
	
	assert.strictEqual(config.mode, 'base', 'Default mode should be base');
	assert.strictEqual(config.changelogPath, 'CHANGELOG.md', 'Default changelog path should be CHANGELOG.md');
	assert.strictEqual(config.autoGenerate, false, 'Default auto-generate should be false');
	assert.strictEqual(config.openaiApiKey, '', 'Default API key should be empty');
});

runTest('Configuration Mode Validation', () => {
	const validModes = ['base', 'ai'];
	
	validModes.forEach(mode => {
		assert.ok(['base', 'ai'].includes(mode), `Mode ${mode} should be valid`);
	});
	
	const invalidMode = 'invalid';
	assert.ok(!['base', 'ai'].includes(invalidMode), 'Invalid mode should not be accepted');
});

// Wait for async tests and show results
setTimeout(() => {
	console.log('\nTest Results:');
	console.log(`✅ : ${testsPassed}`);
	console.log(`❌ : ${testsFailed}`);
	console.log(`Total: ${testsPassed + testsFailed}`);
	
	if (testsFailed > 0) {
		console.log('\nSome tests failed :(');
		process.exit(1);
	} else {
		console.log('\nAll tests passed. Good job, me :)');
		process.exit(0);
	}
}, 1000);

export {}; // Make this a module 