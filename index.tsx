/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import {
    Button,
    ChannelStore,
    GuildStore,
    MessageStore,
    Parser,
    React,
    SelectedChannelStore,
    Text,
    UserStore,
    Menu,
} from "@webpack/common";

import { translate, TranslationValue } from "@plugins/translate/utils";
import { settings as translateSettings } from "@plugins/translate/settings";
import { TranslateIcon } from "@plugins/translate/TranslateIcon";

const STORE_KEY = "AutoTranslateChannels_channelIds";

const settings = definePluginSettings({
    replaceOriginal: {
        type: OptionType.BOOLEAN,
        description: "Show the translation instead of the original message",
        default: false,
    },
    translateOnlyForeignText: {
        type: OptionType.BOOLEAN,
        description: "Skip messages that appear to be in the target language",
        default: true,
    },
    minLength: {
        type: OptionType.NUMBER,
        description: "Do not translate messages shorter than this many characters",
        default: 5,
        min: 1,
        max: 100,
    },
    ignoreNonText: {
        type: OptionType.BOOLEAN,
        description: "Skip messages containing only numbers, punctuation, symbols or emoji",
        default: true,
    },
    maxConcurrent: {
        type: OptionType.SELECT,
        description: "Maximum number of translations running at once",
        options: [
            { label: "1 (most conservative)", value: 1 },
            { label: "2", value: 2 },
            { label: "3 (recommended)", value: 3, default: true },
            { label: "4", value: 4 },
            { label: "5 (fastest)", value: 5 },
        ],
    },
    persistentCache: {
        type: OptionType.BOOLEAN,
        description: "Keep translations between Discord restarts",
        default: true,
    },
    cacheLimit: {
        type: OptionType.NUMBER,
        description: "Maximum number of cached translations",
        default: 5000,
        min: 100,
        max: 20000,
    },
    onlyNewMessages: {
        type: OptionType.BOOLEAN,
        description: "Translate only messages sent after the plugin started",
        default: true,
    },
    targetLanguage: {
        type: OptionType.SELECT,
        description: "Language to translate messages into",
        options: [
            { label: "Русский", value: "ru", default: true },
            { label: "English", value: "en" },
            { label: "Deutsch", value: "de" },
            { label: "Français", value: "fr" },
            { label: "Español", value: "es" },
            { label: "Italiano", value: "it" },
            { label: "Português", value: "pt" },
            { label: "Polski", value: "pl" },
            { label: "Українська", value: "uk" },
            { label: "Türkçe", value: "tr" },
            { label: "Nederlands", value: "nl" },
            { label: "Čeština", value: "cs" },
            { label: "Svenska", value: "sv" },
            { label: "中文", value: "zh-CN" },
            { label: "日本語", value: "ja" },
            { label: "한국어", value: "ko" },
        ],
    },
    translateOwnMessages: {
        type: OptionType.BOOLEAN,
        description: "Translate your own messages",
        default: false,
    },
    translateBots: {
        type: OptionType.BOOLEAN,
        description: "Translate messages from bots and webhooks",
        default: true,
    },
    showLabel: {
        type: OptionType.BOOLEAN,
        description: "Show the 'Перевод' label when the original is visible",
        default: true,
    },
});

let channelIds: string[] = [];
const listeners = new Set<() => void>();

function emitChange() {
    listeners.forEach(listener => listener());
}

