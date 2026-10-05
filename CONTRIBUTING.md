# Contributing to Exist Flow

Thank you for your interest in contributing! This guide will help you get started.

## Code of Conduct

Be respectful, inclusive, and constructive. We're here to build something great together.

## How to Contribute

### Reporting Bugs

Before opening a bug report:
1. Check [existing issues](https://github.com/your-username/exist-flow/issues) to avoid duplicates
2. Include steps to reproduce
3. Describe expected vs actual behavior
4. Include your environment (Windows version, Node version)

### Suggesting Features

1. Check if the feature has already been requested
2. Open an issue with the `enhancement` label
3. Describe the use case and why it matters

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run lint` and `npm run typecheck`
5. Commit with a clear message
6. Push to your fork
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/exist-flow.git
cd exist-flow

# Install dependencies
npm install

# Start development
npm run electron:dev
```

## Code Guidelines

- **TypeScript**: Use strong typing. Avoid `any`.
- **Components**: Keep them small and focused.
- **Styling**: Use Tailwind utilities. Avoid arbitrary values.
- **Naming**: Use descriptive names. Avoid abbreviations.
- **Comments**: Only add comments when the "why" isn't obvious from the code.

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add application discovery from Start Menu
fix: prevent window from hiding on focus loss
style: refine search input border and typography
```

## Design Guidelines

When contributing UI changes:
- Maintain the premium, minimal aesthetic
- Avoid decorative gradients, glows, or excessive effects
- Ensure keyboard navigation works
- Test on actual Windows hardware when possible

## Questions?

Open an issue with the `question` label.
