import { pgTable, serial, text, integer, timestamp, json, date, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  role: text("role").default("user").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  email: true,
  role: true,
  avatar: true,
});

// Leads table
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  position: text("position"),
  source: text("source").notNull(),
  sourceDetails: text("source_details"),
  status: text("status").default("new"),
  aiScore: integer("ai_score"),
  aiScoreLabel: text("ai_score_label"),
  aiNotes: text("ai_notes"),
  lastContactDate: timestamp("last_contact_date"),
  additionalInfo: json("additional_info").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Sentiment analysis
  sentimentScore: integer("sentiment_score"),
  sentimentLabel: text("sentiment_label"),
  // Lead journey stage
  journeyStage: text("journey_stage").default("awareness"),
  // Engagement metrics
  engagementLevel: integer("engagement_level").default(0),
});

export const insertLeadSchema = createInsertSchema(leads).pick({
  fullName: true,
  email: true,
  phone: true,
  company: true,
  position: true,
  source: true,
  sourceDetails: true,
  status: true,
  aiScore: true,
  aiScoreLabel: true,
  aiNotes: true,
  additionalInfo: true,
  sentimentScore: true,
  sentimentLabel: true,
  journeyStage: true,
  engagementLevel: true,
});

// Interactions table
export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  responseContent: text("response_content"),
  status: text("status").default("pending"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInteractionSchema = createInsertSchema(interactions).pick({
  leadId: true,
  type: true,
  content: true,
  responseContent: true,
  status: true,
  scheduledAt: true,
  completedAt: true,
  notes: true,
  metadata: true,
});

// Demo schedules table
export const demoSchedules = pgTable("demo_schedules", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").notNull(), // in minutes
  title: text("title").notNull(),
  description: text("description"),
  meetingLink: text("meeting_link"),
  status: text("status").default("scheduled").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  calendarEventId: text("calendar_event_id"),
});

export const insertDemoScheduleSchema = createInsertSchema(demoSchedules).pick({
  leadId: true,
  scheduledAt: true,
  duration: true,
  title: true,
  description: true,
  meetingLink: true,
  status: true,
  calendarEventId: true,
});

// Lead stats table for analytics
export const leadStats = pgTable("lead_stats", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  totalLeads: integer("total_leads").notNull(),
  hotLeads: integer("hot_leads").notNull(),
  scheduledDemos: integer("scheduled_demos").notNull(),
  conversionRate: doublePrecision("conversion_rate").notNull(),
  sourceBreakdown: json("source_breakdown").$type<Record<string, number>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLeadStatsSchema = createInsertSchema(leadStats).pick({
  date: true,
  totalLeads: true,
  hotLeads: true,
  scheduledDemos: true,
  conversionRate: true,
  sourceBreakdown: true,
});

// n8n-style Workflow Model
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(false),
  nodes: json("nodes").$type<NodeType[]>().notNull(),
  connections: json("connections").$type<ConnectionType[]>().notNull(),
  settings: json("settings").$type<WorkflowSettings>(),
  tags: text("tags").array(),
  triggerCount: integer("trigger_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  ownerId: integer("owner_id").references(() => users.id), // Optional owner reference
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertWorkflowSchema = createInsertSchema(workflows).pick({
  name: true,
  description: true,
  active: true,
  nodes: true,
  connections: true,
  settings: true,
  tags: true,
  ownerId: true
});

// n8n-style Execution Model (workflow execution history)
export const executions = pgTable("executions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull(), // running, completed, error, etc.
  data: json("data").$type<Record<string, any>>(), // Input data that triggered the workflow
  results: json("results").$type<Record<string, any>>(), // Output data from the workflow execution
  error: json("error").$type<Record<string, any>>(), // Error information if execution failed
  runBy: integer("run_by").references(() => users.id), // Who triggered the execution
  mode: text("mode").default("manual"), // manual, scheduled, webhook, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertExecutionSchema = createInsertSchema(executions).pick({
  workflowId: true,
  status: true,
  data: true,
  results: true,
  error: true,
  runBy: true,
  mode: true
});

// n8n-style Credentials Model
export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "google", "twitter", etc.
  data: text("data").notNull(), // Encrypted credentials data
  ownerId: integer("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertCredentialSchema = createInsertSchema(credentials).pick({
  name: true,
  type: true,
  data: true,
  ownerId: true
});

// Type exports for Typescript
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = typeof interactions.$inferSelect;

export type InsertDemoSchedule = z.infer<typeof insertDemoScheduleSchema>;
export type DemoSchedule = typeof demoSchedules.$inferSelect;

export type InsertLeadStats = z.infer<typeof insertLeadStatsSchema>;
export type LeadStats = typeof leadStats.$inferSelect;

// n8n-style Workflow Types
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executions.$inferSelect;

export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;

// n8n-style Node Types for TypeScript validation
export type NodePosition = {
  x: number;
  y: number;
};

export type NodeType = {
  id: string;
  name: string;
  type: string;
  position: NodePosition;
  parameters: Record<string, any>;
  typeVersion?: number;
  credentials?: Record<string, any>;
  disabled?: boolean;
  notes?: string;
};

export type ConnectionType = {
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
};

export type WorkflowSettings = {
  executionTimeout?: number;
  saveExecutionData?: boolean;
  timezone?: string;
  saveManualExecutions?: boolean;
  callerPolicy?: string; // restrictive, permissive, etc.
};