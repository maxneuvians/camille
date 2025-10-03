# Testing Guide

This document describes the testing infrastructure for the Camille project.

## Overview

The project includes comprehensive test coverage for both backend and frontend:

- **Backend**: 29 tests using Jest
- **Frontend**: 15 tests using Vitest and React Testing Library
- **Total**: 44 automated tests

## Running Tests

### All Tests

```bash
# Run all tests (backend + frontend)
npm test
```

### Backend Tests

```bash
# Run backend tests
npm run test:backend

# Run backend tests in watch mode
npm run test:watch --workspace=backend

# Generate coverage report
npm run test:coverage --workspace=backend
```

### Frontend Tests

```bash
# Run frontend tests
npm run test:frontend

# Run frontend tests in watch mode
npm run test:watch --workspace=frontend

# Run tests with UI
npm run test:ui --workspace=frontend

# Generate coverage report
npm run test:coverage --workspace=frontend
```

## Test Coverage

### Backend Tests

**Location**: `backend/src/**/__tests__/`

**Services Tests** (`backend/src/services/__tests__/`)
- `data.service.test.ts`: Tests for DataService
  - Theme retrieval (getThemes, getThemeById)
  - Conversation management (getConversations, saveConversation, getConversationById)
  - Error handling for file operations

**Routes Tests** (`backend/src/routes/__tests__/`)
- `themes.test.ts`: Tests for themes API endpoints
  - GET /api/themes - List all themes
  - GET /api/themes/:id - Get theme by ID
  - Error handling (404, 500)
  
- `conversations.test.ts`: Tests for conversations API endpoints
  - GET /api/conversations - List all conversations
  - GET /api/conversations/:id - Get conversation by ID
  - POST /api/conversations - Create new conversation
  - PUT /api/conversations/:id - Update conversation
  - Validation and error handling

### Frontend Tests

**Location**: `frontend/src/**/__tests__/`

**Component Tests** (`frontend/src/components/__tests__/`)
- `ThemeSelector.test.tsx`: Tests for ThemeSelector component
  - Loading states
  - Error handling
  - Theme display and selection
  - User interactions

**Service Tests** (`frontend/src/services/__tests__/`)
- `api.test.ts`: Tests for API client service
  - Theme API calls (getThemes, getTheme)
  - Conversation API calls (getConversations, getConversation, createConversation, updateConversation)
  - Error handling for network failures

## Testing Frameworks

### Backend: Jest

**Configuration**: `backend/jest.config.js`

- **Test Environment**: Node.js
- **Preset**: ts-jest (for TypeScript support)
- **Mocking**: File system operations and external dependencies
- **Coverage**: Collects coverage from `src/**/*.ts` files

**Setup**: `backend/jest.setup.js`
- Suppresses console errors/warnings during tests

### Frontend: Vitest

**Configuration**: `frontend/vitest.config.ts`

- **Test Environment**: jsdom (browser-like environment)
- **Plugins**: Vite + React
- **Testing Library**: @testing-library/react for component testing
- **Setup**: `frontend/src/test/setup.ts` imports jest-dom matchers

## Writing Tests

### Backend Test Example

```typescript
import { DataService } from '../data.service';

jest.mock('fs');

describe('DataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return themes', () => {
    const mockThemes = [{ id: '1', title: 'Test' }];
    fs.readFileSync.mockReturnValue(JSON.stringify(mockThemes));
    
    const themes = DataService.getThemes();
    
    expect(themes).toEqual(mockThemes);
  });
});
```

### Frontend Test Example

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeSelector } from '../ThemeSelector';
import { api } from '../../services/api';

vi.mock('../../services/api');

describe('ThemeSelector', () => {
  it('should display themes', async () => {
    vi.mocked(api.getThemes).mockResolvedValue([
      { id: '1', title: 'Theme 1', description: 'Desc', questions: [] }
    ]);

    render(<ThemeSelector onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Theme 1')).toBeInTheDocument();
    });
  });
});
```

## Continuous Integration

All tests run automatically on:
- Push to `main` branch
- Pull requests to `main` branch

See `.github/workflows/ci.yml` for the complete CI configuration.

## Best Practices

1. **Unit Tests**: Test individual functions and components in isolation
2. **Mocking**: Mock external dependencies (API calls, file system, etc.)
3. **Coverage**: Aim for high coverage of critical paths
4. **Fast Tests**: Keep tests fast by avoiding real network calls or file I/O
5. **Descriptive Names**: Use clear test descriptions that explain what is being tested
6. **Arrange-Act-Assert**: Follow the AAA pattern for test structure

## Troubleshooting

### Tests Failing Locally

1. Ensure dependencies are installed: `npm install`
2. Clear test cache:
   - Backend: `npm run test:backend -- --clearCache`
   - Frontend: `rm -rf node_modules/.vitest`

### TypeScript Errors in Tests

Test files are excluded from the production build but included in test runs. Check:
- `frontend/tsconfig.app.json` excludes test files
- `backend/tsconfig.json` configuration

### Mock Issues

- Always clear mocks in `beforeEach()` hooks
- Use `jest.clearAllMocks()` (Jest) or `vi.clearAllMocks()` (Vitest)
- Verify mock implementations match the real API

## Future Enhancements

- [ ] Add E2E tests with Playwright or Cypress
- [ ] Add integration tests for the full API
- [ ] Increase coverage to 80%+
- [ ] Add performance benchmarks
- [ ] Add visual regression testing for UI components
