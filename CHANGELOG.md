# Changelog

## 1.0.0 — 2026-08-16

Initial public release.

### Included

- Automatic translation for selected Discord channels
- Original-message replacement with on-demand original viewing
- 16 target languages
- Target-language-aware foreign-text filtering
- Translation queue and concurrent-request limit
- Persistent translation cache
- Minimum-length and content filters
- Bot/self-message controls
- Only-new-messages mode
- Channel context-menu controls
- Partial embed translation support

### Known limitations

- Reply-preview translation is not included.
- Embed rendering/translation depends on Discord's current embed DOM.
- Language detection is heuristic for short or ambiguous messages.
