# TabList 2

A powerful, performance-oriented tab manager designed for users who frequently handle hundreds of browser tabs. This extension overrides the default new tab page, providing a clean, organized, and searchable list of all your open tabs and tab groups.

## Key Features

-   **Comprehensive Tab Listing:** View all your open tabs in a single, streamlined interface.
-   **Full Tab Group Management:** Native support for creating, collapsing, and managing tab groups. Group states are saved and can be synced across sessions.
-   **Performance Focused:** Includes an option to automatically discard tabs that haven't been accessed for a configurable period, saving memory.
-   **Customizable Themes:** Supports both light and dark modes, with additional styling options to personalize your view.
-   **Rich Tab Details:** See at-a-glance which tabs are audible, pinned, or running in an incognito window. Timestamps for the last access time are also available.
-   **Efficient Navigation:** Full keyboard navigation support and drag-and-drop functionality to reorder tabs and groups.

## Development

To get started with development, follow these steps.

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd TabList2_ts
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running in Development Mode

1.  **Start the development server:**
    ```bash
    npm start
    ```
    This command uses Parcel to watch for file changes and builds the extension into the `dist_dev` directory.

2.  **Load the unpacked extension in your browser:**
    -   Open Chrome/Edge and navigate to `chrome://extensions`.
    -   Enable "Developer mode" (usually a toggle in the top-right corner).
    -   Click "Load unpacked".
    -   Select the `dist_dev` folder from the project directory.

The extension will now be active, and any changes you make to the source code will trigger a rebuild automatically.

### Building for Production

To create an optimized production build, run:

```bash
npm run build
```

This command builds the extension and places the final, minified files in the `dist` directory, ready for packaging and distribution.

## Technology Stack

-   **Manifest V3:** Built on the latest Chrome Extension platform for enhanced security and performance.
-   **TypeScript:** For robust, type-safe JavaScript.
-   **Parcel:** Used as the module bundler for a fast, zero-config development experience.
-   **HTML5 & CSS3:** For the structure and styling of the extension's pages.