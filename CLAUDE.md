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
```

## Architecture Overview

### Entry Points
- **main.js**: Legacy main process (simpler, direct implementation)
- **src/main-modular.js**: Modern modular main process (recommended for new features)
- **index.html**: Frontend interface with tabbed layout
- **renderer.js**: Frontend logic for UI interactions

### Core Modules (src/modules/)
- **TikTokManager**: Handles TikTok Live connection, chat events, and reconnection logic
- **PrinterManager**: Manages ESC/POS printer communication and print queue
- **UserManager**: Manages verified users list and user operations
- **MessageManager**: Handles chat message storage and filtering
- **NotificationManager**: System notifications and user feedback

### Services (src/services/)
- **DataService**: Centralized data management, file I/O, and statistics
- **FileManager**: File operations with backup functionality

### Configuration (src/config/)
- **app-config.js**: Centralized configuration for all modules

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

## File Organization

### Legacy Structure (main.js)
- All functionality in single file
- Direct IPC handler implementation
- Suitable for quick fixes and simple changes

### Modular Structure (src/)
- Separation of concerns by functionality
- Event-driven architecture using EventEmitter
- Singleton pattern for managers
- Easier testing and maintenance

## Common Development Tasks

### Adding New TikTok Events
1. Add event handler in `TikTokManager.setupEventListeners()`
2. Process data in dedicated handler method
3. Emit events via EventEmitter for UI updates

### Adding Print Features
1. Extend `PrinterManager.generatePrintData()` for new fields
2. Update print template in `executePrint()` method
3. Modify data storage schema if needed

### Adding New Users Features
1. Extend `UserManager` methods for new operations
2. Update `DataService` for persistence
3. Add corresponding IPC handlers in main process

## Important Notes

- Printer requires ESC/POS compatible thermal printer via USB
- TikTok connection depends on user "izatcolis" being live
- File operations include automatic .backup creation
- All modules use singleton pattern for state consistency
- Error handling includes graceful degradation when hardware unavailable