## Summary

Describe the focused change and why it is needed.

## Validation

- [ ] `bun test`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run check`

## Safety checklist

- [ ] No secrets, tokens, private URLs, recipient lists, customer data, or production webhook payloads are included.
- [ ] Any external-effect change preserves explicit opt-in and fail-closed behavior.
- [ ] Documentation and `.env.example` reflect any configuration change.
