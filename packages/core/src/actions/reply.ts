import { composePromptFromState, parseJSONObjectFromText } from '../prompts';
import {
  type Action,
  type ActionExample,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
} from '../types';

/**
 * Template for generating dialog and actions for a character.
 *
 * @type {string}
 */
const replyTemplate = `# Task: Generate dialog for the character {{agentName}}.
{{providers}}
# Instructions: Write the next message for {{agentName}}.
First, think about what you want to do next and plan your actions. Then, write the next message and include the actions you plan to take.
"thought" should be a short description of what the agent is thinking about and planning.
"message" should be the next message for {{agentName}} which they will send to the conversation.

Reply guidelines:
- Never embellish with step-by-step explanation. Just give one answer in the requested format.
- When JSON output is requested, never include a **Step-by-Step Explanation:**, just output the json.
- When a JSON output is requested, example patterns are given with string templates like "<string>". Never respond with the same string template. Instead, replace the string template with the best choice or the value null.
- Never give a step-by-step explanation. Just give one answer in the requested format.
- Do not append a forward slash (/) to the beginning of your message response.
- When json output is requested, it will be parsed, so it must be accurate. Any syntax error will prevent you from being able to respond. Be sure to get the json syntax correct.
- When json output is requested, only respond with a single block of json. If you add more than one, the response will be rejected.
- Do not append /Ben to the beginning of your response. You *are* Ben, so you should not be addressing yourself.
- You are a tech support bot, speaking with engineers. It is not possible for you to get too technical. Respond with as much technical detail as you can.

These are the available valid actions: {{actionNames}}

Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "reasoning": "<string>",
    "message": "<string>"
}
\`\`\`

Your response should include the valid JSON block and nothing else.`;

/**
 * Represents an action that allows the agent to reply to the current conversation with a generated message.
 *
 * This action can be used as an acknowledgement at the beginning of a chain of actions, or as a final response at the end of a chain of actions.
 *
 * @typedef {Object} replyAction
 * @property {string} name - The name of the action ("REPLY").
 * @property {string[]} similes - An array of similes for the action.
 * @property {string} description - A description of the action and its usage.
 * @property {Function} validate - An asynchronous function for validating the action runtime.
 * @property {Function} handler - An asynchronous function for handling the action logic.
 * @property {ActionExample[][]} examples - An array of example scenarios for the action.
 */
export const replyAction = {
  name: 'REPLY',
  similes: ['GREET', 'REPLY_TO_MESSAGE', 'SEND_REPLY', 'RESPOND', 'RESPONSE'],
  description:
    'Replies to the current conversation with the text from the generated message. Default if the agent is responding with a message and no other action. Use REPLY at the beginning of a chain of actions as an acknowledgement, and at the end of a chain of actions as a final response.',
  validate: async (_runtime: IAgentRuntime) => {
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback
  ) => {
    console.log(`--> packages/core/src/actions/reply.ts`);

    state = await runtime.composeState(message, [
      ...(message.content.providers ?? []),
      'RECENT_MESSAGES',
    ]);

    const prompt = composePromptFromState({
      state,
      template: replyTemplate,
    });

    const response = await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt,
    });

    const responseContent = {
      thought: response.thought,
      text: (response.message as string) || '',
      actions: ['REPLY'],
    };

    await callback(responseContent);
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Hello there!',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Hi! How can I help you today?',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "What's your favorite color?",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'I really like deep shades of blue. They remind me of the ocean and the night sky.',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Can you explain how neural networks work?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Let me break that down for you in simple terms...',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Could you help me solve this math problem?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Of course! Let's work through it step by step.",
          actions: ['REPLY'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
