import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Entry points: Specify the starting points for Knip's analysis
  entry: [
    'src/newtab.html',
    'src/options.html',
    'src/js/newTabPage.ts',
    'src/js/optionsPage.ts',
  ],
  // Project files: Define which files to analyze for unused code
  project: [
    'src/**/*.ts', // Include all TypeScript files in src/
  ],
  // Ignore directories or files
  ignore: [
    'dist/**',         // Ignore build output
    'dist_dev/**',         // Ignore build output
    'archive/**',        // Ignore test files
    'node_modules/**',     // Ignore coverage reports
    '**/*.d.ts',       // Ignore TypeScript declaration files
  ],
  // Optionally, ignore specific dependencies if needed
  ignoreDependencies: [
    // Add dependencies to ignore, e.g., 'some-package'
  ],
};

export default config;