function addListener(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function isEnabled(channelId: string) {
    return channelIds.includes(channelId);
}

async function loadChannelIds() {
    const stored = await DataStore.get<string[]>(STORE_KEY);
    channelIds = Array.isArray(stored) ? stored : [];
    emitChange();
}

function saveChannelIds(ids: string[]) {
    channelIds = [...new Set(ids)];
    void DataStore.set(STORE_KEY, channelIds);
    emitChange();
}

function toggleChannel(channelId: string) {
    if (isEnabled(channelId)) {
        saveChannelIds(channelIds.filter(id => id !== channelId));
    } else {
        saveChannelIds([...channelIds, channelId]);
    }
}

type CachedTranslation = {
    text: string;
    sourceLanguage: string;
    original: string;
    targetLanguage: string;
};

const CACHE_KEY = "AutoTranslateChannels_translationCache";
const cache = new Map<string, CachedTranslation>();
const pending = new Map<string, Promise<TranslationValue>>();
const queue: Array<{
    key: string;
    message: Message;
    content: string;
    resolve: (value: TranslationValue) => void;
    reject: (error: unknown) => void;
}> = [];
let activeTranslations = 0;
let pluginStartedAt = Date.now();

function cacheKey(message: Message, content: string) {
    return `${message.id}:${content}:${settings.store.targetLanguage}`;
}

async function loadTranslationCache() {
    if (!settings.store.persistentCache) return;

    const stored = await DataStore.get<Record<string, CachedTranslation>>(CACHE_KEY);
    if (!stored || typeof stored !== "object") return;

    const entries = Object.entries(stored).slice(-settings.store.cacheLimit);
    cache.clear();
    for (const [key, value] of entries) {
        if (value?.text && value.original) cache.set(key, value);
    }
}

function persistTranslationCache() {
    if (!settings.store.persistentCache) return;

    const entries = Array.from(cache.entries()).slice(-settings.store.cacheLimit);
    void DataStore.set(CACHE_KEY, Object.fromEntries(entries));
}

function putCache(key: string, value: TranslationValue, original: string) {
    cache.delete(key);
    cache.set(key, {
        text: value.text,
        sourceLanguage: value.sourceLanguage,
        original,
        targetLanguage: settings.store.targetLanguage,
    });

    while (cache.size > settings.store.cacheLimit) {
        cache.delete(cache.keys().next().value!);
    }

    persistTranslationCache();
}

function getCached(key: string): TranslationValue | null {
    const value = cache.get(key);
    if (!value) return null;

    // Refresh LRU order.
    cache.delete(key);
    cache.set(key, value);

    return {
        text: value.text,
        sourceLanguage: value.sourceLanguage,
    };
}

type TargetLanguage = {
    code: string;
    label: string;
    script: "cyrillic" | "latin" | "greek" | "arabic" | "hebrew" | "cjk" | "japanese" | "korean";
    markers: string[];
    distinctive: RegExp;
};

const TARGET_LANGUAGE_INFO: Record<string, TargetLanguage> = {
    ru: {
        code: "ru",
        label: "Русский",
        script: "cyrillic",
        markers: [" и ", " в ", " не ", " на ", " что ", " это ", " как ", " для ", " но ", " или ", " уже ", " ещё ", " можно ", " нужно ", " будет ", " я ", " ты ", " мы ", " вы "],
        distinctive: /[ыэъё]/i,
    },
    uk: {
        code: "uk",
        label: "Українська",
        script: "cyrillic",
        markers: [" і ", " в ", " не ", " на ", " що ", " це ", " як ", " для ", " але ", " або ", " вже ", " можна ", " треба ", " буде ", " я ", " ти ", " ми ", " ви "],
        distinctive: /[іїєґ]/i,
    },
    pl: {
        code: "pl",
        label: "Polski",
        script: "latin",
        markers: [" i ", " nie ", " na ", " że ", " to ", " jak ", " dla ", " ale ", " lub ", " już ", " jest ", " można ", " trzeba ", " będzie ", " się "],
        distinctive: /[ąćęłńóśźż]/i,
    },
    cs: {
        code: "cs",
        label: "Čeština",
        script: "latin",
        markers: [" a ", " ne ", " na ", " že ", " to ", " jak ", " pro ", " ale ", " nebo ", " už ", " je ", " může ", " bude ", " se "],
        distinctive: /[čďěňřšťůž]/i,
    },
    de: {
        code: "de",
        label: "Deutsch",
        script: "latin",
        markers: [" und ", " nicht ", " der ", " die ", " das ", " ist ", " für ", " mit ", " auf ", " aber ", " oder ", " schon ", " kann ", " wird ", " ich ", " du ", " wir "],
        distinctive: /[äöüß]/i,
    },
    fr: {
        code: "fr",
        label: "Français",
        script: "latin",
        markers: [" et ", " pas ", " les ", " des ", " une ", " est ", " pour ", " avec ", " dans ", " mais ", " ou ", " déjà ", " peut ", " sera ", " je ", " tu ", " nous "],
        distinctive: /[àâçéèêëîïôùûüÿœ]/i,
    },
    es: {
        code: "es",
        label: "Español",
        script: "latin",
        markers: [" y ", " no ", " los ", " las ", " una ", " es ", " para ", " con ", " que ", " pero ", " o ", " ya ", " puede ", " será ", " yo ", " tú ", " nosotros "],
        distinctive: /[áéíóúüñ¿¡]/i,
    },
    it: {
        code: "it",
        label: "Italiano",
        script: "latin",
        markers: [" e ", " non ", " il ", " la ", " gli ", " una ", " è ", " per ", " con ", " che ", " ma ", " o ", " già ", " può ", " io ", " tu ", " noi "],
        distinctive: /[àèéìíîòóùú]/i,
    },
    pt: {
        code: "pt",
        label: "Português",
        script: "latin",
        markers: [" e ", " não ", " os ", " as ", " uma ", " é ", " para ", " com ", " que ", " mas ", " ou ", " já ", " pode ", " será ", " eu ", " você "],
        distinctive: /[ãõáàâçéêíóôú]/i,
    },
    nl: {
        code: "nl",
        label: "Nederlands",
        script: "latin",
        markers: [" en ", " niet ", " het ", " een ", " is ", " voor ", " met ", " van ", " maar ", " of ", " al ", " kan ", " zal ", " ik ", " jij ", " wij "],
        distinctive: /[ëï]/i,
    },
    sv: {
        code: "sv",
        label: "Svenska",
        script: "latin",
        markers: [" och ", " inte ", " det ", " en ", " ett ", " är ", " för ", " med ", " som ", " men ", " eller ", " redan ", " kan ", " jag ", " du ", " vi "],
        distinctive: /[åäö]/i,
    },
    tr: {
        code: "tr",
        label: "Türkçe",
        script: "latin",
        markers: [" ve ", " değil ", " bir ", " bu ", " için ", " ile ", " ama ", " veya ", " zaten ", " olabilir ", " ben ", " sen ", " biz "],
        distinctive: /[çğıİöşü]/i,
    },
    en: {
        code: "en",
        label: "English",
        script: "latin",
        markers: [" the ", " and ", " not ", " this ", " that ", " is ", " are ", " for ", " with ", " but ", " or ", " already ", " can ", " will ", " i ", " you ", " we "],
        distinctive: /(?:\b(?:the|and|this|that|with|would|could|should|there|they)\b)/i,
    },
    "zh-CN": {
        code: "zh-CN",
        label: "中文",
        script: "cjk",
        markers: ["的", "了", "是", "我", "你", "他", "她", "在", "不", "有", "这", "那", "和", "吗", "可以", "会", "就"],
        distinctive: /[\u3400-\u4dbf\u4e00-\u9fff]/,
    },
    ja: {
        code: "ja",
        label: "日本語",
        script: "japanese",
        markers: ["です", "ます", "でした", "ます", "これ", "それ", "ここ", "ない", "ある", "する", "して", "から", "まで", "でも", "私", "あなた"],
        distinctive: /[\u3040-\u309f\u30a0-\u30ff]/,
    },
    ko: {
        code: "ko",
        label: "한국어",
        script: "korean",
        markers: ["은", "는", "이", "가", "을", "를", "에", "의", "입니다", "있다", "하다", "그리고", "하지만", "안", "저", "나", "너"],
        distinctive: /[\uac00-\ud7af]/,
    },
};

function countLetters(text: string): number {
    return (text.match(/\p{L}/gu) ?? []).length;
}

function normalizeForLanguageDetection(text: string): string {
    return ` ${text.toLowerCase().replace(/\s+/g, " ").trim()} `;
}

function looksLikeTargetLanguage(text: string, targetLanguage: string): boolean {
    const info = TARGET_LANGUAGE_INFO[targetLanguage];
    if (!info) return false;

    const letters = countLetters(text);
    if (!letters) return false;

    if (info.script === "cjk") {
        const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) ?? []).length;
        return cjk / letters >= 0.35;
    }

    if (info.script === "japanese") {
        const kana = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) ?? []).length;
        return kana >= 1 && kana / letters >= 0.15;
    }

    if (info.script === "korean") {
        const hangul = (text.match(/[\uac00-\ud7af]/g) ?? []).length;
        return hangul / letters >= 0.35;
    }

    if (info.script === "cyrillic") {
        const cyrillic = (text.match(/[\u0400-\u04ff]/g) ?? []).length;
        if (cyrillic / letters < 0.55) return false;
    } else if (info.script === "latin") {
        const latin = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]/g) ?? []).length;
        if (latin / letters < 0.55) return false;
    }

    const lower = normalizeForLanguageDetection(text);
    const markerScore = info.markers.reduce(
        (score, marker) => score + (lower.includes(marker) ? 1 : 0),
        0,
    );

    // For longer text, one strong marker or two ordinary markers are enough.
    // Distinctive letters/words can identify a language even when punctuation
    // or short sentence structure hides the markers.
    return markerScore >= 2 || (markerScore >= 1 && info.distinctive.test(text));
}

