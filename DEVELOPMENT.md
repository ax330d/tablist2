# TabList Development Guide

This document contains technical information for developers who want to contribute to TabList or understand its architecture.

## 🛠️ Development Setup

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)
- **Chrome/Chromium browser** for testing

### Getting Started

1. **Clone the repository:**
   ```bash
   git clone git@github.com:ax330d/tablist2.git
   cd TabList2_ts
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development mode:**
   ```bash
   npm start
   ```
   This command uses Parcel to watch for file changes and builds the extension into the `dist_dev` directory.

### Manual Installation (Development/Testing)

1. **Load the unpacked extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in the top-right corner)
   - Click "Load unpacked"
   - Select the `dist_dev` folder from the project directory

2. **Development workflow:**
   - The extension will automatically rebuild when you make changes
   - Refresh the extension in `chrome://extensions` if needed
   - Open a new tab to see your changes

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` directory with:
- Minified JavaScript and CSS
- No source maps
- All assets copied to the correct locations
- Ready for packaging and distribution

## 🏗️ Project Architecture

### Directory Structure

```
src/
├── manifest.json          # Extension manifest (Manifest V3)
├── newtab.html            # Main new tab page
├── options.html           # Options/settings page
├── assets/                # Static assets
│   ├── icons/            # Extension icons
│   ├── images/           # UI images
│   └── fonts/            # Material Symbols font
├── css/                   # Stylesheets
│   ├── common.css        # Shared styles
│   ├── newtab.css        # New tab page styles
│   └── options.css       # Options page styles
├── html/                  # HTML templates and components
│   ├── about.html        # About dialog
│   ├── newtab-*.html     # New tab page components
│   └── options-*.html    # Options page components
└── js/                    # TypeScript source code
    ├── newTabPage.ts     # Main new tab page logic
    ├── optionsPage.ts    # Options page logic
    ├── theme-preload.ts  # Theme initialization
    └── lib/              # Core modules
        ├── TabManager.ts     # Tab operations and state
        ├── GroupManager.ts   # Tab group management
        ├── UIManager.ts      # UI rendering and updates
        ├── DragDropManager.ts # Drag and drop functionality
        ├── DialogManager.ts  # Modal dialogs and popups
        ├── EventListenerManager.ts # Event handling
        ├── Favicons.ts       # Favicon loading and caching
        ├── colors.ts         # Color utilities and themes
        ├── constants.ts      # Configuration and types
        ├── logging.ts        # Debug logging utilities
        ├── popup.ts          # Popup/modal utilities
        └── utils.ts          # General utility functions
```

### Key Modules

#### **TabManager.ts**
- Interfaces with Chrome's tabs API
- Manages tab state and operations (close, discard, reload)
- Handles tab selection and bulk operations
- Provides tab filtering and sorting

#### **GroupManager.ts**
- Manages Chrome tab groups
- Handles group creation, modification, and deletion
- Syncs group states between browser and extension
- Manages group folding/expanding

#### **UIManager.ts**
- Renders the tab list interface
- Updates UI in response to tab/group changes
- Manages visual states (selection, focus, hover)
- Handles theme application and transitions

#### **DragDropManager.ts**
- Implements drag-and-drop functionality
- Supports both mouse and keyboard-driven dragging
- Handles tab reordering within and between groups
- Provides visual feedback during drag operations

#### **EventListenerManager.ts**
- Centralizes event handling across the application
- Manages keyboard shortcuts and navigation
- Handles Chrome extension events (tab updates, group changes)
- Provides event cleanup and memory management

## 🔧 Technology Stack

### Core Technologies
- **Manifest V3** - Latest Chrome Extension platform
- **TypeScript** - Type-safe JavaScript with modern features
- **HTML5 & CSS3** - Modern web standards
- **Chrome Extensions API** - tabs, tabGroups, storage, favicon permissions

### Build Tools
- **Parcel** - Zero-config module bundler and development server
- **PostHTML** - HTML processing with includes and templating
- **TypeScript Compiler** - Type checking and compilation

### Development Tools
- **ESLint** - Code linting and style enforcement
- **Knip** - Unused code detection
- **Stylelint** - CSS linting and formatting

### Key Dependencies
- **@types/chrome** - TypeScript definitions for Chrome APIs
- **Material Symbols** - Google's icon font for UI elements
- **Ubuntu Font Family** - Typography for consistent appearance

## 📝 Code Style & Standards

### TypeScript Guidelines
- Use strict type checking
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Document public APIs with JSDoc comments
- Avoid `any` type - use proper typing

### CSS Guidelines
- Use CSS custom properties for theming
- Follow BEM-like naming conventions
- Organize styles by component/page
- Use semantic HTML elements with proper ARIA labels

### File Organization
- One class/major function per file
- Group related functionality in modules
- Use barrel exports from lib/ directory
- Keep HTML templates separate from logic

## 🧪 Testing

### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] New tab page displays all open tabs
- [ ] Tab groups show correctly with proper colors
- [ ] Keyboard navigation works for all features
- [ ] Drag and drop functions properly
- [ ] Theme switching works in both pages
- [ ] Options save and apply correctly
- [ ] Incognito mode works properly

### Browser Compatibility
- **Primary**: Chrome (latest stable)
- **Secondary**: Chrome Beta, Chrome Dev
- **Tested**: Chromium-based browsers (Edge, Brave)

### Testing Different Scenarios
- Test with 1, 10, 100+ tabs open
- Test with multiple tab groups
- Test with pinned tabs and audio tabs
- Test in incognito mode
- Test with different screen sizes
- Test keyboard-only navigation

## 🤝 Contributing

### License Agreement
TabList is licensed under GPL v3.0 or later. By contributing to this project, you agree that your contributions will be licensed under the same terms. This ensures that all improvements remain open source and benefit the entire community.

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with proper TypeScript types
4. Test thoroughly with the manual testing checklist
5. Run linting: `npm run knip` (when available)
6. Commit with descriptive messages
7. Push and create a pull request

### Code Review Guidelines
- Ensure TypeScript compilation passes
- Verify no new linting errors
- Test functionality in development mode
- Check accessibility with keyboard navigation
- Verify theme switching works properly

### Bug Reports
When reporting bugs, include:
- Chrome version and OS
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)
- Number of tabs/groups when issue occurred

## 🚀 Release Process

### Version Management
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Update version in both `package.json` and `manifest.json`
- Tag releases in git: `git tag v2.0.1`

### Build Process
1. Run production build: `npm run build`
2. Test the `dist` folder thoroughly
3. Package for Chrome Web Store submission
4. Update release notes with new features and fixes

### Distribution
- **Chrome Web Store** - Primary distribution channel
- **GitHub Releases** - Source code and development builds
- **Manual Installation** - For development and testing

## 🐛 Debugging

### Common Issues
- **Tabs not updating**: Check Chrome extension permissions
- **Keyboard shortcuts not working**: Verify focus states and event listeners
- **Theme not applying**: Check CSS custom property inheritance
- **Drag and drop issues**: Verify event propagation and state management

### Debug Tools
- Chrome DevTools for the extension pages
- `chrome://extensions` for extension management
- Console logging via `logging.ts` utilities
- Chrome's extension error reporting

### Performance Considerations
- Tab list rendering with hundreds of tabs
- Memory usage with favicon caching
- Event listener cleanup to prevent memory leaks
- Efficient DOM updates for real-time tab changes

---

*For questions about development, check the main README or open an issue on GitHub.*
