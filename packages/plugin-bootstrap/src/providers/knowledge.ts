import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader, ModelType, parseJSONObjectFromText } from '@elizaos/core';

/**
 * Represents a knowledge provider that retrieves knowledge from the knowledge base.
 * @type {Provider}
 * @property {string} name - The name of the knowledge provider.
 * @property {string} description - The description of the knowledge provider.
 * @property {boolean} dynamic - Indicates if the knowledge provider is dynamic or static.
 * @property {Function} get - Asynchronously retrieves knowledge from the knowledge base.
 * @param {IAgentRuntime} runtime - The agent runtime object.
 * @param {Memory} message - The message containing the query for knowledge retrieval.
 * @returns {Object} An object containing the retrieved knowledge data, values, and text.
 */
/**
 * Represents a provider for knowledge data.
 * @type {Provider}
 * @property {string} name - The name of the knowledge provider.
 * @property {string} description - A description of the knowledge provider.
 * @property {boolean} dynamic - Indicates if the knowledge provider is dynamic.
 * @property {Function} get - Retrieves knowledge data based on the provided parameters.
 */
export const knowledgeProvider: Provider = {
  name: 'KNOWLEDGE',
  description: 'Knowledge from the knowledge base that the agent knows',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('message: ', message);

    // Have the LLM parse the users message and extract an optimized query string
    // for RAG retrieval.
    const knowlegeQueryPrompt = `
    # Instructions:
    Below is a message from a user. Your task is to extract essential keywords
    from the message to create a query string that will be used in RAG retrieval.
    Format the query string to optimize success in retrieving knowledge from
    a RAG database.

    Here is the users message:
    ${message.content.text}

    Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
  "queryString": "<string>",
}
\`\`\`

    Your response should include the valid JSON block and nothing else.
    `;
    const knowledgeQuery = await runtime.useModel(ModelType.TEXT_SMALL, {
      prompt: knowlegeQueryPrompt,
    });
    console.log('knowledgeQuery: ', knowledgeQuery);

    // Parse the JSON response from the LLM
    const knowledgeQueryJSON = parseJSONObjectFromText(knowledgeQuery);
    console.log('knowledgeQueryJSON: ', knowledgeQueryJSON);

    // If the LLM returned a query string, use it. Otherwise, use the original message.
    let kq = message.content.text;
    if (knowledgeQueryJSON) {
      kq = knowledgeQueryJSON.queryString;
    }

    // Retrieve the knowledge from the knowledge base
    message.content.text = kq;
    const knowledgeData = await runtime.getKnowledge(message);
    console.log('knowledgeData.length: ', knowledgeData.length);

    const knowledge =
      knowledgeData && knowledgeData.length > 0
        ? addHeader(
            '# Knowledge',
            knowledgeData.map((knowledge) => `- ${knowledge.content.text}`).join('\n')
          )
        : '';

    return {
      data: {
        knowledge,
      },
      values: {
        knowledge,
      },
      text: knowledge,
    };
  },
};