function isUsefulText(text: string): boolean {
    const normalized = text.trim();
    if (normalized.length < settings.store.minLength) return false;

    if (!settings.store.ignoreNonText) return true;

    // At least one letter is required. This rejects "123", "!!!", "😂😂😂",
    // "+10%", etc. without rejecting normal messages containing punctuation.
    return /[\p{L}]/u.test(normalized);
}

function shouldTranslateMessage(message: Message, content: string): boolean {
    if (!isUsefulText(content)) return false;

    if (
        settings.store.onlyNewMessages &&
        new Date(message.timestamp).getTime() < pluginStartedAt
    ) return false;

    if (
        settings.store.translateOnlyForeignText &&
        looksLikeTargetLanguage(content, settings.store.targetLanguage)
    ) return false;

    const currentUser = UserStore.getCurrentUser();
    if (!settings.store.translateOwnMessages && currentUser?.id === message.author.id) return false;
    if (!settings.store.translateBots && message.author.bot) return false;

    return true;
}

function runQueue() {
    while (activeTranslations < settings.store.maxConcurrent && queue.length) {
        const job = queue.shift()!;
        activeTranslations++;

        doTranslation(job.message, job.content, job.key)
            .then(job.resolve, job.reject)
            .finally(() => {
                activeTranslations--;
                runQueue();
            });
    }
}

