# Continuous Integration & Deployment

This document describes the CI/CD infrastructure for the Camille project.

## Overview

The project uses GitHub Actions for continuous integration and security scanning. All workflows are automatically triggered on pushes and pull requests to the `main` branch.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

The main CI workflow runs on every push and pull request. It consists of multiple jobs:

#### Jobs

**Lint** (`lint`)
- Runs ESLint on the frontend code
- Ensures code quality and consistency
- Fails if linting errors are found

**Build Backend** (`build-backend`)
- Compiles TypeScript backend code
- Outputs to `backend/dist/`
- Uploads build artifacts for downstream jobs

**Build Frontend** (`build-frontend`)
- Compiles TypeScript and bundles with Vite
- Outputs to `frontend/dist/`
- Uploads build artifacts for downstream jobs

**Test Backend** (`test-backend`)
- Runs all backend tests with Jest
- Generates code coverage report
- Uploads coverage to Codecov (optional)

**Test Frontend** (`test-frontend`)
- Runs all frontend tests with Vitest
- Tests React components and services

**Integration** (`integration`)
- Depends on all other jobs passing
- Downloads build artifacts
- Verifies successful builds

#### Workflow Triggers

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

### 2. CodeQL Security Scan (`.github/workflows/codeql.yml`)

Automated security scanning for code vulnerabilities.

#### Features

- Scans JavaScript/TypeScript code for security issues
- Runs on every push and pull request
- Scheduled weekly scan (Mondays at 9:00 AM UTC)
- Reports findings to GitHub Security tab

#### Language Coverage

- JavaScript/TypeScript (frontend and backend)

#### Permissions Required

- `actions: read`
- `contents: read`
- `security-events: write`

### 3. Dependency Review (`.github/workflows/dependency-review.yml`)

Reviews dependency changes in pull requests for security vulnerabilities.

#### Features

- Scans for vulnerable dependencies
- Checks for license compliance
- Fails on moderate or higher severity vulnerabilities
- Only runs on pull requests

#### Allowed Licenses

- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- 0BSD

## Local Development Workflow

Before pushing code, ensure it passes local checks:

```bash
# 1. Lint code
npm run lint

# 2. Run tests
npm test

# 3. Build project
npm run build
```

## Status Badges

Add these badges to README.md to show CI status:

```markdown
![CI Status](https://github.com/maxneuvians/camille/workflows/CI/badge.svg)
![CodeQL](https://github.com/maxneuvians/camille/workflows/CodeQL%20Security%20Scan/badge.svg)
```

## Coverage Reporting

The CI workflow includes optional Codecov integration:

1. **Setup**: Add `CODECOV_TOKEN` to repository secrets
2. **Reports**: Coverage reports are uploaded after test runs
3. **View**: Coverage trends available at codecov.io

To disable Codecov upload, the job includes `continue-on-error: true`, so it won't fail the build if not configured.

## Node.js Version

All workflows use Node.js 20 (LTS) for consistency with development environment.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

## Caching Strategy

NPM dependencies are cached to speed up workflow runs:

- Cache key: Based on `package-lock.json` hash
- Managed automatically by `actions/setup-node@v4`
- Significant reduction in installation time

## Artifacts

Build artifacts are uploaded for 1 day retention:

- `backend-dist`: Compiled backend code
- `frontend-dist`: Built frontend assets

Download artifacts from the Actions tab in GitHub.

## Security Best Practices

1. **Dependency Scanning**: Automated checks for vulnerable dependencies
2. **Code Scanning**: CodeQL analyzes code for security issues
3. **License Compliance**: Ensures only approved licenses are used
4. **Minimal Permissions**: Workflows use least-privilege access
5. **Secrets Management**: Sensitive data stored in GitHub Secrets

## Troubleshooting

### Workflow Fails on Lint

- Run `npm run lint` locally to identify issues
- Fix linting errors before pushing
- Consider adding pre-commit hooks

### Tests Fail in CI but Pass Locally

- Ensure `package-lock.json` is committed
- Check Node.js version matches CI (Node 20)
- Review test logs in GitHub Actions tab

### CodeQL Scan Issues

- Check the Security tab for detailed findings
- Review CodeQL documentation for remediation
- False positives can be dismissed with justification

### Build Artifacts Not Available

- Artifacts are retained for 1 day only
- Download within retention period
- Increase retention if needed in workflow file

## Workflow Optimization

Current optimizations:

- **Parallel Jobs**: Independent jobs run concurrently
- **Artifact Caching**: NPM dependencies cached
- **Fast Feedback**: Lint and test jobs run early
- **Conditional Steps**: Some steps only run when needed

Future improvements:

- Matrix builds for multiple Node versions
- Deployment automation
- Performance benchmarking
- E2E testing integration

## Monitoring

Monitor CI health through:

1. **GitHub Actions Tab**: View all workflow runs
2. **Pull Request Checks**: See status before merging
3. **Email Notifications**: Configure in GitHub settings
4. **Status Badges**: Display in README.md

## Required Status Checks

To protect the `main` branch, configure these required checks in GitHub settings:

- `Lint Frontend`
- `Build Backend`
- `Build Frontend`
- `Test Backend`
- `Test Frontend`

Navigate to: **Settings → Branches → Branch protection rules → main**

## Contributing

When adding new CI jobs:

1. Test locally first
2. Add job to appropriate workflow
3. Document in this file
4. Ensure minimal permissions
5. Test on a feature branch first

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [npm Documentation](https://docs.npmjs.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
