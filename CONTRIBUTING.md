# Contributing to clawtv

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/clawtv.git`
3. Create a branch: `git checkout -b my-feature`
4. Make your changes
5. Run tests: `npm test`
6. Commit and push to your fork
7. Open a Pull Request against `main`

## What to Contribute

- **New app support** — Add entries to `KNOWN_APPS` in `clawtv.js`
- **Navigation patterns** — Improve the skill file (`SKILL.md`) with better TV navigation strategies
- **Bug fixes** — Fix issues with ADB commands, connection handling, or edge cases
- **Tests** — Add test coverage in `clawtv.test.js`

## Development

No build step. The entire CLI is a single file (`clawtv.js`) with zero dependencies.

```bash
# Run tests
npm test

# Test a specific command locally
node clawtv.js help
node clawtv.js setup
```

## Guidelines

- Keep it simple — this is a single-file CLI with zero dependencies. Don't add dependencies.
- Run `npm test` before submitting — all 76 tests must pass.
- One PR per feature/fix.
- Write clear commit messages.

## Reporting Bugs

Open an issue with:
- Your TV brand/model
- Android TV OS version
- The command you ran
- The error output

## Code of Conduct

Be respectful. We're all here to make TV control better.
