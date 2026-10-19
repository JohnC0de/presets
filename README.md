# presets (retired)

This repository no longer holds code. The shared lint, format, TypeScript and fallow presets live in [`~/projects/tools`](https://github.com/JohnC0de/tools) under `adapters/presets`.

- `p presets sync` writes the presets into a repo (`p presets sync --check` verifies them).
- `p adopt` wires an existing repo to them.

Older commits remain reachable for consumers that still pin one by SHA (`github:JohnC0de/presets#<sha>`); move those to `p adopt` instead of bumping the pin.
