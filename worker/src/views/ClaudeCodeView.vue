<script setup>
import { computed, onMounted, nextTick, ref, watch } from 'vue';
import { useClaudeCodeStore, toolSummary } from '@/stores/claudeCode';
import { useWsStore } from '@/stores/ws';
import { renderMd } from '@/utils/renderMd';

const ws = useWsStore();
const cc = useClaudeCodeStore();
const listRef = ref(null);
const showSessions = ref(false);
const showPermMenu = ref(false);

const PERMISSION_MODES = [
    { id: 'default', label: 'default', desc: 'Ask before risky actions' },
    { id: 'plan', label: 'plan', desc: 'Show plan then execute' },
    { id: 'auto', label: 'auto', desc: 'Auto-approve low-risk' },
    { id: 'acceptEdits', label: 'acceptEdits', desc: 'Accept all edits' },
    { id: 'dontAsk', label: 'dontAsk', desc: 'Never ask' },
    { id: 'bypassPermissions', label: 'bypass', desc: 'Skip all checks' },
];

const currentMode = computed(() =>
    PERMISSION_MODES.find(m => m.id === cc.permissionMode) || PERMISSION_MODES[0]
);

function isNearBottom() {
    const el = listRef.value;
    if (!el) return true;
    return el.scrollHeight - (el.scrollTop + el.clientHeight) < 140;
}

function scrollToBottom(smooth = true) {
    nextTick(() => {
        const el = listRef.value;
        if (!el) return;
        if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        else el.scrollTop = el.scrollHeight;
    });
}

function onComposerKey(event) {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    submit();
}

function submit() {
    if (!canSend.value) return;
    cc.send();
}

const canSend = computed(
    () => ws.showActions && cc.status.installed && !cc.running && cc.input.trim().length > 0
);

const composerPlaceholder = computed(() => {
    if (!ws.showActions) return 'Waiting for desktop...';
    if (!cc.status.installed) return 'Claude Code CLI not installed';
    if (cc.running) return 'Running...';
    return cc.activeSessionId ? 'Continue conversation...' : `New session in ${cc.cwd}`;
});

const sessionTitle = computed(() => {
    if (!cc.activeSessionId) return 'New Session';
    const s = cc.sessions.find(s => s.sessionId === cc.activeSessionId);
    return s?.title || 'Untitled';
});

