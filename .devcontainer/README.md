# Dev Container Configuration

This directory contains the configuration for developing Camille in a containerized environment using VS Code Dev Containers.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) installed and running
- [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

## Getting Started

1. Open the project in VS Code
2. When prompted, click "Reopen in Container" (or use Command Palette: `Dev Containers: Reopen in Container`)
3. VS Code will build the container and install dependencies automatically
4. Once ready, you can start developing!

## What's Included

### Base Image
- Node.js 20 on Debian Bullseye
- TypeScript development tools

### Features
- **Node.js 20**: Latest LTS version
- **Git**: Version control
- **GitHub CLI**: For GitHub operations

### VS Code Extensions
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **TypeScript**: Enhanced TypeScript support
- **React Snippets**: React development helpers
- **NPM Intellisense**: NPM module autocomplete
- **Error Lens**: Inline error highlighting
- **GitLens**: Advanced Git integration
- **JSON**: JSON file support

### Ports
The following ports are automatically forwarded:
- **3001**: Backend API server
- **5173**: Frontend development server (opens automatically in browser)

## Development Workflow

Once the container is running:

```bash
# Start both frontend and backend
npm run dev

# Or start them separately
npm run dev:backend  # Terminal 1
npm run dev:frontend # Terminal 2

# Build the project
npm run build
```

## SSH Keys

Your local SSH keys are mounted read-only into the container, allowing you to:
- Push/pull from Git repositories
- Use SSH-based authentication

## Customization

To customize the dev container:
1. Edit `.devcontainer/devcontainer.json`
2. Rebuild the container: Command Palette → `Dev Containers: Rebuild Container`

## Troubleshooting

### Container won't start
- Ensure Docker is running
- Try rebuilding: `Dev Containers: Rebuild Container`

### Ports not forwarding
- Check if ports 3001 and 5173 are available locally
- Manually forward ports in VS Code's Ports panel

### Dependencies not installing
- Rebuild the container
- Or manually run `npm install` in the terminal

## Benefits of Dev Containers

- **Consistent Environment**: Same Node.js version and tools for all developers
- **Quick Setup**: No need to install Node.js, npm, or other tools locally
- **Isolation**: Project dependencies don't conflict with other projects
- **Reproducible**: Anyone can get the exact same development environment
