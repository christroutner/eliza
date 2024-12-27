/*
  This is an examples of using the new endpoint to upload a document.
*/

import axios from "axios";

const agentId = "b850bc30-45f8-0041-a00a-83df46d8555d";
const apiUrl = `http://localhost:3000/${agentId}/memorizeDocument`;

const text = "This text represents a document that I want the agent to memorize.";
const userId = "ffbb4daf-5149-0902-b675-30e9ab20706f"
const roomId = "06cc2fa6-d02a-09a1-a96d-418f707919e8"
const name = "Chris"
const userName = "christroutner"

async function start() {
  try {
    const response = await axios.post(apiUrl, {
      userId,
      roomId,
      name,
      userName,
      text
    });
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}
start()



