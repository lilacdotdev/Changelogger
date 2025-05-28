<img src=".github/readme_banner.png">
# ChangeLogger

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build Status](https://github.com/lilacdotdev/Changelogger/workflows/tests/badge.svg)

> Automatically generate changelog entries from git commits with optional AI-powered summaries

Transform your development workflow by automatically generating comprehensive changelog entries every time you commit. This VS Code extension captures git changes and creates formatted changelog entries with commit details, file changes, and AI-powered summaries of your modifications.

## ✨ Features

### 🚀 Automatic Changelog Generation
- **Git Integration**: Automatically triggers on git commits
- **Commit Tracking**: Captures author, message, and timestamp
- **File Change Detection**: Shows added (+), modified (*), and deleted (-) files
- **Smart Formatting**: Clean, readable, uniform changelog entries

### 🤖 AI-Powered Mode
- **OpenAI Integration**: Intelligent summaries of code changes
- **Context-Aware**: Understands what functionality was added, modified, or removed
- **Concise Summaries**: 2-sentence summaries of complex changes
- **Smart Error Handling**: User-friendly dialogs for billing, authentication, and rate limit issues
- **Automatic Fallbacks**: Gracefully switches to base mode when AI is unavailable
- **Quota Management**: Clear guidance when API limits are reached

### 🛡️ Base Changes Mode
- **No Dependencies**: Works without external APIs
- **Complete Offline**: Full functionality without internet connection
- **Essential Information**: Git user, commit message, and file structure changes
- **Reliable Fallback**: Automatic switching when AI mode is unavailable
- **Always Available**: Never fails due to network or billing issues

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Changelogger"
4. Click **Install**

### From Source
```
git clone https://github.com/lilacdotdev/Changelogger.git
cd Changelogger
npm install
npm run compile
code --install-extension ./Changelogger-*.vsix
```

## 🚀 Quick Start

### First-Time Setup
1. **Install the extension**
2. **Choose your mode**:
   - **AI-Powered Mode**: Enter your OpenAI API key when prompted
   - **Base Changes Mode**: Skip API key setup for basic functionality

### Using the Extension
1. Make changes to your code
2. Commit your changes as usual: `git commit -m "Your commit message"`
3. The extension automatically generates a changelog entry in `Changelog.md`

That's it! Your changelog is automatically maintained.

## 📖 Usage Examples

### Base Changes Mode Output
```markdown
## [2024-03-15 14:30:22] - John Doe <john@example.com>
**Commit**: Add user authentication system

**File Changes:**
+ src/auth/login.ts
+ src/auth/register.ts
* src/app.ts
* package.json
- src/temp-auth.js

---
```

### AI-Powered Mode Output
```markdown
## [2024-03-15 14:30:22] - John Doe <john@example.com>
**Commit**: Add user authentication system

**File Changes:**
+ src/auth/login.ts
+ src/auth/register.ts
* src/app.ts
* package.json
- src/temp-auth.js

**Summary**: Implemented comprehensive user authentication system with login and registration functionality. Integrated new auth system into main application and removed temporary authentication solution.

---
```

## ⚙️ Configuration

### Extension Settings
Access via `File > Preferences > Settings` and search for "Changelogger"

| Setting | Description | Default |
|---------|-------------|---------|
| `Changelogger.openaiApiKey` | OpenAI API key for AI summaries | `""` |
| `Changelogger.mode` | Operating mode (`base` or `ai`) | `"base"` |
| `Changelogger.changelogPath` | Custom changelog file path | `"Changelog.md"` |
| `Changelogger.autoGenerate` | Generate on every commit | `true` |
| `Changelogger.maxSummaryLength` | Max AI summary sentences | `2` |

### Commands
Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)

| Command | Description |
|---------|-------------|
| `Changelogger: Document Changes` | Manually generate changelog entry |
| `Changelogger: Open Configuration` | Open configuration panel |
| `Changelogger: Set OpenAI API Key` | Set/update OpenAI API key |
| `Changelogger: Toggle Mode (Base/AI)` | Switch between Base and AI modes |
| `Changelogger: Test AI Integration` | Test AI functionality and connection |

## 🔧 API Key Setup

### Getting an OpenAI API Key
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key

### Setting Up in VS Code
**Method 1: First-time prompt**
- The extension will prompt you on first use, just plug it in and you're good!

**Method 2: Command Palette**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Changelogger: Set OpenAI API Key"
3. Paste your API key

**Method 3: Settings**
1. Go to VS Code Settings
2. Search for "Changelogger.openaiApiKey"
3. Enter your API key

> 🔒 **Security**: API keys are securely stored using VS Code's built-in secret storage.

