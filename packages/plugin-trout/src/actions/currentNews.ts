import {
    ActionExample,
    IAgentRuntime,
    Memory,
    type Action,
    type State,
    type HandlerCallback,
    generateText,
    ModelClass,
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

        const apiKey = process.env.NEWS_API_KEY;

        // A Prompt for the AI to retrieve the search term from the user's message.
        const template = `
        Extract the search term from the message provided by the user. The message is:
        ${_message.content.text}
        Only respond with the search term. Do not include any other text.
        `

        // Execute the prompt to get the search term.
        const searchTerm = await generateText({
          runtime: _runtime,
          context: template,
          modelClass: ModelClass.SMALL,
          stop: ["\n"] 
        })
        console.log('CURRENT_NEWS searchTerm: ', searchTerm)


        // Call newsapi.org api with searchTerm
        // Return the first five results
        const response = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(
                searchTerm
            )}&apiKey=${apiKey}&pageSize=10`
        );
        const data = await response.json();
        const news = data.articles.slice(0,10).map((article) => `${article.title}\n${article.description}\n`).join("\n");

        const responseText = `
The current news for ${searchTerm} is:
${news}
`
        // Print out the raw news items to the console.
        // console.log('CURRENT_NEWS responseText: ', responseText)
        // console.log('_message: ', _message)

        // Create a new memory with the news items.
        const newMemory: Memory = {
          id: _message.id,
          userId: _message.agentId,
          agentId: _message.agentId,
          roomId: _message.roomId,
          content: {
            text: responseText,
            action: "CURRENT_NEWS_RESPONSE",
            source: _message.content?.source
          },
        }
        // console.log('newMemory: ', newMemory)

        // Save the memory to the database.
        await _runtime.messageManager.createMemory(newMemory)

        // Generate a prompt for the AI to summarize the news
        const summaryTemplate = `
        Summarize the news for ${searchTerm} in a few sentences. The news is:
        ${news}
        `
        const summary = await generateText({
          runtime: _runtime,
          context: summaryTemplate,
          modelClass: ModelClass.SMALL,
          stop: ["\n"] 
        })
        // console.log('\nNew summary: ', summary)

        // Respond to the chat with a summary of the news.
        _callback({text: summary});

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