async function doTranslation(
    message: Message,
    content: string,
    key = cacheKey(message, content),
): Promise<TranslationValue> {
    const cached = getCached(key);
    if (cached) return cached;

    // translate() reads receivedOutput synchronously before its network await.
    // We temporarily set it so this plugin can have its own target language
    // without permanently changing the user's Translate settings.
    const previousOutput = translateSettings.store.receivedOutput;

    try {
        translateSettings.store.receivedOutput = settings.store.targetLanguage;
        const result = await translate("received", content);
        putCache(key, result, content);
        return result;
    } finally {
        translateSettings.store.receivedOutput = previousOutput;
    }
}

function getTranslationWithKey(
    message: Message,
    content: string,
    key: string,
) {
    const cached = getCached(key);
    if (cached) return Promise.resolve(cached);

    const existing = pending.get(key);
    if (existing) return existing;

    const promise = new Promise<TranslationValue>((resolve, reject) => {
        queue.push({
            key,
            message,
            content,
            resolve,
            reject,
        });
        runQueue();
    }).finally(() => {
        pending.delete(key);
    });

    pending.set(key, promise);
    return promise;
}

function getTranslation(message: Message, content: string) {
    return getTranslationWithKey(message, content, cacheKey(message, content));
}

function getContent(message: Message): string {
    return message.content?.trim() ?? "";
}

