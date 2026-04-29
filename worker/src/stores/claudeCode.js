import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from './ws';

function extractBlocks(events) {
    const blocks = [];
    for (const evt of events) {
        if (evt.type === 'assistant' && evt.message?.content) {
            const content = evt.message.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    if (block.type === 'text') {
                        blocks.push({ role: 'assistant_text', content: block.text || '', _key: `b-${blocks.length}` });
                    } else if (block.type === 'tool_use') {
                        blocks.push({
                            role: 'tool_use',
                            toolName: block.name || 'tool',
                            toolUseId: block.id,
                            input: block.input || {},
                            result: null,
                            status: 'running',
                            _key: `b-${blocks.length}`,
                        });
                    }
                }
            } else if (typeof content === 'string' && content) {
                blocks.push({ role: 'assistant_text', content, _key: `b-${blocks.length}` });
            }
        } else if (evt.type === 'user' && evt.message?.content) {
            const content = evt.message.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    if (block.type === 'tool_result') {
                        for (let i = blocks.length - 1; i >= 0; i--) {
                            if (blocks[i].role === 'tool_use' && blocks[i].toolUseId === block.tool_use_id && blocks[i].result === null) {
                                blocks[i].result = typeof block.content === 'string' ? block.content :
                                    Array.isArray(block.content) ? block.content.map(b => b.text || '').join('') : JSON.stringify(block.content);
                                blocks[i].status = block.is_error ? 'err' : 'ok';
                                break;
                            }
                        }
                    }
                }
            }
        } else if (evt.type === 'result' && evt.result) {
            blocks.push({ role: 'assistant_text', content: evt.result, _key: `b-${blocks.length}` });
        }
    }
    return blocks;
}

function rebuildMessages(items) {
    const msgs = [];
    for (const item of items) {
        if (item.role === 'user') {
            msgs.push({ role: 'user', content: item.content, _key: item.id });
        } else if (item.role === 'assistant' && item.meta?.events) {
            const blocks = extractBlocks(item.meta.events);
            for (const b of blocks) {
                msgs.push({ ...b, _key: `${item.id}-${b._key}` });
            }
        }
    }
    return msgs;
}

function toolSummary(input) {
    if (input?.command) return input.command.length > 120 ? input.command.slice(0, 120) + '...' : input.command;
    if (input?.file_path) return input.file_path;
    if (input?.pattern) return input.pattern;
    if (input?.description) return input.description;
    return '';
}

export const useClaudeCodeStore = defineStore('claudeCode', () => {
    const ws = useWsStore();

    const status = ref({ installed: false, version: null });
    const sessions = ref([]);
    const activeSessionId = ref('');
    const messages = ref([]);
    const running = ref(false);
    const input = ref('');
    const cwd = ref('~/Desktop');
    const permissionMode = ref('default');

    const liveEvents = [];
    let ready = false;

    function resetMessages() {
        messages.value = [];
        liveEvents.length = 0;
    }

    function initialize() {
        if (ready) return;
        ready = true;

        ws.onMessage('cc.status', (msg) => {
            status.value = msg.data || { installed: false, version: null };
        });

        ws.onMessage('cc.sessions', (msg) => {
            sessions.value = Array.isArray(msg.data?.sessions) ? msg.data.sessions : [];
        });

        ws.onMessage('cc.session_created', (msg) => {
            activeSessionId.value = msg.data?.sessionId || '';
            cwd.value = msg.data?.cwd || '~/Desktop';
            permissionMode.value = msg.data?.permissionMode || 'default';
            resetMessages();
        });

        ws.onMessage('cc.messages', (msg) => {
            const items = Array.isArray(msg.data?.items) ? msg.data.items : [];
            if (msg.data?.sessionId) activeSessionId.value = msg.data.sessionId;
            messages.value = rebuildMessages(items);
        });

        ws.onMessage('cc.event', (msg) => {
            const evt = msg.data?.event;
            if (!evt) return;
            liveEvents.push(evt);
            const blocks = extractBlocks(liveEvents);
            const userMsgs = messages.value.filter(m => m.role === 'user');
            const rebuilt = [];
            for (const m of userMsgs) rebuilt.push(m);
            // Find the last user message index and insert live blocks after it
            // Actually, simpler: keep all stored messages + append live blocks
            const stored = messages.value.filter(m => !m._key?.startsWith('live-'));
            const live = blocks.map((b, i) => ({ ...b, _key: `live-${i}` }));
            messages.value = [...stored, ...live];
        });

        ws.onMessage('cc.run_state', (msg) => {
            running.value = Boolean(msg.data?.running);
        });

        ws.onMessage('cc.done', (msg) => {
            running.value = false;
            liveEvents.length = 0;
            const sid = msg.data?.sessionId || activeSessionId.value;
            if (sid) {
                ws.sendMsg({ type: 'cc.load_messages', to: 'desktop', data: { sessionId: sid } });
            }
        });

        ws.onMessage('cc.error', (msg) => {
            running.value = false;
            liveEvents.length = 0;
            if (msg.data?.error) {
                messages.value.push({
                    role: 'error',
                    content: msg.data.error,
                    _key: `err-${Date.now()}`,
                });
            }
        });
    }

    function send() {
        const text = String(input.value || '').trim();
        if (!text || running.value) return;

        if (!activeSessionId.value) {
            ws.sendMsg({
                type: 'cc.create_session',
                to: 'desktop',
                data: { cwd: cwd.value, permissionMode: permissionMode.value },
            });
            const wait = () => {
                if (activeSessionId.value) {
                    doSend(text);
                } else {
                    setTimeout(wait, 100);
                }
            };
            wait();
            return;
        }

        doSend(text);
    }

    function doSend(text) {
        messages.value.push({ role: 'user', content: text, _key: `u-${Date.now()}` });
        liveEvents.length = 0;
        ws.sendMsg({
            type: 'cc.send',
            to: 'desktop',
            data: {
                sessionId: activeSessionId.value,
                message: text,
                permissionMode: permissionMode.value,
            },
        });
        input.value = '';
        running.value = true;
    }

    function abort() {
        ws.sendMsg({
            type: 'cc.abort',
            to: 'desktop',
            data: { sessionId: activeSessionId.value },
        });
    }

    function newSession() {
        activeSessionId.value = '';
        resetMessages();
    }

    function switchSession(sessionId) {
        if (!sessionId || sessionId === activeSessionId.value) return;
        activeSessionId.value = sessionId;
        const s = sessions.value.find(s => s.sessionId === sessionId);
        if (s) {
            cwd.value = s.cwd || '~/Desktop';
            permissionMode.value = s.permissionMode || 'default';
        }
        liveEvents.length = 0;
        ws.sendMsg({ type: 'cc.load_messages', to: 'desktop', data: { sessionId } });
    }

    function deleteSession(sessionId) {
        if (!sessionId) return;
        ws.sendMsg({ type: 'cc.delete_session', to: 'desktop', data: { sessionId } });
        if (sessionId === activeSessionId.value) {
            activeSessionId.value = '';
            resetMessages();
        }
    }

    return {
        status, sessions, activeSessionId, messages, running, input, cwd, permissionMode,
        initialize, send, abort, newSession, switchSession, deleteSession, toolSummary,
    };
});

export { toolSummary };
