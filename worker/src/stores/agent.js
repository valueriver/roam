import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from './ws';

// 把一个 LLM toolCall 映射成 UI 的 tool_call item
function mapToolCall(toolCall, key) {
    const name = toolCall?.function?.name || 'tool';
    const rawArgs = toolCall?.function?.arguments || '';
    let args = null;
    try { args = JSON.parse(rawArgs); } catch {}
    const title = args?.description || args?.reason || name;
    const command = name === 'terminal_exec' ? (args?.command || '') : '';
    const detail = command ? '' : (args ? JSON.stringify(args, null, 2) : rawArgs);
    return {
        type: 'tool_call',
        toolCall,
        title,
        command,
        detail,
        result: null,
        status: 'running',
        _key: key,
    };
}

// db 行 → UI 扁平列表
function parseRows(rows) {
    const list = [];
    for (const row of rows) {
        const base = row._id != null ? `db:${row._id}` : null;
        if (row.role === 'user') {
            list.push({ role: 'user', content: String(row.content || ''), _key: base ? `${base}:user` : undefined });
        } else if (row.role === 'assistant') {
            if (row.content) {
                list.push({ role: 'assistant', content: String(row.content), _key: base ? `${base}:assistant` : undefined });
            }
            if (Array.isArray(row.tool_calls)) {
                row.tool_calls.forEach((tc, i) => {
                    list.push(mapToolCall(tc, base ? `${base}:tc:${i}` : undefined));
                });
            }
        } else if (row.role === 'tool') {
            // 反向扫，填最近一个 open 的 tool_call
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].type === 'tool_call' && list[i].result === null) {
                    list[i].result = String(row.content || '');
                    list[i].status = 'ok';
                    break;
                }
            }
        }
    }
    return list;
}

