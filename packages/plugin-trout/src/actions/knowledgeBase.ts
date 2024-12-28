/*
  This action is used to search a knowledge base for information.
*/

import {
    ActionExample,
    IAgentRuntime,
    Memory,
    type Action,
    type State,
    type HandlerCallback,
    generateText,
    ModelClass,
    embed
} from "@ai16z/eliza";

export const knowledgeBaseAction: Action = {
    name: "KNOWLEDGE_BASE",
    similes: [
        "KNOWLEDGE",
        "DOCUMENT_DATABASE",
        "KNOWLEDGEBASE",
        "KNOWLEDGE_BASE",
        "KNOWLEDGE_BASE_ACTION",
        "KNOWLEDGE_BASE_RESPONSE",
        "KNOWLEDGE_BASE_SEARCH",
        "KNOWLEDGE_BASE_SEARCH_RESPONSE",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description:
        "Search the agent's knowledge base and document database for relevant information.",
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _options: { [key: string]: unknown },
        _state: State,
        _callback: HandlerCallback
    ): Promise<boolean> => {
      console.log('Executing KNOWLEDGE_BASE action')


      const userPrompt = _message.content.text;

      // Generate an embedding for the user prompt
      const embedding = await embed(_runtime, userPrompt);

      // Search the knowledge base for the embedding
      // const memories = await _runtime.databaseAdapter.searchMemoriesByEmbedding(embedding, {
      //   match_threshold: 0.5,
      //   count: 10,
      //   tableName: "messages"
      // })
      // console.log('memories: ', memories)

      // const memories = await _runtime.databaseAdapter.searchMemories({
      //   embedding: embedding,
      //   match_threshold: 0.5,
      //   match_count: 10,
      //   tableName: "messages",
      //   agentId: _message.agentId,
      //   roomId: _message.roomId,
      //   unique: false
      // })
      // console.log('memories: ', memories)

      try {
        const memories = await _runtime.databaseAdapter.getMemories({
          tableName: "documents",
          agentId: _message.agentId,
          roomId: _message.roomId,
          unique: false
        })
        console.log('memories: ', memories)
      } catch (error) {
        console.error('Error getting memories: ', error)
      }
      


//         const apiKey = process.env.NEWS_API_KEY;

//         // A Prompt for the AI to retrieve the search term from the user's message.
//         const template = `
//         Extract the search term from the message provided by the user. The message is:
//         ${_message.content.text}
//         Only respond with the search term. Do not include any other text.
//         `

//         // Execute the prompt to get the search term.
//         const searchTerm = await generateText({
//           runtime: _runtime,
//           context: template,
//           modelClass: ModelClass.SMALL,
//           stop: ["\n"] 
//         })
//         console.log('CURRENT_NEWS searchTerm: ', searchTerm)


//         // Call newsapi.org api with searchTerm
//         // Return the first five results
//         const response = await fetch(
//             `https://newsapi.org/v2/everything?q=${encodeURIComponent(
//                 searchTerm
//             )}&apiKey=${apiKey}&pageSize=10`
//         );
//         const data = await response.json();
//         const news = data.articles.slice(0,10).map((article) => `${article.title}\n${article.description}\n`).join("\n");

//         const responseText = `
// The current news for ${searchTerm} is:
// ${news}
// `
//         // Print out the raw news items to the console.
//         // console.log('CURRENT_NEWS responseText: ', responseText)
//         // console.log('_message: ', _message)

//         // Create a new memory with the news items.
//         const newMemory: Memory = {
//           id: _message.id,
//           userId: _message.agentId,
//           agentId: _message.agentId,
//           roomId: _message.roomId,
//           content: {
//             text: responseText,
//             action: "CURRENT_NEWS_RESPONSE",
//             source: _message.content?.source
//           },
//         }
//         // console.log('newMemory: ', newMemory)

//         // Save the memory to the database.
//         await _runtime.messageManager.createMemory(newMemory)

//         // Generate a prompt for the AI to summarize the news
//         const summaryTemplate = `
//         Summarize the news for ${searchTerm} in a few sentences. The news is:
//         ${news}
//         `
//         const summary = await generateText({
//           runtime: _runtime,
//           context: summaryTemplate,
//           modelClass: ModelClass.SMALL,
//           stop: ["\n"] 
//         })
//         // console.log('\nNew summary: ', summary)

//         // Respond to the chat with a summary of the news.
//         _callback({text: summary});

        return true;

    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Can you search our knowledge base for information about AI?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Let me check my knowledge base for information about AI", action: "KNOWLEDGE_BASE" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "Search your knowledge for blog posts I wrote in 2019?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Let me search my knowledge base for relevant information", action: "KNOWLEDGE_BASE" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "Use your knowledge base to complete this JavaScript code snippet" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Searching my knowledge base...", action: "KNOWLEDGE_BASE" },
            },
        ],

        [
            {
                user: "{{user1}}",
                content: { text: "What do you remember about SLP Group Token details?" },
            },
            {
                user: "{{agentName}}",
                content: { text: "Let me fetch my memories about SLP Group Tokens", action: "KNOWLEDGE_BASE" },
            },
        ],

    ] as ActionExample[][],
} as Action;