function getCachedForMessage(message: Message, content = getContent(message)): TranslationValue | null {
    if (!content) return null;
    return getCached(cacheKey(message, content));
}

function invalidateMessageTranslations(messageId: string) {
    for (const key of cache.keys()) {
        if (
            key.startsWith(`${messageId}:`) ||
            key.startsWith(`embed:${messageId}:`)
        ) {
            cache.delete(key);
        }
    }
    persistTranslationCache();
}

function handleMessageUpdate({ message }: { message?: Message }) {
    if (!message?.id) return;

    // Always bump the revision. An edit can also move a message out of the
    // translation scope (for example, it becomes Russian or too short), so
    // an older in-flight translation must never be allowed to paint again.
    bumpMessageRevision(message.id);

    if (!isEnabled(message.channel_id)) return;

    // The cache key contains the message content, but removing old versions
    // keeps the persistent cache from retaining stale edits indefinitely.
    invalidateMessageTranslations(message.id);
    originalVisibility.delete(message.id);
}

function handleMessageDelete({ id, channelId }: { id?: string; channelId?: string }) {
    if (!id) return;

    bumpMessageRevision(id);
    invalidateMessageTranslations(id);
    originalVisibility.delete(id);
    messageRevisions.delete(id);

    if (channelId) {
        for (const key of pending.keys()) {
            if (key.startsWith(`${id}:`)) {
                pending.delete(key);
            }
        }
    }
}

function handleMessageDeleteBulk({ ids }: { ids?: string[] }) {
    ids?.forEach(handleMessageDelete);
}


const originalVisibility = new Map<string, boolean>();
const replaceOriginalListeners = new Set<() => void>();
let replaceOriginalPatchActive = false;

function emitReplaceOriginalChange() {
    replaceOriginalListeners.forEach(listener => listener());
}

function addReplaceOriginalListener(listener: () => void) {
    replaceOriginalListeners.add(listener);
    return () => replaceOriginalListeners.delete(listener);
}

function markReplaceOriginalPatchActive() {
    if (!replaceOriginalPatchActive) {
        replaceOriginalPatchActive = true;
        emitReplaceOriginalChange();
    }
}

function toggleOriginal(message: Message) {
    const messageId = message.id;
    originalVisibility.set(messageId, !(originalVisibility.get(messageId) ?? false));
    emitReplaceOriginalChange();
}

function ReplaceOriginalContent({
    message,
    original,
}: {
    message: Message;
    original: React.ReactNode;
}) {
    const pluginSettings = settings.use(["replaceOriginal"]);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => addReplaceOriginalListener(forceUpdate), []);

    if (!pluginSettings.replaceOriginal || !isEnabled(message.channel_id)) {
        return <>{original}</>;
    }

    if (originalVisibility.get(message.id)) {
        return <>{original}</>;
    }

    const content = getContent(message);
    const result = getCachedForMessage(message, content);

    if (!result?.text || result.text.trim() === content) {
        return <>{original}</>;
    }

    return (
        <div
            style={{
                color: "var(--text-normal)",
                fontFamily: "var(--font-primary)",
                fontSize: 16,
                lineHeight: "1.375",
                fontWeight: 400,
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
            }}
        >
            {Parser.parse(result.text)}
        </div>
    );
}

const messageRevisions = new Map<string, number>();

function bumpMessageRevision(messageId: string) {
    messageRevisions.set(messageId, (messageRevisions.get(messageId) ?? 0) + 1);
}


