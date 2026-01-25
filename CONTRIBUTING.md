# Contributing to Rustrak

Thank you for your interest in contributing to Rustrak! This guide will help you get started with the project and understand our development workflow.

## Table of Contents
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Standards](#code-standards)
- [Submitting Changes](#submitting-changes)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Rust** (1.80+) - For the server component
- **Node.js** (20.x+) - For the UI and build tools
- **pnpm** (9.x+) - Package manager
- **Docker** - For local development and testing

### Local Development Setup

1. **Fork and Clone the Repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/rustrak.git
   cd rustrak
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Start PostgreSQL for Development**

   ```bash
   docker-compose -f docker-compose.dev.yml up -d postgres
   ```

4. **Run the Server (in a new terminal)**

   ```bash
   cd apps/server
   cargo run
   ```

5. **Run the UI (in another terminal)**

   ```bash
   cd apps/webview-ui
   pnpm dev
   ```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
cd apps/server && cargo test
cd apps/webview-ui && pnpm test
```

### Linting and Formatting

```bash
# Format all code
pnpm format

# Run linter
pnpm lint
```

## Development Workflow

### Branch Naming Conventions

Use the following prefixes for your branches:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or improving tests
- `chore/` - Maintenance tasks

Example: `feat/add-authentication-endpoint` or `fix/login-validation-bug`

### Commit Message Format

Follow the conventional commit format:

```
<type>: <short description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding or improving tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: add user authentication endpoint

fix: resolve memory leak in event processor

docs: update API documentation for events endpoint
```

## Project Structure

Rustrak is a monorepo managed with Turborepo and pnpm:

```
rustrak/
├── apps/
│   ├── server/           # Rust backend (Actix-web)
│   ├── webview-ui/       # Next.js frontend
│   └── docs/             # Documentation site
├── packages/
│   ├── client/           # TypeScript API client
│   └── test-sentry/      # Test utilities for Sentry compatibility
├── .changeset/           # Versioning configuration
├── .claude/             # AI context files
├── docker-compose*.yml   # Docker configurations
└── CLAUDE.md            # Project context
```

### Component-Specific Context Files

Each component has its own CLAUDE.md file with detailed context:

- Server: `apps/server/CLAUDE.md`
- WebView UI: `apps/webview-ui/CLAUDE.md`
- Client Package: `packages/client/CLAUDE.md`

## Code Standards

### Rust (Server)

- Follow Rust idioms and best practices
- Use `rustfmt` for code formatting
- Run `clippy` to catch common mistakes and improve code quality
- Write tests for new functionality
- Document public APIs with `///` comments

### TypeScript/JavaScript (UI and Packages)

- Use strict TypeScript mode
- Follow ESLint and Prettier configurations
- Write tests for new functionality
- Use Zod for runtime validation where appropriate

### Testing Requirements

- Maintain high test coverage (>90% where possible)
- Write unit tests for pure functions
- Write integration tests for API endpoints
- Include tests for edge cases and error conditions

## Submitting Changes

### Creating Issues

Before submitting a pull request, consider creating an issue first:

1. Search existing issues to avoid duplicates
2. Provide a clear title and detailed description
3. Include reproduction steps for bug reports
4. Explain the motivation for feature requests

### Pull Request Process

1. **Create a branch** for your changes
2. **Make your changes** following the code standards
3. **Write clear commit messages** using the conventional format
4. **Add tests** if your changes affect functionality
5. **Update documentation** as needed
6. **Submit a pull request** with a clear description

### Code Review Process

- All submissions require review before merging
- Address review comments promptly
- Maintainers will merge approved PRs
- Large changes may be broken into smaller PRs

## Community Guidelines

### Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Please be respectful and inclusive when interacting with others.

### Getting Help

- Check the existing documentation and issues
- Ask questions in the issue comments
- Be patient - maintainers are volunteers

### Recognition

Contributors will be acknowledged in release notes and the project's README.

---

Thank you for contributing to Rustrak! Your efforts help make error tracking more accessible and lightweight for everyone.