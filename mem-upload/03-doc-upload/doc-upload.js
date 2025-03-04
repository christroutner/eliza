/*
  This is a script for uploading documents to the agents RAG memory.
*/

import axios from "axios";

import { readFileSync } from 'fs'

// Hack to get __dirname back.
// https://blog.logrocket.com/alternatives-dirname-node-js-es-modules/
import * as url from 'url'


const agentId = "b850bc30-45f8-0041-a00a-83df46d8555d";
const apiUrl = `http://localhost:3000/${agentId}/memorizeDocument`;

// const text = "This text represents a document that I want the agent to memorize.";
const userId = "ffbb4daf-5149-0902-b675-30e9ab20706f"
const roomId = "06cc2fa6-d02a-09a1-a96d-418f707919e8"
const name = "Chris"
const userName = "christroutner"

async function start() {
  try {
    
    // Get the document to upload.
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
    const filePath = `${__dirname.toString()}/../docs/trouts-blog/Clean-Architecture-or-Trouts-Blog.md`
    const text = readFileSync(filePath, 'utf8')

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



