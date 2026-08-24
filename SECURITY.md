# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through this repository's **GitHub Security Advisories** feature. Use the repository Security tab and select **Report a vulnerability**.

Do not report security issues in public issues, discussions, pull requests, or chat channels. Do not include credentials, API keys, cookies, tokens, private URLs, production configuration, recipient addresses, customer data, or raw production webhook payloads in a report. Provide a minimal, sanitized reproduction where possible.

If GitHub Security Advisories are unavailable for a fork or mirror, contact the maintainers through the repository's GitHub moderation or reporting mechanisms and ask for a private reporting path. Do not publish exploit details while the issue is under review.

## Supported versions

Security fixes are considered for the latest version on the repository's default branch. Older forks, unmaintained deployment copies, and locally modified versions may not receive backported fixes.

## Scope

Reports are welcome for vulnerabilities in this repository, including:

- Authentication and authorization boundaries.
- Capability gates for delivery, automation, image generation, and webhooks.
- Webhook signature verification and event handling.
- Exposure of secrets, personal data, or sensitive operational data.
- Unsafe database, provider, or archive behavior caused by project code.
- Dependency vulnerabilities when they materially affect this application.

Out of scope examples include social engineering, denial-of-service testing against third-party providers, findings that require access you are not authorized to use, and vulnerabilities limited to an independently modified deployment outside this repository.

## What to include

A useful report includes a description of the impact, affected files or versions, sanitized steps to reproduce, and a suggested mitigation if you have one. Avoid sending proof-of-concept traffic to production services or real recipients.

## Response expectations

Maintainers aim to acknowledge credible reports, assess impact, and coordinate a fix or mitigation in good faith. Timing depends on severity, reproducibility, maintainer availability, and release coordination. This policy does not promise a specific response or remediation SLA.
