/*
    This is a provider that will search the knowledge base for the most relevant information.
    It will use the embedding of the user's message to search the knowledge base.
    It will return the most relevant information as a string.
*/

import { embed, generateText, IAgentRuntime, Memory, ModelClass, Provider, State } from "@ai16z/eliza";

const knowledgeBaseProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {

        // Get the user's prompt
        const userPrompt = _message.content.text;
        console.log('knowledgeBaseProvider() userPrompt: ', userPrompt)

        console.log('agentId: ', _message.agentId)
        console.log('roomId: ', _message.roomId)

        // A Prompt for the AI to retrieve the search term from the user's message.
        const template = `
        Extract the primary terms from the message provided by the user. 
        Remove filler words or repetitive symbols. Extract the elements that seem to be unique about the query.
        
        The message is:
        ${_message.content.text}

        Only respond with the primary terms. Do not include any other text. These terms will be used to search the knowledge base.
        `

        // Execute the prompt to get the search term.
        const searchTerm = await generateText({
            runtime: _runtime,
            context: template,
            modelClass: ModelClass.SMALL,
            stop: ["\n"] 
        })
        console.log('knowledgeBaseProvider() searchTerm: ', searchTerm)

        // Get a list of existing memories. Used for comparison.
        // try {
        //     const memories1 = await _runtime.databaseAdapter.getMemories({
        //         tableName: "documents",
        //         agentId: _message.agentId,
        //         roomId: _message.roomId,
        //         unique: false
        //     })
        //     // console.log('memories1: ', memories1)
        // } catch (error) {
        //     console.error('Error getting memories: ', error)
        // }

        // Generate an embedding for the user prompt
        const embedding = await embed(_runtime, searchTerm);
        // console.log('knowledgeBaseProvider() embedding.length: ', embedding.length)

        // Search the knowledge base for the embedding
        const memories = await _runtime.databaseAdapter.searchMemoriesByEmbedding(embedding, {
            match_threshold: 0.5,
            count: 10,
            tableName: "documents",
            agentId: _message.agentId,
            roomId: _message.roomId,
        })
        // console.log('knowledgeBaseProvider() memories: ', memories)

        let providerPrompt = `The following 10 entries were retrieved from the knowledge base and may be relevant to the user'  s objective.\n`
        for(let i=0; i < memories.length; i++) {
            const memory = memories[i];
            providerPrompt += `Entry ${i} of ${memories.length}: ${memory.content.text}\n`

        }

        
        return providerPrompt;
    },
};
export { knowledgeBaseProvider };
