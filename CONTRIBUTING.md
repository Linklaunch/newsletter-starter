# Contributing

Thanks for contributing to Newsletter Starter. This project values small, reviewable improvements that preserve its review-first and fail-closed behavior.

## Before you start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md).
- Use an issue or discussion to align on substantial changes before investing in an implementation.
- Do not open public issues for security vulnerabilities.
- Do not include secrets, access tokens, private endpoints, production configuration, customer data, recipient lists, or real delivery-event payloads in issues, commits, screenshots, test fixtures, or pull requests.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `bun install`.
3. Copy `.env.example` to `.env.local` only if you need local services. Populate it with accounts and data you are authorized to use.
4. Make the smallest coherent change.
5. Run the relevant validation commands:

   ```bash
   bun test
   bun run typecheck
   bun run lint
   bun run check
   ```

`lint` and `check` do not modify files. If formatting is needed, run `bun run format` or `bun run check:fix`, then review the resulting diff.

## Style and design expectations

- Use TypeScript with the existing strict compiler settings.
- Follow the repository's Biome configuration and existing naming conventions.
- Prefer small, testable helpers for authorization, configuration parsing, scheduling, and provider boundaries.
- Keep external effects fail closed. New email, webhook, scheduler, image, storage, or provider mutations must have an explicit guard before network I/O.
- Preserve the review-first lifecycle. Drafting must not silently send or schedule a publication.
- Keep public documentation provider-neutral and free of deployment-specific identities.
- Add or update focused tests when behavior changes, especially for configuration, permissions, parsing, and side-effect gates.

## Pull requests

Open focused pull requests that explain:

- What changed and why.
- Any user-visible, operational, configuration, or schema impact.
- Tests and validation you ran.
- Any follow-up work that is intentionally out of scope.

Avoid unrelated refactors, generated-file churn, or bundled feature changes. Keep commits understandable and leave the repository free of local environment files, generated databases, logs, and coverage output.

## Contributor license

By contributing, you agree that your contributions are licensed under the repository's [MIT License](LICENSE).
