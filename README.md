# AutoTranslateChannels

A Vencord userplugin that automatically translates messages in selected Discord channels.

## Features

- Automatic translation in selected channels
- Replace the original message with the translation
- Show the original message on demand
- Translate only messages that are not already in the selected target language
- Minimum message length filter
- Optional translation of bot messages
- Optional translation of your own messages
- Persistent translation cache with configurable size
- Maximum concurrent translation requests
- "Only new messages" mode
- Multiple target languages
- Context-menu controls for enabling/disabling translation for channels
- Partial embed translation support

### Supported target languages

- 🇷🇺 Русский
- 🇬🇧 English
- 🇩🇪 Deutsch
- 🇫🇷 Français
- 🇪🇸 Español
- 🇮🇹 Italiano
- 🇵🇹 Português
- 🇵🇱 Polski
- 🇺🇦 Українська
- 🇹🇷 Türkçe
- 🇳🇱 Nederlands
- 🇨🇿 Čeština
- 🇸🇪 Svenska
- 🇨🇳 中文
- 🇯🇵 日本語
- 🇰🇷 한국어

## Installation

This is a **Vencord userplugin**, not an official Vencord plugin.

Vencord's documentation recommends putting custom plugins in `src/userplugins`. You need a Vencord build from source.

### Windows / macOS / Linux

From your Vencord directory:

```bash
cd src/userplugins
git clone https://github.com/YOUR_USERNAME/AutoTranslateChannels.git
cd ../..
pnpm build
```

Then restart Discord.

If you already have the repository cloned, update it with:

```bash
cd src/userplugins/AutoTranslateChannels
git pull
cd ../../..
pnpm build
```

> Replace `YOUR_USERNAME` with the GitHub account that hosts this repository.

### Manual installation

You can also download `index.tsx` and place it directly in:

```text
Vencord/src/userplugins/AutoTranslateChannels.tsx
```

Then run:

```bash
pnpm build
```

The repository layout is intentionally compatible with Vencord's documented custom-plugin structure: a plugin can be a single `.ts/.tsx` file or a folder with an `index.ts/.tsx` entry point.

## Configuration

After building Vencord, enable **AutoTranslateChannels** in:

**Discord → User Settings → Vencord → Plugins**

Then configure:

- **Target Language** — language to translate into
- **Replace Original** — replace the original message with the translation
- **Show Label** — show the translation label when the original is not replaced
- **Translate Only Foreign Text** — skip messages already detected as the target language
- **Only New Messages** — translate only messages arriving after the plugin is enabled
- **Max Concurrent** — maximum number of translation requests running at once
- **Persistent Cache** — keep translations between client restarts
- **Cache Limit** — maximum number of cached translations
- **Minimum Length** — ignore very short messages
- **Translate Bots** — include bot messages
- **Translate Own Messages** — include your own messages
- **Ignore Non Text** — skip messages without useful text

Channels can be managed separately through the channel context menu.

## Current limitations

- Reply-preview translation is intentionally **not included** in the current release.
- Embed translation is supported, but Discord embed rendering can vary between messages and Discord client versions.
- Language detection for "Translate Only Foreign Text" is heuristic. Very short or ambiguous text such as `ok`, `lol`, `gg`, or names may not be classified reliably.
- The plugin depends on Vencord and Discord internals. Discord updates can break custom plugins.

## Privacy

The plugin does not provide its own translation backend. It uses Vencord's existing translation utilities and follows the configuration of that translation system.

Before using it with sensitive conversations, understand which translation provider your Vencord setup uses and what data that provider receives.

## Contributing

Issues and pull requests are welcome.

When reporting a bug, include:

1. Vencord version / commit
2. Discord client version
3. AutoTranslateChannels version or commit
4. Target language
5. Relevant plugin settings
6. A short reproduction example
7. Console/build errors, if any

Please avoid posting private conversations or personal information.

## Disclaimer

AutoTranslateChannels is an unofficial Vencord userplugin and is not affiliated with, endorsed by, or sponsored by Discord Inc. or the Vencord project.

Vencord's official documentation states that custom-plugin installations are advanced/unsupported and that users are responsible for issues arising from them. Use this plugin at your own risk.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

## Credits

Built as a community Vencord userplugin using Vencord's plugin and translation APIs.