function TranslationAccessory({ message }: { message: Message }) {
    const pluginSettings = settings.use([
        "replaceOriginal",
        "showLabel",
        "translateOwnMessages",
        "translateBots",
    ]);

    const content = getContent(message);
    const [result, setResult] = React.useState<TranslationValue | null>(
        getCachedForMessage(message, content),
    );


    React.useEffect(() => {
        let cancelled = false;
        const revision = messageRevisions.get(message.id) ?? 0;

        // Discord re-renders the message component after MESSAGE_UPDATE.
        // Including content in the dependency list is important: an edited
        // message must not keep showing the translation of its old content.
        const cached = getCachedForMessage(message, content);
        setResult(cached);

        if (!isEnabled(message.channel_id) || !content) return;

        if (!shouldTranslateMessage(message, content)) return;

        getTranslation(message, content)
            .then(value => {
                if (cancelled) return;

                const currentRevision = messageRevisions.get(message.id) ?? 0;
                const currentMessage = MessageStore.getMessage(
                    message.channel_id,
                    message.id,
                );

                // Do not let an older async translation overwrite an edited
                // message. The store check also covers Discord reusing the
                // same React component/message object during an edit.
                if (
                    currentRevision !== revision ||
                    currentMessage?.content !== content
                ) {
                    return;
                }

                setResult(value);
            })
            .catch(() => {
                if (!cancelled) setResult(null);
            });

        return () => {
            cancelled = true;
        };
    }, [
        message.id,
        message.channel_id,
        content,
        pluginSettings.translateOwnMessages,
        pluginSettings.translateBots,
        settings.store.targetLanguage,
        settings.store.minLength,
        settings.store.translateOnlyForeignText,
        settings.store.ignoreNonText,
        settings.store.onlyNewMessages,
    ]);

    if (!result?.text) return null;

    const original = content;
    if (pluginSettings.replaceOriginal && replaceOriginalPatchActive) {
        return null;
    }
    if (result.text.trim() === original) return null;

    return (
        <div
            style={{
                marginTop: pluginSettings.replaceOriginal ? 0 : 4,
                paddingTop: pluginSettings.replaceOriginal ? 0 : 4,
                borderTop: pluginSettings.replaceOriginal
                    ? "none"
                    : "1px solid var(--background-modifier-accent)",
                color: "var(--text-normal)",
                opacity: 0.92,
                lineHeight: 1.35,
            }}
        >
            {pluginSettings.showLabel && !pluginSettings.replaceOriginal && (
                <div
                    style={{
                        color: "var(--text-muted)",
                        fontSize: 11,
                        marginBottom: 2,
                    }}
                >
                    Перевод
                </div>
            )}
            {Parser.parse(result.text)}
        </div>
    );
}

