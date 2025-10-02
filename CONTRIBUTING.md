# Contributing to Camille

Thank you for your interest in contributing to Camille! This document provides guidelines for contributing to the project.

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes: `npm run build`
6. Commit your changes: `git commit -m "Description of changes"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Code Style

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Define explicit types for public APIs
- Use interfaces for data structures

### React
- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use CSS files for styling (not inline styles)

### Backend
- Use async/await for asynchronous operations
- Handle errors gracefully
- Log important events
- Validate input data

## Project Areas for Contribution

### 1. Evaluation System
The current evaluation framework is basic. Enhancements could include:
- Define evaluation criteria (fluency, relevance, depth, etc.)
- Implement scoring algorithms
- Add AI-powered assessment using OpenAI
- Create evaluation reports and visualizations
- Export evaluation data

### 2. Additional Themes
Add more interview themes relevant to professional contexts:
- Leadership skills
- Time management
- Customer service
- Technical expertise
- Adaptability and learning

### 3. User Interface Improvements
- Add conversation history view
- Implement theme management UI
- Create dashboard for analytics
- Add user preferences and settings
- Improve mobile responsiveness

### 4. Audio Enhancements
- Add audio playback controls (pause, replay)
- Implement audio level visualization
- Support different audio formats
- Add noise cancellation options

### 5. Backend Improvements
- Switch from JSON file storage to a database (SQLite, PostgreSQL)
- Add user authentication and authorization
- Implement API rate limiting
- Add conversation search and filtering
- Create data export functionality

### 6. Testing
- Add unit tests for services
- Add integration tests for API endpoints
- Add end-to-end tests for user flows
- Set up continuous integration

### 7. Documentation
- Add JSDoc comments to functions
- Create API documentation (OpenAPI/Swagger)
- Add architecture diagrams
- Write user guides with screenshots
- Create video tutorials

### 8. Internationalization
While the agent speaks French, the UI could support multiple languages:
- Externalize UI strings
- Add language selector
- Support for other languages in the agent

### 9. Accessibility
- Add ARIA labels
- Improve keyboard navigation
- Add screen reader support
- Ensure color contrast meets WCAG standards

## Testing Guidelines

Before submitting a PR:

1. **Build test**: `npm run build` should succeed
2. **Manual test**: Start dev servers and test the main user flows
3. **API test**: Verify API endpoints work correctly
4. **Cross-browser**: Test in Chrome, Firefox, and Safari if possible

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: Add conversation export functionality
fix: Resolve audio playback issue on Safari
docs: Update README with deployment instructions
refactor: Extract conversation logic into service
test: Add unit tests for data service
```

Prefixes:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Update documentation as needed
3. Add tests if applicable
4. Ensure all builds pass
5. Describe your changes in the PR description
6. Reference any related issues

## Questions?

Feel free to open an issue for:
- Feature requests
- Bug reports
- Questions about the codebase
- Clarifications on how to contribute

## License

By contributing to Camille, you agree that your contributions will be licensed under the MIT License.
