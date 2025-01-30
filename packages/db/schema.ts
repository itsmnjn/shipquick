import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"

// ==================
// shared types
// ==================

export interface Trait {
  name: string
  value: string
}
export type Traits = Trait[]

// message types
export type MessageSender = "USER" | "BOT"
export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "VIDEO"

// media types
export type MediaType = "IMAGE" | "VIDEO" | "AUDIO"

export interface MessageMetadata {
  isNsfw?: boolean
  unlocked?: boolean
  english?: string
  language?: {
    name: string
    code: string
  }
  voiceUrl?: string
}

export interface MediaMetadata {
  messageId?: string
}

// ==================
// shared columns
// ==================

const timestamps = {
  updated_at: timestamp("updated_at", { mode: "date", withTimezone: true }),
  created_at: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp("deleted_at", { mode: "date", withTimezone: true }),
}

// ==================
// table definitions
// ==================

// users table - core user data
export const users = pgTable("users", {
  ...timestamps,
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 254 }).unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  coins: integer("coins").default(0),
  metadata: jsonb("metadata"),
}, (table) => [
  index("email_idx").on(table.email),
])

// bots table - ai character data
export const bots = pgTable("bots", {
  ...timestamps,
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  age: integer("age").notNull(),
  bio: text("bio").notNull(),
  body: jsonb("body").$type<Traits>(),
  mind: jsonb("mind").$type<Traits>(),
  image: text("image"),
  tags: text("tags").array().notNull(),
  metadata: jsonb("metadata"),
})

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ],
)

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    {
      compositePk: primaryKey({
        columns: [verificationToken.identifier, verificationToken.token],
      }),
    },
  ],
)

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialID],
      }),
    },
  ],
)

// bot_traits_history table - snapshots of bot traits over time
export const botTraitsHistory = pgTable("bot_traits_history", {
  ...timestamps,
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  body: jsonb("body").$type<Traits>(),
  mind: jsonb("mind").$type<Traits>(),
})

// user_bots table - junction table for user-bot relationships
export const userBots = pgTable(
  "user_bots",
  {
    ...timestamps,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.botId] }),
    index("user_bots_bot_id_idx").on(t.botId),
  ],
)

// chats table - conversation containers
export const chats = pgTable("chats", {
  ...timestamps,
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata"),
}, (table) => [
  index("chats_user_id_idx").on(table.userId),
  index("chats_bot_id_idx").on(table.botId),
])

// messages table - individual messages within chats
export const messages = pgTable("messages", {
  ...timestamps,
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  sender: varchar("sender", { length: 255 }).$type<MessageSender>().notNull(),
  type: varchar("type", { length: 255 }).$type<MessageType>().notNull(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata").$type<MessageMetadata>(),
}, (table) => [
  index("messages_chat_id_idx").on(table.chatId),
])

// media table - bot media assets
export const media = pgTable("media", {
  ...timestamps,
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  type: varchar("type", { length: 255 }).$type<MediaType>().notNull(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata").$type<MediaMetadata>(),
})

// ==================
// type inference
// ==================

export type User = typeof users.$inferSelect
export type InsertUser = typeof users.$inferInsert

export type Bot = typeof bots.$inferSelect
export type InsertBot = typeof bots.$inferInsert

export type UserBots = typeof userBots.$inferSelect
export type InsertUserBots = typeof userBots.$inferInsert

export type Chat = typeof chats.$inferSelect
export type InsertChat = typeof chats.$inferInsert

export type Message = typeof messages.$inferSelect
export type InsertMessage = typeof messages.$inferInsert

export type BotTraitsHistory = typeof botTraitsHistory.$inferSelect
export type InsertBotTraitsHistory = typeof botTraitsHistory.$inferInsert

export type Media = typeof media.$inferSelect
export type InsertMedia = typeof media.$inferInsert

// ==================
// relations
// ==================

// user relations
export const userRelations = relations(users, ({ many }) => ({
  userBots: many(userBots),
  chats: many(chats),
}))

// bot relations
export const botRelations = relations(bots, ({ many }) => ({
  userBots: many(userBots),
  chats: many(chats),
  traitsHistory: many(botTraitsHistory),
  media: many(media),
}))

// user_bots relations
export const userBotsRelations = relations(userBots, ({ one }) => ({
  user: one(users, {
    fields: [userBots.userId],
    references: [users.id],
  }),
  bot: one(bots, {
    fields: [userBots.botId],
    references: [bots.id],
  }),
}))

// chat relations
export const chatRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  bot: one(bots, {
    fields: [chats.botId],
    references: [bots.id],
  }),
  messages: many(messages),
}))

// message relations
export const messageRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}))

// bot_traits_history relations
export const botTraitsHistoryRelations = relations(botTraitsHistory, ({ one }) => ({
  bot: one(bots, {
    fields: [botTraitsHistory.botId],
    references: [bots.id],
  }),
}))

// media relations
export const mediaRelations = relations(media, ({ one }) => ({
  bot: one(bots, {
    fields: [media.botId],
    references: [bots.id],
  }),
}))