function fmtTime(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T') + 'Z');
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function pickSession(id) {
    cc.switchSession(id);
    showSessions.value = false;
}

function removeSession(id) {
    if (!confirm('Delete this session and all messages?')) return;
    cc.deleteSession(id);
}

function selectMode(id) {
    cc.permissionMode = id;
    showPermMenu.value = false;
}

// tool call expand state
const expandedTools = ref(new Set());
function toggleTool(key) {
    if (expandedTools.value.has(key)) expandedTools.value.delete(key);
    else expandedTools.value.add(key);
}

onMounted(() => {
    cc.initialize();
    scrollToBottom(false);
});

watch(() => cc.messages.length, (n, o) => {
    if (o === 0 && n > 0) { scrollToBottom(false); return; }
    if (!isNearBottom()) return;
    scrollToBottom(true);
});

watch(
    () => cc.messages[cc.messages.length - 1]?.content,
    () => { if (isNearBottom()) scrollToBottom(true); }
);
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col bg-bg text-ink">
        <!-- Header -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg">
            <div class="min-w-0 flex-1">
                <div class="font-serif font-bold text-[15px] tracking-tight truncate text-ink">Claude Code</div>
                <div class="mt-1 truncate text-[11px] text-faint">{{ sessionTitle }}</div>
            </div>
            <div class="flex items-center gap-1">
                <button class="icon-btn" title="New session" @click="cc.newSession()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>
                <button class="icon-btn" title="Sessions" @click="showSessions = true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9"/>
                        <polyline points="12 7 12 12 15 14"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Message area -->
        <div ref="listRef" class="min-h-0 flex-1 overflow-y-auto px-4 py-5 bg-bg">
            <!-- Empty state -->
            <div v-if="!cc.messages.length && !cc.running" class="text-center pt-6 max-w-[480px] mx-auto">
                <h1 class="font-serif font-bold tracking-tight mb-3 text-ink text-[28px]">Claude Code</h1>
                <p v-if="!cc.status.installed" class="text-[13px] text-bad leading-relaxed mb-4">
                    Claude Code CLI not detected. Install it first, then refresh.
                </p>
                <p v-else class="text-[13px] text-faint leading-relaxed mb-4">
                    Remote chat with Claude Code on your desktop.<br/>
                    Version: {{ cc.status.version }}
                </p>
            </div>

            <!-- Messages -->
            <div v-else class="flex flex-col gap-4">
                <template v-for="(m, i) in cc.messages" :key="m._key || i">
                    <!-- user -->
                    <div v-if="m.role === 'user'"
                        class="self-end max-w-[85%] rounded-[14px] rounded-br-[4px] bg-bg-hi text-ink px-3.5 py-2.5 whitespace-pre-wrap break-words text-[13px]">
                        {{ m.content }}
                    </div>

                    <!-- assistant text -->
                    <div v-else-if="m.role === 'assistant_text'" class="self-start max-w-full">
                        <div class="text-[10px] font-mono font-bold tracking-[0.18em] uppercase mb-1.5 text-accent">
                            CLAUDE
                        </div>
                        <div class="md" v-html="renderMd(m.content || '')"></div>
                    </div>

                    <!-- tool_use -->
                    <details v-else-if="m.role === 'tool_use'"
                        :open="expandedTools.has(m._key)"
                        @toggle="(e) => e.target.open ? expandedTools.add(m._key) : expandedTools.delete(m._key)"
                        class="self-start max-w-full rounded-[10px] border border-line bg-bg-elev overflow-hidden">
                        <summary class="list-none flex items-center gap-2 px-3 py-2 cursor-pointer">
                            <span class="text-[13px] leading-none inline-block transition-transform text-faint"
                                :class="expandedTools.has(m._key) ? 'rotate-90' : ''">›</span>
                            <span class="font-mono text-[12px] truncate flex-1 text-ink">
                                {{ m.toolName }}<template v-if="toolSummary(m.input)">: {{ toolSummary(m.input) }}</template>
                            </span>
                            <span class="text-[13px] leading-none flex-shrink-0"
                                :class="{
                                    'text-good':   m.status === 'ok',
                                    'text-bad':    m.status === 'err',
                                    'text-accent animate-pulse-soft': m.status === 'running',
                                }">
                                {{ m.status === 'ok' ? '✓' : m.status === 'err' ? '✗' : '…' }}
                            </span>
                        </summary>
                        <div class="border-t border-dashed border-line">
                            <div class="px-3 pt-2.5 pb-2 font-mono text-[11.5px] whitespace-pre-wrap break-words leading-[1.55] text-muted">
                                {{ JSON.stringify(m.input, null, 2) }}
                            </div>
                            <div v-if="m.result !== null"
                                class="px-3 pb-3 pt-2.5 font-mono text-[11.5px] whitespace-pre-wrap break-words max-h-[320px] overflow-y-auto leading-[1.55] text-muted border-t border-dashed border-line">
                                {{ m.result }}
                            </div>
                            <div v-else class="px-3 pb-3 pt-2.5 font-mono text-[11.5px] text-faint">
                                running...
                            </div>
                        </div>
                    </details>

                    <!-- error -->
                    <div v-else-if="m.role === 'error'"
                        class="self-start max-w-full rounded-lg border border-bad/30 bg-bad/10 text-bad px-3 py-2 text-[12.5px]">
                        {{ m.content }}
                    </div>
                </template>

                <div v-if="cc.running" class="self-start flex items-center gap-2 text-[12px] text-faint">
                    <span>Running</span>
                    <span class="inline-flex gap-[3px]">
                        <span v-for="i in 3" :key="i" class="dot-bounce-dot"
                            :style="{ animationDelay: `${(i - 1) * 0.2}s` }"></span>
                    </span>
                </div>
            </div>
        </div>

        <!-- Composer -->
        <form class="flex-shrink-0 px-4 py-3.5 border-t border-line bg-bg" @submit.prevent="submit">
            <!-- cwd + permission for new sessions -->
            <div v-if="!cc.activeSessionId" class="flex items-center gap-2 mb-2">
                <input v-model="cc.cwd" type="text" placeholder="Working directory"
                    class="flex-1 h-8 rounded-lg border border-line bg-bg px-2.5 text-[12px] text-ink outline-none focus:border-accent" />
                <div class="relative">
                    <button type="button"
                        class="h-8 px-2.5 rounded-lg border border-line bg-bg text-[12px] text-ink hover:border-accent flex items-center gap-1"
                        @click="showPermMenu = !showPermMenu">
                        {{ currentMode.label }}
                        <span class="text-faint text-[10px]">▼</span>
                    </button>
                    <div v-if="showPermMenu"
                        class="absolute right-0 bottom-10 z-50 w-56 rounded-lg border border-line bg-bg-elev shadow-xl overflow-hidden">
                        <button v-for="m in PERMISSION_MODES" :key="m.id" type="button"
                            class="w-full text-left px-3 py-2 text-[12px] hover:bg-bg-hi flex flex-col"
                            :class="m.id === cc.permissionMode ? 'bg-bg-hi' : ''"
                            @click="selectMode(m.id)">
                            <span class="font-mono text-ink">{{ m.label }}</span>
                            <span class="text-[10px] text-faint">{{ m.desc }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="composer-shell flex items-end gap-2 rounded-[14px] border border-line bg-bg-elev pl-2 pr-2 py-2 transition-colors focus-within:border-accent">
                <textarea
                    v-model="cc.input"
                    rows="1"
                    :placeholder="composerPlaceholder"
                    class="flex-1 bg-transparent border-0 outline-none resize-none py-1.5 px-1.5 text-[13px] leading-[1.5] text-ink placeholder:text-faint composer-textarea"
                    :disabled="!ws.showActions || !cc.status.installed || cc.running"
                    @keydown="onComposerKey"></textarea>

                <button v-if="cc.running" type="button"
                    class="w-10 h-10 rounded-[10px] bg-bad text-white flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90"
                    title="Stop"
                    @click="cc.abort()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="1.5"/>
                    </svg>
                </button>
                <button v-else type="submit"
                    class="w-10 h-10 rounded-[10px] bg-accent text-bg flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    :disabled="!canSend"
                    title="Send">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="13 6 19 12 13 18"/>
                    </svg>
                </button>
            </div>
            <p class="text-center text-[10.5px] mt-2 text-faint">
                Enter to send · Shift+Enter newline
            </p>
        </form>

        <!-- Sessions modal -->
        <div v-if="showSessions"
            class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
            @click.self="showSessions = false">
            <section class="flex h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-[14px] border border-line bg-bg-elev shadow-2xl">
                <header class="flex items-center justify-between border-b border-line px-4 py-3">
                    <div class="font-serif font-bold text-[15px] tracking-tight text-ink">Sessions</div>
                    <div class="flex items-center gap-2">
                        <button class="rounded-md px-2.5 py-1 text-[12px] bg-accent text-bg hover:opacity-90"
                            @click="cc.newSession(); showSessions = false;">+ New</button>
                        <button class="h-8 w-8 rounded-md flex items-center justify-center bg-bg-hi text-muted hover:opacity-80"
                            @click="showSessions = false">✕</button>
                    </div>
                </header>
                <div class="min-h-0 flex-1 overflow-y-auto p-2">
                    <div v-if="!cc.sessions.length"
                        class="rounded-[10px] border border-line bg-bg text-muted px-4 py-5 text-[13px] m-2">
                        No sessions yet.
                    </div>
                    <div v-for="s in cc.sessions" :key="s.sessionId"
                        class="group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                        :class="s.sessionId === cc.activeSessionId ? 'bg-bg-hi' : 'hover:bg-bg-hi'"
                        @click="pickSession(s.sessionId)">
                        <span v-if="s.sessionId === cc.activeSessionId"
                            class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-accent"></span>
                        <div class="flex-1 min-w-0">
                            <div class="truncate text-[13px] text-ink">{{ s.title || 'Untitled' }}</div>
                            <div class="text-[10.5px] text-faint mt-0.5">
                                {{ s.cwd }} · {{ s.messageCount }} events · {{ fmtTime(s.updatedAt) }}
                            </div>
                        </div>
                        <button class="opacity-0 group-hover:opacity-100 text-faint hover:text-bad text-sm px-2 transition-opacity"
                            title="Delete"
                            @click.stop="removeSession(s.sessionId)">×</button>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.icon-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-line);
    border-radius: 10px;
    background: var(--color-bg-elev);
    color: var(--color-ink);
    transition: border-color 0.12s ease;
}
.icon-btn:hover { border-color: var(--color-accent); }

.composer-textarea {
    min-height: 28px;
    max-height: 180px;
    field-sizing: content;
}

.dot-bounce-dot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: var(--color-accent);
    animation: dot-bounce 1.2s ease-in-out infinite;
}

.animate-pulse-soft {
    animation: pulse-soft 1.2s ease-in-out infinite;
}
</style>
