import { NodeType } from '@shared/schema';
import { INodeHandler } from './registry';
import axios from 'axios';
import { storage } from '../storage';
import { scoreLead } from '../ai';

/**
 * Base class for all trigger nodes
 */
export class TriggerHandler implements INodeHandler {
  type = 'trigger';
  description = 'Base trigger node';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    return {
      success: true,
      triggered: true,
      timestamp: new Date().toISOString(),
      data: inputData
    };
  }
}

/**
 * Base class for all action nodes
 */
export class ActionHandler implements INodeHandler {
  type = 'action';
  description = 'Base action node';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    return {
      success: true,
      executed: true,
      timestamp: new Date().toISOString(),
      data: inputData
    };
  }
}

/**
 * Schedule trigger node
 * Starts a workflow based on a schedule
 */
export class ScheduleTriggerHandler extends TriggerHandler {
  type = 'schedule.trigger';
  description = 'Trigger a workflow on a schedule';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    const { schedule } = node.parameters;
    
    return {
      success: true,
      triggered: true,
      timestamp: new Date().toISOString(),
      schedule,
      data: inputData
    };
  }
}

/**
 * Webhook trigger node
 * Starts a workflow when a webhook is called
 */
export class WebhookTriggerHandler extends TriggerHandler {
  type = 'webhook.trigger';
  description = 'Trigger a workflow when a webhook is called';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    const { path, method } = node.parameters;
    
    return {
      success: true,
      triggered: true,
      timestamp: new Date().toISOString(),
      webhook: {
        path,
        method: method || 'POST'
      },
      data: inputData
    };
  }
}

/**
 * HTTP Request node
 * Makes an HTTP request to an external API
 */
export class HttpRequestHandler extends ActionHandler {
  type = 'http.request';
  description = 'Make an HTTP request to an external API';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const { url, method, headers, body } = node.parameters;
      
      // Replace placeholders in parameters with values from input data
      const processedUrl = this.replacePlaceholders(url, inputData);
      const processedHeaders = this.processHeaders(headers, inputData);
      const processedBody = this.processBody(body, inputData);
      
      // Make the HTTP request
      const response = await axios({
        url: processedUrl,
        method: method || 'GET',
        headers: processedHeaders,
        data: processedBody,
        timeout: 10000 // 10 seconds timeout
      });
      
      return {
        success: true,
        executed: true,
        timestamp: new Date().toISOString(),
        statusCode: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      return {
        success: false,
        executed: true,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        data: inputData
      };
    }
  }
  
  private replacePlaceholders(text: string, data: Record<string, any>): string {
    if (!text) return '';
    
    return text.replace(/{{([^{}]+)}}/g, (_, key) => {
      const path = key.trim().split('.');
      let value = data;
      
      for (const segment of path) {
        value = value?.[segment];
        if (value === undefined) break;
      }
      
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }
  
  private processHeaders(headers: Record<string, string>, data: Record<string, any>): Record<string, string> {
    if (!headers) return {};
    
    const processedHeaders: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      processedHeaders[key] = this.replacePlaceholders(value, data);
    }
    
    return processedHeaders;
  }
  
  private processBody(body: any, data: Record<string, any>): any {
    if (!body) return undefined;
    
    if (typeof body === 'string') {
      return this.replacePlaceholders(body, data);
    }
    
    if (typeof body === 'object') {
      const processedBody: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          processedBody[key] = this.replacePlaceholders(value, data);
        } else {
          processedBody[key] = value;
        }
      }
      
      return processedBody;
    }
    
    return body;
  }
}

/**
 * Email Send node
 * Sends an email
 */
export class EmailSendHandler extends ActionHandler {
  type = 'email.send';
  description = 'Send an email';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const { to, subject, body, from } = node.parameters;
      
      // In a real implementation, this would use a mail service like SendGrid, Mailgun, etc.
      // For now, we'll just simulate sending an email
      
      console.log(`Sending email to ${to} with subject "${subject}"`);
      
      return {
        success: true,
        executed: true,
        timestamp: new Date().toISOString(),
        email: {
          to,
          from: from || 'noreply@example.com',
          subject,
          body
        },
        data: inputData
      };
    } catch (error) {
      return {
        success: false,
        executed: true,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        data: inputData
      };
    }
  }
}

/**
 * Filter node
 * Filters data based on conditions
 */
export class FilterHandler extends ActionHandler {
  type = 'filter';
  description = 'Filter data based on conditions';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const { conditions, combinator } = node.parameters;
      const combine = combinator === 'OR' ? this.anyConditionMatches : this.allConditionsMatch;
      
      // Apply filter conditions
      const matches = combine(conditions, inputData);
      
      return {
        success: true,
        executed: true,
        timestamp: new Date().toISOString(),
        matches,
        data: matches ? inputData : null
      };
    } catch (error) {
      return {
        success: false,
        executed: true,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        data: inputData
      };
    }
  }
  
  private allConditionsMatch(conditions: any[], data: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.every(condition => this.evaluateCondition(condition, data));
  }
  
  private anyConditionMatches(conditions: any[], data: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.some(condition => this.evaluateCondition(condition, data));
  }
  
  private evaluateCondition(condition: any, data: Record<string, any>): boolean {
    const { field, operator, value } = condition;
    
    // Get the field value from the data
    const path = field.split('.');
    let fieldValue = data;
    
    for (const segment of path) {
      fieldValue = fieldValue?.[segment];
      if (fieldValue === undefined) break;
    }
    
    // Evaluate the condition
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'notEquals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'greaterThan':
        return Number(fieldValue) > Number(value);
      case 'lessThan':
        return Number(fieldValue) < Number(value);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }
}

/**
 * Lead Create node
 * Creates a new lead in the system
 */
export class LeadCreateHandler extends ActionHandler {
  type = 'lead.create';
  description = 'Create a new lead in the system';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const { leadData } = node.parameters;
      
      // Merge lead data with input data
      const mergedLeadData = {
        ...leadData,
        ...inputData.leadData
      };
      
      // Create the lead
      const lead = await storage.createLead(mergedLeadData);
      
      return {
        success: true,
        executed: true,
        timestamp: new Date().toISOString(),
        lead,
        data: {
          ...inputData,
          lead
        }
      };
    } catch (error) {
      return {
        success: false,
        executed: true,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        data: inputData
      };
    }
  }
}

/**
 * Lead Score node
 * Scores a lead using AI
 */
export class LeadScoreHandler extends ActionHandler {
  type = 'lead.score';
  description = 'Score a lead using AI';
  
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      // Get the lead data from the input
      const leadData = inputData.lead || inputData.leadData || inputData;
      
      // Score the lead
      const scoredLead = await scoreLead(leadData);
      
      return {
        success: true,
        executed: true,
        timestamp: new Date().toISOString(),
        scoredLead,
        data: {
          ...inputData,
          scoredLead
        }
      };
    } catch (error) {
      return {
        success: false,
        executed: true,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        data: inputData
      };
    }
  }
}