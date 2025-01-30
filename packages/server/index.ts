import OpenAI from "openai"
import { Server } from "socket.io"

interface CompletionParams {
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  temperature?: number
}

const DEFAULT_PARAMS: CompletionParams = {
  top_p: 1,
  max_tokens: 512,
  stop: "\n",
  temperature: 0.7,
}

// OpenAI client configurations
const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
})

const deepinfraClient = new OpenAI({
  apiKey: process.env.DEEPINFRA_API_KEY,
  baseURL: "https://api.deepinfra.com/v1/openai",
})

async function* createDeepSeekCompletion(
  systemPrompt: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  params: CompletionParams = DEFAULT_PARAMS,
  model: string = "deepseek-chat",
) {
  const stream = await deepseekClient.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    ...params,
  })

  for await (const chunk of stream) {
    yield chunk.choices[0]?.delta?.content || ""
  }
}

async function* createDeepInfraCompletion(
  systemPrompt: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  params: CompletionParams = DEFAULT_PARAMS,
  model: string = "google/gemma-2-9b-it",
) {
  const stream = await deepinfraClient.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    ...params,
  })

  for await (const chunk of stream) {
    yield chunk.choices[0]?.delta?.content || ""
  }
}

const io = new Server({
  cors: {
    origin: "*", // Be more restrictive in production
  },
})

// Define your event types (matching your client types)
export interface ServerToClientEvents {
  // Add your server-to-client event types
}

export interface ClientToServerEvents {
  hello: (text: string, callback: (response: string) => void) => void
}

io.on("connection", (socket) => {
  console.log(`Client connected [id: ${socket.id}]`)

  socket.on("hello", (text, callback) => {
    callback(`hello ${text}`)
  })

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected [id: ${socket.id}], reason: ${reason}`)
  })

  // log general socket errors
  socket.on("error", (error) => {
    console.error(`socket error [id: ${socket.id}]:`, error)
  })
})

const port = parseInt(process.env.SOCKETIO_PORT || "3001")
io.listen(port)
console.log(`Socket.IO server running on port ${port}`)
