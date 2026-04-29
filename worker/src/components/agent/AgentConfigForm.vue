<script setup>
import { reactive, watch, computed } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { PROVIDERS, PROVIDER_GROUPS, getProvider } from '@/data/providers';

const agent = useAgentStore();

const form = reactive({
    provider: agent.provider || 'openai',
    apiUrl: agent.apiUrl || '',
    apiKey: '',
    model: agent.model || '',
});

const selectedProvider = computed(() => getProvider(form.provider));
const isCustom = computed(() => form.provider === 'custom');

watch(() => form.provider, (id) => {
    const p = getProvider(id);
    if (p && id !== 'custom') {
        form.apiUrl = p.apiUrl;
        form.model = p.defaultModel;
    }
});

watch(() => [agent.provider, agent.apiUrl, agent.model], ([prov, url, model]) => {
    if (!form.provider && prov) form.provider = prov;
    if (!form.apiUrl && url) form.apiUrl = url;
    if (!form.model && model) form.model = model;
});

const emit = defineEmits(['saved']);

function save() {
    agent.saveConfig({
        provider: form.provider,
        apiUrl: form.apiUrl,
        apiKey: form.apiKey,
        model: form.model,
    });
    form.apiKey = '';
    emit('saved');
}

defineExpose({ save });
</script>

<template>
    <div class="flex flex-col gap-4">
        <!-- Provider -->
        <div class="flex flex-col gap-2">
            <label class="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-muted">Provider</label>
            <div v-for="group in PROVIDER_GROUPS" :key="group.id" class="mb-1">
                <div class="text-[10px] text-faint mb-1 font-mono">{{ group.name }}</div>
                <div class="flex flex-wrap gap-1.5">
                    <button v-for="p in PROVIDERS.filter(x => x.group === group.id)" :key="p.id"
                        type="button"
                        class="px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors"
                        :class="form.provider === p.id
                            ? 'border-accent bg-accent/10 text-accent font-semibold'
                            : 'border-line bg-bg text-ink hover:border-accent/50'"
                        @click="form.provider = p.id">
                        {{ p.name }}
                    </button>
                </div>
            </div>
        </div>

        <!-- API URL -->
        <div class="flex flex-col gap-2">
            <label class="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-muted">API URL</label>
            <input v-model="form.apiUrl" type="text"
                :placeholder="selectedProvider?.apiUrl || 'https://...'"
                :disabled="!isCustom && selectedProvider?.apiUrl"
                class="h-11 w-full rounded-[10px] border border-line bg-bg px-3 text-[13px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50" />
        </div>

        <!-- API Key -->
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <label class="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-muted">API Key</label>
                <a v-if="selectedProvider?.keyUrl" :href="selectedProvider.keyUrl"
                    target="_blank" rel="noopener"
                    class="text-[10px] text-accent hover:underline">Get Key</a>
            </div>
            <input v-model="form.apiKey" type="password"
                :placeholder="agent.apiKeyMasked || 'sk-...'"
                class="h-11 w-full rounded-[10px] border border-line bg-bg px-3 text-[13px] text-ink outline-none transition-colors focus:border-accent" />
            <div class="text-[11px] text-faint">留空则沿用当前配置中的 Key。</div>
        </div>

        <!-- Model -->
        <div class="flex flex-col gap-2">
            <label class="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-muted">Model</label>
            <input v-model="form.model" type="text"
                :placeholder="selectedProvider?.defaultModel || 'model-name'"
                class="h-11 w-full rounded-[10px] border border-line bg-bg px-3 text-[13px] text-ink outline-none transition-colors focus:border-accent" />
        </div>

        <button type="button"
            class="h-11 rounded-[10px] bg-accent text-bg text-[13px] font-semibold hover:opacity-90 transition-opacity"
            @click="save">
            保存模型配置
        </button>
    </div>
</template>
