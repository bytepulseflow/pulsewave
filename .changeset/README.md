# Changesets

This folder contains changesets for managing versioning and publishing of the PulseWave packages.

## What are Changesets?

Changesets is a tool that helps you manage versioning and publishing for multi-package repositories. It allows you to:

- Track changes across multiple packages
- Automatically determine version bumps (major, minor, patch)
- Generate changelogs
- Publish packages to npm in the correct order

## PulseWave Packages

This repository contains three packages that are published to npm:

1. **@bytepulse/pulsewave-shared** - Shared types and constants (no dependencies)
2. **@bytepulse/pulsewave-client** - Client React SDK (depends on shared)
3. **@bytepulse/pulsewave-server** - Server SDK (depends on shared)

## How to Create a Changeset

When you make changes that should be released:

```bash
pnpm changeset
```

This will prompt you to:

1. Select which packages have changed
2. Choose the version bump type:
   - **major** - Breaking changes
   - **minor** - New features (backward compatible)
   - **patch** - Bug fixes (backward compatible)
3. Add a summary of the changes

## How to Publish

### Initial Publish (First Time)

1. Login to npm:

   ```bash
   npm login
   ```

2. Build all packages:

   ```bash
   pnpm build
   ```

3. Publish in correct order (shared must be first):

   ```bash
   cd packages/shared
   npm publish --access public

   cd ../client
   npm publish --access public

   cd ../server
   npm publish --access public
   ```

### Subsequent Releases

#### Option 1: Using GitHub Actions (Recommended)

1. Create a changeset:

   ```bash
   pnpm changeset
   ```

2. Commit and push to GitHub:

   ```bash
   git add .changeset/*.md
   git commit -m "chore: add changeset for release"
   git push
   ```

3. The GitHub Actions workflow (`.github/workflows/release.yml`) will automatically:
   - Version the packages
   - Build the packages
   - Publish to npm

#### Option 2: Manual Publishing

1. Version packages:

   ```bash
   pnpm version-packages
   ```

2. Build packages:

   ```bash
   pnpm build
   ```

3. Publish to npm:
   ```bash
   pnpm release
   ```

## Package Dependencies

```
@bytepulse/pulsewave-shared (no dependencies)
    ↓
    ├─ @bytepulse/pulsewave-client (depends on shared)
    └─ @bytepulse/pulsewave-server (depends on shared)
```

**Important:** The `shared` package must always be published first, as both client and server depend on it.

## GitHub Actions Setup

To enable automatic publishing via GitHub Actions:

1. Go to https://github.com/bytepulseflow/pulsewave/settings/secrets/actions
2. Add a new repository secret named `NPM_TOKEN`
3. Get your npm token from https://www.npmjs.com/settings/your-name/tokens
4. Paste the token as the secret value

## Configuration

The Changesets configuration is in [`.changeset/config.json`](.changeset/config.json):

```json
{
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

- `access: "public"` - Packages are published publicly to npm
- `baseBranch: "main"` - Changesets are applied when pushing to main
- `updateInternalDependencies: "patch"` - Internal dependencies get patch bumps

## Useful Commands

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `pnpm changeset`        | Create a new changeset             |
| `pnpm version-packages` | Apply changesets and bump versions |
| `pnpm release`          | Build and publish packages         |
| `pnpm build`            | Build all packages                 |

## More Information

For complete Changesets documentation, visit:

- https://github.com/changesets/changesets
- https://github.com/changesets/changesets/blob/main/docs/common-questions.md