### 🚨 Troubleshooting API Issues
The extension provides helpful error dialogs when API issues occur:
- **Quota Exceeded**: Direct link to check your OpenAI billing
- **Invalid API Key**: Easy access to update your key or check your OpenAI account
- **Rate Limits**: Clear guidance on when to retry
- **Model Access**: Help with account permissions

All error dialogs offer the option to automatically switch to Base Mode as a fallback!

## 🛠️ Development

### Prerequisites
- Node.js 16+ 
- VS Code 1.70+
- Git

### Setup Development Environment
```
# Clone repository
git clone https://github.com/lilacdotdev/Changelogger.git
cd Changelogger

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Start development
npm run watch
```

### Project Structure
```
src/
├── extension.ts              # Main extension entry point
├── git/
│   ├── gitService.ts        # Git operations and repository detection
│   ├── gitDataExtractor.ts  # Extract commit data and file changes
│   └── gitHookIntegration.ts # Automatic commit detection
├── changelog/
│   └── changelogGenerator.ts # Core changelog generation and formatting
├── ai/
│   ├── openaiService.ts     # OpenAI API integration with error handling
│   └── aiIntegrationService.ts # AI service coordination and testing
├── config/
│   └── configurationManager.ts # Extension configuration and validation
├── ui/
│   └── statusBar.ts         # Status bar integration and user feedback
├── utils/
│   ├── validation.ts        # Input validation and error checking
│   └── fileUtils.ts         # File system operations
└── test/                    # Comprehensive test suite
```

### Running Tests
```
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🤝 Contributing

Contributions are welcome! Please feel free to make any improvements you may wish! This is a tool made by a dev for fellow devs so please feel free to change/suggest it to your heart's content!

### How to Contribute
1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Guidelines
- Write tests for new features
- Follow TypeScript best practices
- Update documentation for API changes
- Be clear with any documentation you make! It's going to help everyone!

## 🐛 Troubleshooting

### Common Issues

**Extension not activating**
- Ensure VS Code version 1.70+
- Check if workspace contains a git repository
- Restart VS Code

**API key not working**
- Verify API key format (starts with `sk-`)
- Check OpenAI account has available credits
- Test API key at [OpenAI Playground](https://platform.openai.com/playground)
- Use the "Test AI Integration" command to diagnose issues

**Changelog not generating**
- Ensure you're in a git repository
- Check file permissions for `Changelog.md` <- very important! It's happened to me a few times and drove me NUTS
- Verify workspace folder access
- Check the status bar for current mode and configuration

**AI summaries not working**
- Check internet connection
- Verify API key is correctly set
- Look for helpful error dialogs that guide you to solutions
- Extension automatically falls back to Base mode
- Use "Test AI Integration" to check your setup

### Getting Help
- 📖 Check our [Documentation](https://github.com/lilacdotdev/Changelogger/wiki)
- 🐛 Report bugs via [GitHub Issues](https://github.com/lilacdotdev/Changelogger/issues)
- 💬 Join discussions in [GitHub Discussions](https://github.com/lilacdotdev/Changelogger/discussions)

## 📋 Requirements

### System Requirements
- **VS Code**: Version 1.70.0 or higher
- **Git**: Installed and accessible from command line
- **Node.js**: 16.0.0+ (for development)

### Optional Requirements
- **OpenAI API Key**: For AI-powered summaries
- **Internet Connection**: For AI mode functionality

## 🗺️ Roadmap

### Version 1.1.0
- [x] Enhanced error handling with user-friendly dialogs
- [x] Comprehensive API error management
- [x] Status bar integration with real-time feedback
- [ ] Custom changelog templates
- [ ] Commit filtering options (.clogignore)

### Version 1.2.0
- [ ] Integration with other AI providers
- [ ] Individualized diff analysis (as in change-by-change summaries)
- [ ] Changelog statistics and insights
- [ ] Automated release notes generation
- [ ] Advanced configuration options

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.</br>
AI can make mistakes. Be warned not everything done will be 100% accurate. Please check to make sure and use your brain, this is only a tool!

## 🙏 Acknowledgments

- **VS Code Team** - For the excellent extension API and development tools
- **OpenAI** - For the powerful language model API
- **simple-git** - For reliable git operations
- **TypeScript Community** - For the amazing type safety and developer experience
- **Contributors** - Anyone who catches the bugs I didnt or adds any fixes! Love y'all <3

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/lilacdotdev/Changelogger?style=social)
![GitHub forks](https://img.shields.io/github/forks/lilacdotdev/Changelogger?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/lilacdotdev/Changelogger?style=social)

---

<div align="center">

**Made with lots of love for documentation**

[🐛 Report Bug](https://github.com/lilacdotdev/Changelogger/issues) • 
[✨ Request Feature](https://github.com/lilacdotdev/Changelogger/issues) • 
[💬 Join Discussion](https://github.com/lilacdotdev/Changelogger/discussions)

</div>