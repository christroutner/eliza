import {
    ActionExample,
    IAgentRuntime,
    Memory,
    type Action,
    type State,
    type HandlerCallback,
} from "@ai16z/eliza";

export const currentNewsAction: Action = {
    name: "CURRENT_NEWS",
    similes: [
        "NEWS",
        "GET_NEWS",
        "GET_CURRENT_NEWS",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description:
        "Get current news for a search term, if asked by the user.",
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _options: { [key: string]: unknown },
        _state: State,
        _callback: HandlerCallback
    ): Promise<boolean> => {
        // console.log('_runtime.character: ', _runtime.character)

        const apiKey = process.env.NEWS_API_KEY;
        
        const searchTerm = "Roger Ver";

        // Call newsapi.org api with searchTerm
        // Return the first five results
        const response = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(
                searchTerm
            )}&apiKey=${apiKey}&pageSize=5`
        );
        const data = await response.json();
        const news = data.articles.slice(0,5).map((article) => `${article.title}\n${article.description}\n${article.url}`).join("\n");

        _callback({
            text: `
                The current news for ${searchTerm} is:
                ${news}
                `,
        });
        
        return true;

    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "What's the latest news about AI?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Let me check the current news about AI for you", action: "CURRENT_NEWS" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "Can you tell me what's happening with climate change?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "I'll look up the latest news about climate change", action: "CURRENT_NEWS" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "Show me news about SpaceX" },
            },
            {
                user: "{{agentName}}",
                content: { text: "I'll get you the current news about SpaceX", action: "CURRENT_NEWS" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "What's going on in tech news?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Let me fetch the latest technology news for you", action: "CURRENT_NEWS" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "Have you heard anything new about quantum computing?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "I'll check the recent news about quantum computing", action: "CURRENT_NEWS" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "What's the latest on renewable energy?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "I'll look up current news about renewable energy", action: "CURRENT_NEWS" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "Can you get me some news about electric vehicles?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Sure, I'll find the latest news about electric vehicles", action: "CURRENT_NEWS" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "What's happening in cryptocurrency?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Let me get you the current crypto news", action: "CURRENT_NEWS" },
            },
        ],
    ] as ActionExample[][],
} as Action;
