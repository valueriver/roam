export const PROVIDER_GROUPS = [
    { id: 'default', name: '默认' },
    { id: 'aggregator', name: '聚合平台' },
    { id: 'coding', name: 'Coding Plan' },
    { id: 'custom', name: '自定义' },
];

export const PROVIDERS = [
    // 默认
    { id: 'openai', name: 'OpenAI', group: 'default', apiUrl: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-5.5', keyUrl: 'https://platform.openai.com/api-keys' },
    { id: 'claude', name: 'Claude', group: 'default', apiUrl: 'https://api.anthropic.com/v1/chat/completions', defaultModel: 'claude-sonnet-4-6', keyUrl: 'https://platform.claude.com/settings/keys' },
    { id: 'gemini', name: 'Gemini', group: 'default', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', defaultModel: 'gemini-3-flash-preview', keyUrl: 'https://aistudio.google.com/apikey' },
    { id: 'mistral', name: 'Mistral', group: 'default', apiUrl: 'https://api.mistral.ai/v1/chat/completions', defaultModel: 'mistral-large-latest', keyUrl: 'https://console.mistral.ai/api-keys' },
    { id: 'xai', name: 'xAI (Grok)', group: 'default', apiUrl: 'https://api.x.ai/v1/chat/completions', defaultModel: 'grok-4-1-fast-reasoning', keyUrl: 'https://console.x.ai/team/default/api-keys' },
    { id: 'deepseek', name: 'DeepSeek', group: 'default', apiUrl: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-v4-flash', keyUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'qwen', name: 'Qwen (通义千问)', group: 'default', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel: 'qwen3.6-plus', keyUrl: 'https://bailian.console.aliyun.com/?tab=model#/api-key' },
    { id: 'glm', name: 'GLM (智谱)', group: 'default', apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel: 'glm-5', keyUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys' },
    { id: 'zai', name: 'Z.ai', group: 'default', apiUrl: 'https://api.z.ai/api/paas/v4/chat/completions', defaultModel: 'glm-5', keyUrl: 'https://z.ai/manage-apikey/apikey-list' },
    { id: 'kimi', name: 'Kimi (月之暗面)', group: 'default', apiUrl: 'https://api.moonshot.cn/v1/chat/completions', defaultModel: 'kimi-2.6', keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
    { id: 'stepfun', name: 'StepFun (阶跃星辰)', group: 'default', apiUrl: 'https://api.stepfun.com/v1/chat/completions', defaultModel: 'step-3.5-flash', keyUrl: 'https://platform.stepfun.com/interface-key' },
    { id: 'minimax', name: 'MiniMax', group: 'default', apiUrl: 'https://api.minimaxi.com/v1/chat/completions', defaultModel: 'MiniMax-M2.7', keyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key' },
    { id: 'doubao', name: 'Doubao (豆包)', group: 'default', apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', defaultModel: 'doubao-seed-2-0-pro-260215', keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey' },
    // 聚合平台
    { id: 'openrouter', name: 'OpenRouter', group: 'aggregator', apiUrl: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'google/gemini-3-flash-preview', keyUrl: 'https://openrouter.ai/keys' },
    { id: 'together', name: 'Together AI', group: 'aggregator', apiUrl: 'https://api.together.xyz/v1/chat/completions', defaultModel: 'moonshotai/Kimi-K2.5', keyUrl: 'https://api.together.xyz/settings/api-keys' },
    { id: 'fireworks', name: 'Fireworks AI', group: 'aggregator', apiUrl: 'https://api.fireworks.ai/inference/v1/chat/completions', defaultModel: 'glm-5', keyUrl: 'https://app.fireworks.ai/settings/users/api-keys' },
    // Coding Plan
    { id: 'glm-coding', name: '智谱 Coding Plan', group: 'coding', apiUrl: 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions', defaultModel: 'glm-5', keyUrl: 'https://z.ai/manage-apikey/apikey-list' },
    { id: 'aliyun-coding', name: '阿里云 Coding Plan', group: 'coding', apiUrl: 'https://coding.dashscope.aliyuncs.com/v1/chat/completions', defaultModel: 'qwen3-coder-plus', keyUrl: 'https://bailian.console.aliyun.com/' },
    { id: 'ark-coding', name: '火山引擎 Coding Plan', group: 'coding', apiUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions', defaultModel: 'doubao-seed-2.0-pro', keyUrl: 'https://console.volcengine.com/ark' },
    { id: 'tencent-coding', name: '腾讯云 Coding Plan', group: 'coding', apiUrl: 'https://api.lkeap.cloud.tencent.com/coding/v3/chat/completions', defaultModel: 'minimax-m2.5', keyUrl: 'https://console.cloud.tencent.com/lkeap/api' },
    { id: 'jdcloud-coding', name: '京东云 Coding Plan', group: 'coding', apiUrl: 'https://modelservice.jdcloud.com/coding/openai/v1/chat/completions', defaultModel: 'Kimi-K2.5', keyUrl: 'https://docs.jdcloud.com/cn/jdaip/api-key' },
    { id: 'kimi-coding', name: 'Kimi Coding Plan', group: 'coding', apiUrl: 'https://api.kimi.com/coding/v1/chat/completions', defaultModel: 'kimi-for-coding', keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
    // 自定义
    { id: 'custom', name: '自定义', group: 'custom', apiUrl: '', defaultModel: '', keyUrl: '' },
];

export const getProvider = (id) => PROVIDERS.find((p) => p.id === id);
export const getProvidersByGroup = (groupId) => PROVIDERS.filter((p) => p.group === groupId);
