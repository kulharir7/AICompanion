import { users, type User, type InsertUser, leads, type Lead, type InsertLead, interactions, type Interaction, type InsertInteraction, demoSchedules, type DemoSchedule, type InsertDemoSchedule, leadStats, type LeadStats, type InsertLeadStats } from "@shared/schema";
import { db } from "./db";
import { eq, like, and, or, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Lead operations
  getLead(id: number): Promise<Lead | undefined>;
  getLeads(page?: number, limit?: number, filter?: Partial<{ status: string, source: string, searchTerm: string }>): Promise<{ leads: Lead[], total: number }>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<boolean>;
  
  // Interaction operations
  getInteraction(id: number): Promise<Interaction | undefined>;
  getInteractionsByLeadId(leadId: number): Promise<Interaction[]>;
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  
  // Demo scheduling operations
  getDemoSchedule(id: number): Promise<DemoSchedule | undefined>;
  getDemoSchedulesByLeadId(leadId: number): Promise<DemoSchedule[]>;
  createDemoSchedule(demoSchedule: InsertDemoSchedule): Promise<DemoSchedule>;
  updateDemoSchedule(id: number, demoSchedule: Partial<InsertDemoSchedule>): Promise<DemoSchedule | undefined>;
  
  // Stats operations
  getLatestLeadStats(): Promise<LeadStats | undefined>;
  createOrUpdateLeadStats(date: Date, stats: Partial<InsertLeadStats>): Promise<LeadStats>;
  
  // Workflow operations
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getAllWorkflows(): Promise<Workflow[]>;
  createWorkflow(workflow: any): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<any>): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<boolean>;
  getWorkflowExecutions(workflowId: number): Promise<any[]>;
  getExecution(id: number): Promise<any | undefined>;
  createExecution(execution: any): Promise<any>;
  updateExecution(id: number, execution: Partial<any>): Promise<any | undefined>;
  
  // Session store
  sessionStore: any; // Changed from session.SessionStore to any
}

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Changed from session.SessionStore to any
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  // Workflow operations implementation
  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow;
  }
  
  async getAllWorkflows(): Promise<Workflow[]> {
    return db.select().from(workflows).orderBy(desc(workflows.updatedAt));
  }
  
  async createWorkflow(workflowData: any): Promise<Workflow> {
    const [workflow] = await db.insert(workflows).values({
      name: workflowData.name,
      active: workflowData.active || false,
      nodes: workflowData.nodes || [],
      connections: workflowData.connections || [],
      settings: workflowData.settings || {},
      triggerType: workflowData.triggerType || 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();
    return workflow;
  }
  
  async updateWorkflow(id: number, updateData: Partial<any>): Promise<Workflow | undefined> {
    // Always update the updatedAt timestamp
    const dataToUpdate = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    const [updatedWorkflow] = await db
      .update(workflows)
      .set(dataToUpdate)
      .where(eq(workflows.id, id))
      .returning();
    return updatedWorkflow;
  }
  
  async deleteWorkflow(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(workflows)
      .where(eq(workflows.id, id))
      .returning({ id: workflows.id });
    return !!deleted;
  }
  
  async getWorkflowExecutions(workflowId: number): Promise<any[]> {
    return db
      .select()
      .from(executions)
      .where(eq(executions.workflowId, workflowId))
      .orderBy(desc(executions.startedAt));
  }
  
  async getExecution(id: number): Promise<any | undefined> {
    const [execution] = await db.select().from(executions).where(eq(executions.id, id));
    return execution;
  }
  
  async createExecution(executionData: any): Promise<any> {
    const [execution] = await db.insert(executions).values({
      workflowId: executionData.workflowId,
      status: executionData.status || 'running',
      data: executionData.data || {},
      results: executionData.results || {},
      startedAt: executionData.startedAt || new Date().toISOString(),
      finishedAt: executionData.finishedAt || null,
      mode: executionData.mode || 'regular',
      runBy: executionData.runBy || null,
      error: executionData.error || null
    }).returning();
    return execution;
  }
  
  async updateExecution(id: number, updateData: Partial<any>): Promise<any | undefined> {
    const [updatedExecution] = await db
      .update(executions)
      .set(updateData)
      .where(eq(executions.id, id))
      .returning();
    return updatedExecution;
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }
  
  async getLeads(
    page: number = 1, 
    limit: number = 10, 
    filter?: Partial<{ status: string, source: string, searchTerm: string }>
  ): Promise<{ leads: Lead[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // Create a base query
      let query = db.select().from(leads);
      
      // Apply filters if provided
      if (filter) {
        const conditions = [];
        
        if (filter.status) {
          conditions.push(eq(leads.status, filter.status));
        }
        
        if (filter.source) {
          conditions.push(eq(leads.source, filter.source));
        }
        
        if (filter.searchTerm) {
          conditions.push(
            or(
              like(leads.fullName, `%${filter.searchTerm}%`),
              like(leads.email || '', `%${filter.searchTerm}%`),
              like(leads.company || '', `%${filter.searchTerm}%`),
              like(leads.position || '', `%${filter.searchTerm}%`)
            )
          );
        }
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }
      
      // Execute the query with pagination
      const leadsData = await query.orderBy(desc(leads.createdAt)).limit(limit).offset(offset);
      
      // Get total count with a raw SQL query, avoiding the drizzle fn issue
      const countResult = await db.execute(sql`SELECT COUNT(*) FROM ${leads}`);
      const total = parseInt(countResult.rows[0].count as string, 10) || 0;
      
      return {
        leads: leadsData,
        total
      };
    } catch (error) {
      console.error("Error in getLeads:", error);
      // Return empty result in case of error
      return {
        leads: [],
        total: 0
      };
    }
  }
  
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }
  
  async updateLead(id: number, updateData: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updatedLead] = await db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }
  
  async deleteLead(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(leads)
      .where(eq(leads.id, id))
      .returning({ id: leads.id });
    return !!deleted;
  }
  
  async getInteraction(id: number): Promise<Interaction | undefined> {
    const [interaction] = await db.select().from(interactions).where(eq(interactions.id, id));
    return interaction;
  }
  
  async getInteractionsByLeadId(leadId: number): Promise<Interaction[]> {
    return db
      .select()
      .from(interactions)
      .where(eq(interactions.leadId, leadId))
      .orderBy(desc(interactions.createdAt));
  }
  
  async createInteraction(insertInteraction: InsertInteraction): Promise<Interaction> {
    const [interaction] = await db.insert(interactions).values(insertInteraction).returning();
    return interaction;
  }
  
  async getDemoSchedule(id: number): Promise<DemoSchedule | undefined> {
    const [demoSchedule] = await db.select().from(demoSchedules).where(eq(demoSchedules.id, id));
    return demoSchedule;
  }
  
  async getDemoSchedulesByLeadId(leadId: number): Promise<DemoSchedule[]> {
    return db
      .select()
      .from(demoSchedules)
      .where(eq(demoSchedules.leadId, leadId))
      .orderBy(desc(demoSchedules.scheduledAt));
  }
  
  async createDemoSchedule(insertDemoSchedule: InsertDemoSchedule): Promise<DemoSchedule> {
    const [demoSchedule] = await db.insert(demoSchedules).values(insertDemoSchedule).returning();
    return demoSchedule;
  }
  
  async updateDemoSchedule(id: number, updateData: Partial<InsertDemoSchedule>): Promise<DemoSchedule | undefined> {
    const [updatedSchedule] = await db
      .update(demoSchedules)
      .set(updateData)
      .where(eq(demoSchedules.id, id))
      .returning();
    return updatedSchedule;
  }
  
  async getLatestLeadStats(): Promise<LeadStats | undefined> {
    const [stats] = await db
      .select()
      .from(leadStats)
      .orderBy(desc(leadStats.date))
      .limit(1);
    return stats;
  }
  
  async createOrUpdateLeadStats(date: Date, stats: Partial<InsertLeadStats>): Promise<LeadStats> {
    try {
      const dateString = date.toISOString().split('T')[0];
      
      // Check if stats for this date already exist - use raw SQL to avoid type issues
      const existingResult = await db.execute(
        sql`SELECT * FROM ${leadStats} WHERE to_char(date, 'YYYY-MM-DD') = ${dateString} LIMIT 1`
      );
      
      if (existingResult.rows.length > 0) {
        const existingStat = existingResult.rows[0] as LeadStats;
        
        // Update existing stats
        const [updatedStats] = await db
          .update(leadStats)
          .set(stats)
          .where(eq(leadStats.id, existingStat.id))
          .returning();
        return updatedStats;
      } else {
        // Create new lead stats entry - include all required fields
        const [newStats] = await db
          .insert(leadStats)
          .values({
            date: dateString,
            totalLeads: stats.totalLeads || 0,
            hotLeads: stats.hotLeads || 0,
            scheduledDemos: stats.scheduledDemos || 0,
            conversionRate: stats.conversionRate || 0,
            sourceBreakdown: stats.sourceBreakdown || {}
          } as any)
          .returning();
        return newStats;
      }
    } catch (error) {
      console.error("Error in createOrUpdateLeadStats:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();