export const useAgentStore = defineStore('agent', () => {
    const ws = useWsStore();

    const messages = ref([]);
    const input = ref('');
    const running = ref(false);
    const configured = ref(false);
    const provider = ref('');
    const model = ref('');
    const apiUrl = ref('');
    const apiKeyMasked = ref('');

    const sessionId = ref('');
    const sessionTitle = ref('新会话');
    const sessions = ref([]);
    const hasMore = ref(false);
    const loadedOffset = ref(0);

    const seenKeys = new Set();
    let streamingAssistantKey = '';
    let ready = false;

    function addUnique(items, { prepend = false } = {}) {
        const uniq = [];
        for (const item of items) {
            const key = item?._key;
            if (key && seenKeys.has(key)) continue;
            if (key) seenKeys.add(key);
            uniq.push(item);
        }
        messages.value = prepend ? [...uniq, ...messages.value] : [...messages.value, ...uniq];
    }

    function resetView() {
        messages.value = [];
        hasMore.value = false;
        loadedOffset.value = 0;
        seenKeys.clear();
        streamingAssistantKey = '';
    }

    function initialize() {
        if (ready) return;
        ready = true;

        ws.onMessage('agent.config', (msg) => {
            configured.value = Boolean(msg.data?.configured);
            provider.value = msg.data?.provider || '';
            model.value = msg.data?.model || '';
            apiUrl.value = msg.data?.apiUrl || '';
            apiKeyMasked.value = msg.data?.apiKeyMasked || '';
        });

        ws.onMessage('agent.session', (msg) => {
            sessionId.value = msg.data?.id || '';
            sessionTitle.value = msg.data?.title || '新会话';
        });

        ws.onMessage('agent.sessions', (msg) => {
            sessions.value = Array.isArray(msg.data?.sessions) ? msg.data.sessions : [];
            if (msg.data?.activeId) sessionId.value = msg.data.activeId;
        });

        ws.onMessage('agent.history', (msg) => {
            const list = Array.isArray(msg.data?.messages) ? msg.data.messages : [];
            const isInitial = (msg.data?.offset || 0) === 0;
            if (isInitial) {
                resetView();
                if (msg.data?.session) {
                    sessionId.value = msg.data.session.id || '';
                    sessionTitle.value = msg.data.session.title || '新会话';
                }
                addUnique(parseRows(list));
            } else {
                addUnique(parseRows(list), { prepend: true });
            }
            hasMore.value = Boolean(msg.data?.hasMore);
            loadedOffset.value = (msg.data?.offset || 0) + list.length;
        });

        ws.onMessage('agent.run_state', (msg) => {
            running.value = Boolean(msg.data?.running);
        });

        ws.onMessage('agent.delta', (msg) => {
            const delta = msg.data?.delta || '';
            if (!streamingAssistantKey) {
                streamingAssistantKey = `ws:${Date.now()}:assistant`;
                seenKeys.add(streamingAssistantKey);
                messages.value.push({ role: 'assistant', content: '', _key: streamingAssistantKey, streaming: true });
            }
            const m = messages.value.find((x) => x._key === streamingAssistantKey);
            if (m) m.content += delta;
        });

        ws.onMessage('agent.tool_call', (msg) => {
            if (streamingAssistantKey) {
                const m = messages.value.find((x) => x._key === streamingAssistantKey);
                if (m) m.streaming = false;
                streamingAssistantKey = '';
            }
            const key = `ws:${Date.now()}:tc:${Math.random().toString(36).slice(2, 6)}`;
            seenKeys.add(key);
            messages.value.push(mapToolCall(msg.data?.toolCall, key));
        });

        ws.onMessage('agent.tool_result', (msg) => {
            const content = String(msg.data?.content ?? '');
            for (let i = messages.value.length - 1; i >= 0; i--) {
                const m = messages.value[i];
                if (m.type === 'tool_call' && m.result === null) {
                    m.result = content;
                    m.status = 'ok';
                    return;
                }
            }
        });

        ws.onMessage('agent.done', (msg) => {
            if (streamingAssistantKey) {
                const m = messages.value.find((x) => x._key === streamingAssistantKey);
                if (m) m.streaming = false;
                streamingAssistantKey = '';
            } else if (msg.data?.content) {
                // 没有过 delta 的纯收尾消息
                const key = `ws:${Date.now()}:assistant`;
                seenKeys.add(key);
                messages.value.push({ role: 'assistant', content: String(msg.data.content), _key: key });
            }
            running.value = false;
        });

        ws.onMessage('agent.error', (msg) => {
            const key = `ws:${Date.now()}:error`;
            seenKeys.add(key);
            messages.value.push({ role: 'error', content: msg.data?.error || '执行失败', _key: key });
            running.value = false;
            streamingAssistantKey = '';
        });
    }

    function send() {
        const text = String(input.value || '').trim();
        if (!text || running.value) return;
        const key = `client:${Date.now()}:user`;
        seenKeys.add(key);
        messages.value.push({ role: 'user', content: text, _key: key });
        ws.sendMsg({ type: 'agent.chat', to: 'desktop', data: { message: text } });
        input.value = '';
    }

    function abort() {
        ws.sendMsg({ type: 'agent.abort', to: 'desktop', data: {} });
    }

    function newSession() {
        ws.sendMsg({ type: 'agent.new_session', to: 'desktop', data: {} });
    }

    function switchSession(id) {
        if (!id || id === sessionId.value) return;
        ws.sendMsg({ type: 'agent.switch_session', to: 'desktop', data: { id } });
    }

    function deleteSession(id) {
        if (!id) return;
        ws.sendMsg({ type: 'agent.delete_session', to: 'desktop', data: { id } });
    }

    function loadMore() {
        if (!hasMore.value) return;
        ws.sendMsg({
            type: 'agent.load_history',
            to: 'desktop',
            data: { offset: loadedOffset.value, limit: 50 },
        });
    }

    function saveConfig(payload = {}) {
        ws.sendMsg({
            type: 'agent.set_config',
            to: 'desktop',
            data: {
                provider: payload.provider || '',
                apiUrl: payload.apiUrl || '',
                apiKey: payload.apiKey || '',
                model: payload.model || '',
            },
        });
    }

    return {
        messages, input, running,
        configured, provider, model, apiUrl, apiKeyMasked,
        sessionId, sessionTitle, sessions,
        hasMore, loadedOffset,
        initialize, send, abort, saveConfig,
        newSession, switchSession, deleteSession, loadMore,
    };
});
