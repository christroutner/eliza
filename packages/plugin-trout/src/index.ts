import { Plugin } from "@ai16z/eliza";
import { currentNewsAction, knowledgeBaseAction } from "./actions/index.ts";
import { knowledgeBaseProvider } from "./providers/knowledgeBase.ts";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const troutPlugin: Plugin = {
    name: "trout",
    description: "A custom plugin for Trout",
    actions: [
        currentNewsAction,
        knowledgeBaseAction
    ],
    evaluators: [],
    providers: [
        knowledgeBaseProvider
    ],
};
