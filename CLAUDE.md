# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TikTok Live Manager is an Electron desktop application for managing TikTok Live streams and printing package labels for IzatColis. The application connects to TikTok Live chat, manages verified users, and integrates with ESC/POS thermal printers for label printing.

## Key Technologies

- **Electron 27** with Node.js backend and HTML/CSS/JS frontend
- **TikTok Live Connector** for real-time chat integration
- **ESC/POS Printer Support** via `@node-escpos` modules
- **Modular Architecture** with separate managers for different functionalities
- **JSON File Storage** for user data and print history

## Development Commands

```bash
# Development
npm run dev              # Start in development mode with DevTools
npm start                # Start in production mode

# Building
npm run build           # Build for current platform
npm run build-win       # Build for Windows (NSIS installer)
npm run build-mac       # Build for macOS (DMG)
npm run build-linux     # Build for Linux (AppImage)

# Publishing (with auto-updater)
npm run build-publish           # Build and publish for current platform
npm run build-publish-win       # Build and publish for Windows
npm run build-publish-mac       # Build and publish for macOS
npm run build-publish-linux     # Build and publish for Linux
```

## Architecture Overview

### Entry Points
- **main.js**: Legacy main process (simpler, direct implementation)
- **src/main-modular.js**: Modern modular main process (recommended for new features)
- **index.html**: Frontend interface with tabbed layout
- **renderer.js**: Frontend logic for UI interactions

### Core Modules (src/modules/)
- **TikTokManager**: Handles TikTok Live connection, chat events, automatic reconnection with exponential backoff
- **PrinterManager**: Manages ESC/POS printer communication, print queue system, and reference generation
- **UserManager**: Manages verified users list with validation (alphanumeric, dots, underscores, 1-30 chars)
- **MessageManager**: Processes chat messages, detects commands (!print, !adduser, !stats), provides enrichment
- **NotificationManager**: Centralizes system notifications with auto-removal timers
- **UpdateManager**: Handles OTA updates with private repository support via GitHub token

### Services (src/services/)
- **DataService**: Central data hub managing all persistence, statistics, and Set↔Array conversions
- **FileManager**: File operations with atomic writes and automatic backup (.backup files)

### Utilities (src/utils/)
- **EventEmitter**: Central event bus for inter-module communication
- **Logger**: Structured logging with different levels for development/production

### Configuration (src/config/)
- **app-config.js**: Centralized configuration for all modules and services
- **update-config.js**: OTA update configuration with GitHub token and custom server support

### Data Storage
- **data/verified-users.json**: List of verified TikTok users (Set converted to Array)
- **data/print-data.json**: Print history with counter and transaction records

## Key Features

### TikTok Live Integration
- Auto-connects to "izatcolis" TikTok Live stream
- Real-time chat message processing with verified user highlighting
- Automatic reconnection with exponential backoff
- Message filtering and statistics tracking

### Printer Integration
- ESC/POS thermal printer support via USB
- Print queue management for concurrent requests
- Automatic reference generation (REF-####)
- Print history tracking with timestamps

### User Management
- Verified users system with golden badge display
- Add/remove users with real-time updates
- Default user: "vonix.xz"

### Data Persistence
- JSON file storage with automatic backup (.backup files)
- Real-time data saving on changes
- Error handling with fallback to defaults

## IPC Communication

Main process handles these IPC channels:
- `connect-tiktok` / `disconnect-tiktok`: TikTok Live connection
- `add-verified-user` / `remove-verified-user`: User management
- `print-label` / `test-printer`: Printing operations
- `get-initial-data` / `get-stats`: Data retrieval

Frontend receives these events:
- `new-message`: Real-time chat messages
- `stats-update`: Application statistics
- `connection-status`: TikTok connection state
- `print-completed`: Print job completion

## Architecture Patterns

### Singleton Pattern
- All modules and services implemented as singletons
- Pattern: `const instance = new ClassName(); module.exports = instance;`
- Ensures consistent state across the application

### Event-Driven Communication
- Central EventEmitter for inter-module communication
- Modules emit events using `module:action` format
- Loose coupling between modules through events
- Main process forwards events to renderer via `sendToRenderer`

### Data Flow Pattern
```
TikTok Live → TikTokManager → MessageManager → DataService → FileManager
                  ↓              ↓                ↓
EventEmitter → NotificationManager → UI Renderer
```

### Error Handling Strategy
- Graceful degradation when hardware (printer) unavailable
- Conditional module loading to prevent build errors
- Try-catch blocks with specific error types and structured logging
- EventEmitter for error propagation across modules

### File Organization

#### Legacy Structure (main.js)
- All functionality in single file with direct IPC handlers
- Suitable for quick fixes and simple changes
- Auto-loads TikTok and printer modules with fallback handling

#### Modular Structure (src/)
- Event-driven architecture with separation of concerns
- Centralized configuration and logging
- Atomic file operations with backup functionality

## Command System

### Chat Commands (Verified Users Only)
- `!print pseudo amount description`: Triggers label printing with validation
- `!adduser username`: Adds user to verified list with validation
- `!stats`: Shows application statistics
- Commands processed in `MessageManager` with real-time execution

### Print System
- Asynchronous print queue prevents blocking operations
- Reference generation: REF-#### format with padded counter
- ESC/POS thermal printer via USB with automatic availability checks
- Print history tracking with timestamps and transaction records

### User Validation
- Username rules: alphanumeric, dots, underscores, 1-30 characters
- Verified users stored as Set in memory, Array in JSON for persistence
- Default verified user: "vonix.xz"

## OTA Update System

### Configuration Requirements
- Public repository: Hassan-JERRAR/Tiktok_live_manager
- No GitHub token required (repo is now public)
- Auto-updater checks every 24 hours by default
- Optional custom update server support via environment variables

### Update Flow
1. UpdateManager checks for releases via GitHub API (no authentication needed)
2. Downloads updates using custom implementation or electron-updater
3. Prompts user for installation on app quit
4. Supports prerelease and custom update servers
5. Automatically detects platform and architecture for correct asset selection

## Important Notes

- **Hardware Dependencies**: Printer requires ESC/POS compatible thermal printer via USB
- **TikTok Dependency**: Connection requires user "izatcolis" to be live on TikTok
- **Data Persistence**: Automatic .backup file creation for all JSON operations
- **Module Loading**: Conditional loading prevents build errors when dependencies unavailable
- **Development Mode**: Use `npm run dev` to enable DevTools and detailed logging