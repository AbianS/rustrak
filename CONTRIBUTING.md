# Contributing to Rustrak

Thank you for your interest in contributing to Rustrak! This guide will help you get started with the project and understand our development workflow.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Standards](#code-standards)
- [Submitting Changes](#submitting-changes)
- [Community Guidelines](#community-guidelines)

---

## Getting Started

### Prerequisites

To contribute to Rustrak, you'll need the following tools installed:

- **Rust** (2021 edition): [Install Rust](https://www.rust-lang.org/tools/install)
- **Node.js 20+**: [Install Node.js](https://nodejs.org/)
- **pnpm**: `npm install -g pnpm`
- **Docker**: Required for running PostgreSQL locally.

### Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/AbianS/rustrak.git
    cd rustrak
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Start the development database:**
    ```bash
    docker compose -f docker-compose.dev.yml up -d postgres
    ```

4.  **Run the application components:**

    - **Server (Rust):**
      ```bash
      cd apps/server
      cargo run
      ```

    - **WebView UI (Next.js):**
      ```bash
      cd apps/webview-ui
      pnpm dev
      ```

---

## Development Workflow

### Branch Naming Conventions

- `feat/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation changes
- `refactor/description` for code refactoring
- `test/description` for adding or improving tests

### Commit Message Format

We follow the `type: description` format:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests

Example: `feat: add support for custom fingerprints`

### Pull Request Process

1.  Create a branch for your changes.
2.  Ensure tests pass and the code is formatted.
3.  Open a Pull Request with a clear description of what the PR accomplishes and why.
4.  Link any relevant issues in the PR description.
5.  Wait for review and address any feedback.

---

## Project Structure

Rustrak is a monorepo managed with [Turborepo](https://turbo.build/repo).

- `apps/server`: The Rust API server (Actix-web + SQLx).
- `apps/webview-ui`: The Next.js dashboard.
- `packages/client`: TypeScript API client.
- `packages/test-sentry`: CLI tool for testing Sentry event ingestion.
- `docs/`: Technical documentation and specifications.

For more detailed technical context, refer to the `CLAUDE.md` files in each directory:
- Root: `CLAUDE.md`
- Server: `apps/server/CLAUDE.md`
- UI: `apps/webview-ui/CLAUDE.md`
- Client: `packages/client/CLAUDE.md`

---

## Code Standards

### Rust

- **Formatting:** Use `cargo fmt` (rustfmt).
- **Linting:** Use `cargo clippy`.
- **Error Handling:** Prefer `thiserror` for custom error types.
- **Async:** Use `async/await` with `tokio`.

### TypeScript / Frontend

- **Formatting & Linting:** We use [Biome](https://biomejs.dev/) for both. Run `pnpm fmt` and `pnpm lint` from the root.
- **Styles:** Use Tailwind CSS 4 and Vanilla CSS.
- **Type Safety:** Strict TypeScript mode is enabled. Use Zod for runtime validation.

### Testing Requirements

- **Rust:** Run `cargo test` in `apps/server`.
- **TypeScript:** Use Vitest. Run `pnpm test` from the root or within specific packages.
- Ensure new features include corresponding test coverage.

---

## Submitting Changes

- **Issues:** Check existing issues before opening a new one. Provide as much detail as possible, including steps to reproduce for bugs.
- **PR Checklist:**
  - [ ] Code follows project standards.
  - [ ] Tests pass locally.
  - [ ] Documentation updated if necessary.
  - [ ] Changesets added if applicable (`pnpm changeset`).

---

## Community Guidelines

### Code of Conduct

We aim to maintain a welcoming and professional environment. Please be respectful and constructive in all interactions.

### Communication

For questions or discussions, please use:
- **GitHub Issues:** For bug reports and feature requests.
- **GitHub Discussions:** For general questions and architecture discussions.

---

Built with ❤️ by the Rustrak community.
