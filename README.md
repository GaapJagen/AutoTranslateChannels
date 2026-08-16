# AutoTranslateChannels

Automatically translate messages in selected Discord channels.

AutoTranslateChannels is an unofficial Vencord userplugin that automatically translates messages in channels you choose, while giving you control over the target language, translation behavior, caching, concurrency and original-message display.

## Features

- Automatic translation in selected Discord channels
- Replace the original message with its translation
- Show the original message on demand
- Translate only messages that are not already in the selected target language
- 16 target languages
- Minimum message length filter
- Optional translation of bot messages
- Optional translation of your own messages
- Persistent translation cache
- Configurable cache size
- Configurable maximum number of simultaneous translation requests
- "Only New Messages" mode
- Channel context-menu controls
- Partial embed translation support

## Supported languages

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

## Requirements

### Vencord

AutoTranslateChannels is a **Vencord UserPlugin**.

You must have **Vencord built from source**. Vencord's official documentation states that custom plugins require a source build and are intended for advanced users.

Official documentation:

https://docs.vencord.dev/installing/custom-plugins/

### Vencord Translate plugin

**The Vencord `Translate` plugin must also be enabled.**

AutoTranslateChannels uses Vencord's existing Translate plugin and its translation infrastructure rather than providing a separate translation backend.

Enable it in:

**Discord → User Settings → Vencord → Plugins → Translate**

AutoTranslateChannels should be used together with the Vencord `Translate` plugin.

## Installation

This is an unofficial Vencord UserPlugin.

### Windows / macOS / Linux

**Installation guide:** [Vencord Custom Plugins](https://docs.vencord.dev/installing/custom-plugins/)

First make sure you have a Vencord source checkout and that you can build Vencord successfully.

Open a terminal in your Vencord directory and run:

```bash
cd src/userplugins
git clone https://github.com/GaapJagen/AutoTranslateChannels.git
cd ../..
pnpm build
```

Restart Discord after the build finishes.

Then enable both:

1. **Translate**
2. **AutoTranslateChannels**

in:

**Discord → User Settings → Vencord → Plugins**

### Updating

If you already installed the plugin using Git:

```bash
cd src/userplugins/AutoTranslateChannels
git pull
cd ../../..
pnpm build
```

Restart Discord after the build completes.

### Manual installation

You can also download `index.tsx` from this repository and place it in:

```text
Vencord/src/userplugins/AutoTranslateChannels/index.tsx
```

Then rebuild Vencord:

```bash
pnpm build
```

For repository-based installation, keeping `index.tsx` in the plugin directory is recommended because it matches the installation method described above.

## Configuration

After building Vencord, enable **Translate** and **AutoTranslateChannels**.

AutoTranslateChannels provides the following settings:

### Target Language

The language all translated messages should be translated into.

### Replace Original

Replace the original message with the translated text.

When enabled, the original text can be shown using the original-message control.

### Show Label

Controls whether a translation label is displayed when the original message is not replaced.

### Translate Only Foreign Text

Skip messages that already appear to be written in the selected target language.

Language detection is heuristic, especially for very short messages.

### Only New Messages

Only automatically translate messages that arrive after the plugin is enabled.

### Max Concurrent

Controls how many translation requests can run simultaneously.

This helps balance translation speed against excessive requests and possible rate limits.

### Persistent Cache

Keep translations in the cache between Discord restarts.

### Cache Limit

Controls the maximum number of cached translations.

### Minimum Length

Ignore messages shorter than the configured number of characters.

This can help avoid unnecessary translations of short messages such as:

```text
ok
lol
gg
ty
```

### Translate Bots

Allow messages sent by bots to be translated.

### Translate Own Messages

Allow your own messages to be translated.

### Ignore Non Text

Skip messages that do not contain useful text.

## Channel management

AutoTranslateChannels has separate channel management controls.

Use the channel context menu to enable or disable automatic translation for individual channels.

Channel management is independent from the translation settings themselves.

## How translation works

AutoTranslateChannels uses Vencord's existing Translate infrastructure.

The plugin manages:

- which channels should be translated;
- when messages should be translated;
- which messages should be skipped;
- translation concurrency;
- translation caching;
- target language selection;
- replacement of the original message.

The actual translation backend is provided by Vencord's Translate system.

## Privacy

AutoTranslateChannels does not provide its own translation service.

It uses Vencord's existing translation infrastructure and therefore follows the translation provider configured by your Vencord Translate setup.

If you use the plugin with private or sensitive conversations, make sure you understand which translation provider is being used and what information that provider receives.

## Current limitations

- Reply-preview translation is currently **not supported**.
- Embed translation is currently disabled.
- "Translate Only Foreign Text" uses heuristic language detection. Very short, ambiguous text, names, abbreviations and slang may not always be detected correctly.
- The plugin relies on Vencord and Discord internals. Discord or Vencord updates may break functionality and require an update.
- Custom Vencord plugins require a Vencord source build.

## Troubleshooting

### The plugin does not appear in Vencord

Make sure:

1. The file is inside:

```text
Vencord/src/userplugins/
```

2. The repository is installed as:

```text
Vencord/src/userplugins/AutoTranslateChannels/index.tsx
```

or the plugin file is placed directly in `Vencord/src/userplugins/` with a `.ts`/`.tsx` filename.

3. Vencord was rebuilt:

```bash
pnpm build
```

4. Discord was restarted.

### Messages are not translated

Check that:

1. **Translate** is enabled.
2. **AutoTranslateChannels** is enabled.
3. The current channel is included in the translation channel list.
4. The selected target language is correct.
5. The message is long enough according to **Minimum Length**.
6. **Translate Only Foreign Text** is not incorrectly skipping the message.
7. Your translation provider/configuration in Vencord Translate is working.

### Translations are slow

Check:

- **Max Concurrent**
- persistent cache
- whether the translation provider is responding normally

Increasing concurrency can improve throughput, but excessive concurrency may increase the chance of rate limits.

## Contributing

Issues and pull requests are welcome.

When reporting a bug, please include:

1. Vencord version or commit
2. Discord client version
3. AutoTranslateChannels version or commit
4. Target language
5. Relevant plugin settings
6. A short reproduction example
7. Build or console errors, if any

Please remove private conversations, usernames, IDs, tokens and other sensitive information before posting screenshots or logs.

## Disclaimer

AutoTranslateChannels is an unofficial Vencord UserPlugin.

It is not affiliated with, endorsed by, or sponsored by Discord Inc. or the Vencord project.

Custom Vencord plugins are intended for advanced users and may cause problems after Vencord or Discord updates. Use this plugin at your own risk.

## License

GPL-3.0-or-later.

See [LICENSE](LICENSE).

## Credits

Created as a community Vencord UserPlugin using Vencord's plugin and translation APIs.

## Links

- Repository: https://github.com/GaapJagen/AutoTranslateChannels
- Releases: https://github.com/GaapJagen/AutoTranslateChannels/releases
- Vencord custom plugin documentation: https://docs.vencord.dev/installing/custom-plugins/
