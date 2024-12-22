import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";

const timeProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        const currentDate = new Date();

        // Get UTC time since bots will be communicating with users around the global
        const options = {
            timeZone: "UTC",
            dateStyle: "full" as const,
            timeStyle: "long" as const,
        };
        const humanReadable = new Intl.DateTimeFormat("en-US", options).format(
            currentDate
        );
        const theTime = `The current date and time in UTC is ${humanReadable}. The current time in PST is ${currentDate.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' })}. Please use this as your reference for any time-based operations or responses.`;
        console.log('theTime: ', theTime)

        return theTime;
    },
};
export { timeProvider };
