# Testing Setup for TabList2

This directory contains the test suite for the TabList2 Chrome extension, focusing on unit tests for utility functions and core logic.

## Test Structure

```
tests/
├── unit/
│   └── lib/
│       ├── colors.test.ts      # Tests for color utilities and gradient generation
│       ├── constants.test.ts   # Tests for configuration constants and types
│       └── utils.test.ts       # Tests for utility functions
└── README.md
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

Current coverage for tested modules:
- **constants.ts**: 100% coverage
- **colors.ts**: 95.89% coverage
- **utils.ts**: 72.22% coverage

## What's Tested

### Utils Module (`utils.test.ts`)
- **`isSecureUrl()`**: URL protocol validation for HTTPS, Chrome, Chrome-extension, and file protocols
- **`hexToRGBA()`**: Hex color to RGBA conversion with opacity
- **`normalizeHexRGB()`**: Hex color normalization (3-digit to 6-digit)
- **`hours()` & `days()`**: Time conversion utilities

### Colors Module (`colors.test.ts`)
- **`COLOR_MAP`**: Color constant validation
- **`ColorMapGrad`**: Gradient generation testing
- **Color format consistency**: Hex format validation
- **Gradient structure**: 5-color gradient arrays with original color in middle

### Constants Module (`constants.test.ts`)
- **`DEFAULT_OPTIONS`**: Default configuration validation
- **`KEY_OPTIONS`**: Options key array completeness
- **`RESTRICTED_KEYS`**: Restricted keys validation
- **Type definitions**: TypeScript interface compliance

## Test Framework

- **Jest**: Test runner and assertion library
- **ts-jest**: TypeScript support for Jest
- **jest-webextension-mock**: Chrome extension API mocking
- **jsdom**: DOM environment for browser-like testing

## Configuration

Tests are configured via:
- `jest.config.js`: Main Jest configuration
- `tsconfig.json`: TypeScript compilation settings
- `package.json`: Test scripts and dependencies

## Adding New Tests

### For Pure Functions
1. Create a new test file in the appropriate directory
2. Import the functions to test
3. Write describe blocks for each function
4. Add test cases covering:
   - Happy path scenarios
   - Edge cases
   - Error conditions
   - Input validation

### Example Test Structure
```typescript
import { myFunction } from '../../../src/js/lib/myModule';

describe('myModule', () => {
  describe('myFunction', () => {
    it('should handle normal input', () => {
      expect(myFunction('input')).toBe('expected');
    });

    it('should handle edge cases', () => {
      expect(myFunction('')).toBe('default');
    });

    it('should throw on invalid input', () => {
      expect(() => myFunction(null)).toThrow();
    });
  });
});
```

## Future Testing Plans

### Next Steps
1. **Chrome API Integration Tests**: Test functions that use Chrome APIs with proper mocking
2. **Manager Class Tests**: Test TabManager, UIManager, GroupManager, etc.
3. **Integration Tests**: Test component interactions
4. **E2E Tests**: Browser automation tests for full user workflows

### Testing Strategy
- **Unit Tests**: Pure functions and isolated logic (current focus)
- **Integration Tests**: Component interactions and data flow
- **E2E Tests**: Full user scenarios in browser environment
- **Performance Tests**: Memory usage and execution time validation

## Best Practices

1. **Test Naming**: Use descriptive test names that explain the scenario
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Edge Cases**: Always test boundary conditions and error scenarios
4. **Mocking**: Mock external dependencies (Chrome APIs, DOM, etc.)
5. **Coverage**: Aim for high coverage but focus on meaningful tests
6. **Maintainability**: Keep tests simple and focused on single behaviors

## Troubleshooting

### Common Issues

**TypeScript Errors**: Ensure proper type imports and mocking
```typescript
// Mock modules that aren't available in test environment
jest.mock('../../../src/js/lib/logging', () => ({
  logError: jest.fn(),
}));
```

**Chrome API Errors**: Use jest-webextension-mock for Chrome API simulation
```typescript
// Chrome APIs are automatically mocked by jest-webextension-mock
expect(chrome.runtime.getURL).toBeDefined();
```

**Import Errors**: Check module paths and ensure files exist
```typescript
// Use relative paths from test file to source
import { myFunction } from '../../../src/js/lib/myModule';
