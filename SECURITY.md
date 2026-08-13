# Security Policy

## Supported versions

Chrona is a personal project with a single active line. Only the latest release gets fixes.

| Version | Supported |
|---------|-----------|
| 1.1.x   | Yes       |
| < 1.1   | No        |

## Reporting a vulnerability

Please report privately, not in a public issue:

**[Open a private security advisory](https://github.com/aexomir/Chrona/security/advisories/new)**

Include what you'd expect — the affected component, how to reproduce it, and what an attacker
could achieve. I'll acknowledge within a week. Since this is a side project maintained by one
person, please don't expect a same-day turnaround.

There's no bug bounty.

## What's worth reporting

Chrona's security boundary is narrower than most apps because there's no backend. The
interesting surface is the link between your phone and your Mac:

- **The local-network protocol.** Chrona Helper advertises `_chrona._tcp` over Bonjour and
  streams app names and window titles. A client must present the six-character pairing code
  before the helper sends anything. Anything that gets data out of the helper without a valid
  code, or that lets a third party read or inject frames on an established connection, is a
  real finding.
- **The pairing code itself.** It's six characters from a 32-character alphabet, compared in
  constant time. Practical brute-force paths, or ways to recover it, are in scope.
- **Local storage.** Sessions, projects and rules live in MMKV encrypted with AES-256; the key
  is in the iOS Keychain, as is the pairing token. Ways to read either without device access
  are in scope.
- **The Mac ledger.** `~/Library/Application Support/ChronaHelper/spans.ndjson` holds seven
  days of app and window-title history in plain text, readable by anything running as your
  user. That's a deliberate trade-off — it's your own file on your own machine — but if you
  can reach it from somewhere you shouldn't, say so.

## Known and accepted

These are design decisions, not oversights. Reports about them will be closed as such.

- **The Mac helper runs unsandboxed.** Reading another process's window title through
  `AXUIElement` is impossible from inside the App Sandbox. This is why the helper needs
  Accessibility permission, and it's the single largest trust decision in the project.
- **Release builds are unsigned and unnotarized.** They're built with `CODE_SIGN_IDENTITY="-"`
  because the project has no paid Apple Developer membership. Verify what you're running, or
  build from source.
- **The activity ledger is not encrypted at rest.** It's a file in your own home directory.
- **Traffic between the two devices is not encrypted.** It's authenticated by the pairing code
  but sent in the clear over your local network. Someone who can already passively read your
  LAN traffic can read your window titles. Encrypting the transport is a legitimate
  improvement — an issue is more useful than an advisory for that one.
