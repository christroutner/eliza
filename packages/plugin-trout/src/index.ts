import { Plugin } from "@ai16z/eliza";
import { currentNewsAction } from "./actions/currentNews.ts";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const troutPlugin: Plugin = {
    name: "trout",
    description: "A custom plugin for Trout",
    actions: [
        currentNewsAction
    ],
    evaluators: [],
    providers: [],
};