function ChannelManager() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => addListener(forceUpdate), []);

    const selectedChannelId = SelectedChannelStore.getChannelId();

    function addCurrentChannel() {
        if (selectedChannelId && !isEnabled(selectedChannelId)) {
            toggleChannel(selectedChannelId);
        }
    }

    const groups = new Map<string, { name: string; ids: string[] }>();

    for (const id of channelIds) {
        const channel = ChannelStore.getChannel(id);
        const guildId = channel?.guild_id ?? "direct";
        const guildName = channel?.guild_id
            ? GuildStore.getGuild(channel.guild_id)?.name ?? "Неизвестный сервер"
            : "Личные сообщения";

        const group = groups.get(guildId) ?? { name: guildName, ids: [] };
        group.ids.push(id);
        groups.set(guildId, group);
    }

    return (
        <div style={{ marginTop: 12 }}>
            <Text variant="text-md/bold">Каналы автоперевода</Text>

            <div style={{ marginTop: 8, marginBottom: 12 }}>
                <Button
                    disabled={!selectedChannelId || isEnabled(selectedChannelId)}
                    onClick={addCurrentChannel}
                >
                    {selectedChannelId && isEnabled(selectedChannelId)
                        ? "Текущий канал уже добавлен"
                        : "Добавить текущий канал"}
                </Button>
            </div>

            {groups.size === 0 ? (
                <Text variant="text-sm/normal" style={{ opacity: 0.65 }}>
                    Список пуст. Открой нужный канал и нажми «Добавить текущий канал».
                </Text>
            ) : (
                Array.from(groups.entries()).map(([guildId, group]) => (
                    <div key={guildId} style={{ marginBottom: 16 }}>
                        <Text variant="text-sm/bold">{group.name}</Text>

                        {group.ids.map(id => {
                            const channel = ChannelStore.getChannel(id);
                            const name = channel?.name ? `#${channel.name}` : `Канал ${id}`;

                            return (
                                <div
                                    key={id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "7px 0",
                                        gap: 12,
                                    }}
                                >
                                    <Text variant="text-sm/normal">{name}</Text>
                                    <Button
                                        size={Button.Sizes.SMALL}
                                        onClick={() => toggleChannel(id)}
                                    >
                                        Убрать
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                ))
            )}
        </div>
    );
}

const channelContextPatch: NavContextMenuPatchCallback = (children, { channel }: { channel: { id: string; name?: string; guild_id?: string | null } }) => {
    if (!channel?.id) return;

    const group = findGroupChildrenByChildId("mark-channel-read", children)
        ?? findGroupChildrenByChildId("mute-channel", children);

    if (!group) return;

    const enabled = isEnabled(channel.id);

    group.push(
        <Menu.MenuItem
            id="auto-translate-channel"
            label={enabled ? "Выключить автоперевод" : "Включить автоперевод"}
            action={() => toggleChannel(channel.id)}
        />,
    );
};

export default definePlugin({
    name: "AutoTranslateChannels",
    description: "Automatically translates messages in selected Discord channels.",
    tags: ["Translation", "Chat", "Utility"],
    authors: [{ name: "GaapJagen", id: 298466559033344008n }],

    dependencies: ["Translate"],

    settings,

    settingsAboutComponent: () => <ChannelManager />,

    patches: [
        {
            find: "childrenMessageContent:n,onMouseMove:L",
            replacement: {
                match: /childrenMessageContent:n,onMouseMove:L/,
                replace: "childrenMessageContent:$self.renderMessageContent(n,arguments[0].message),onMouseMove:L",
            },
        },
    ],

    renderMessageContent(original: React.ReactNode, message: Message) {
        markReplaceOriginalPatchActive();
        return (
            <ReplaceOriginalContent
                message={message}
                original={original}
            />
        );
    },

    contextMenus: {
        "channel-context": channelContextPatch,
    },

    flux: {
        MESSAGE_UPDATE: handleMessageUpdate,
        MESSAGE_DELETE: handleMessageDelete,
        MESSAGE_DELETE_BULK: handleMessageDeleteBulk,
    },

    renderMessageAccessory({ message }) {
        return (
            <TranslationAccessory message={message} />
        );
    },

    messagePopoverButton: {
        icon: TranslateIcon,
        render(message: Message) {
            if (!settings.store.replaceOriginal) return null;
            if (!isEnabled(message.channel_id)) return null;

            const content = getContent(message);
            if (!content) return null;

            return {
                label: originalVisibility.get(message.id) ? "Скрыть оригинал" : "Оригинал",
                icon: TranslateIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => toggleOriginal(message),
            };
        },
    },

    async start() {
        pluginStartedAt = Date.now();
        await loadChannelIds();
        await loadTranslationCache();
    },

    stop() {
        originalVisibility.clear();
        replaceOriginalListeners.clear();
        replaceOriginalPatchActive = false;
        messageRevisions.clear();
        cache.clear();
        pending.clear();
        queue.length = 0;
        activeTranslations = 0;
        channelIds = [];
        listeners.clear();
    },
});
