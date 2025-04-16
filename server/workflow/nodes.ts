import { NodeType } from '@shared/schema';
import axios from 'axios';

/**
 * Node type definitions and implementations
 * Similar to n8n's node registry
 */

export interface NodeExecutor {
  execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>>;
  getDescription(): NodeDescription;
}

export interface NodeDescription {
  type: string;
  displayName: string;
  description: string;
  version: number;
  category: string;
  icon: string;
  inputs: number;
  outputs: number;
  properties: NodePropertyDescription[];
}

export interface NodePropertyDescription {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'options' | 'credentials';
  default?: any;
  description?: string;
  required?: boolean;
  options?: { name: string; value: string }[];
  placeholder?: string;
}

/**
 * Base class for all node executors
 */
export abstract class BaseNodeExecutor implements NodeExecutor {
  abstract execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>>;
  abstract getDescription(): NodeDescription;
}

/**
 * Trigger node (start of workflow)
 */
export class TriggerNode extends BaseNodeExecutor {
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    return {
      ...inputData,
      _trigger: {
        timestamp: new Date().toISOString(),
        nodeId: node.id,
        type: 'manual'
      }
    };
  }
  
  getDescription(): NodeDescription {
    return {
      type: 'trigger',
      displayName: 'Manual Trigger',
      description: 'Starts the workflow manually',
      version: 1,
      category: 'Triggers',
      icon: 'fa:play-circle',
      inputs: 0,
      outputs: 1,
      properties: []
    };
  }
}

/**
 * HTTP Request node
 */
export class HttpRequestNode extends BaseNodeExecutor {
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const method = (node.parameters?.method || 'GET').toUpperCase();
      const url = node.parameters?.url || 'https://example.com';
      const headers = node.parameters?.headers || {};
      const data = node.parameters?.data || {};
      
      console.log(`Making ${method} request to ${url}`);
      
      // In a real implementation, we'd make the actual HTTP request
      // For now, we'll simulate it
      if (url.startsWith('http')) {
        try {
          const response = await axios({
            method,
            url,
            headers,
            data: method !== 'GET' ? data : undefined,
            params: method === 'GET' ? data : undefined,
            timeout: 5000
          });
          
          return {
            ...inputData,
            response: {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
              data: response.data
            }
          };
        } catch (error: any) {
          return {
            ...inputData,
            error: {
              message: error.message,
              response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
              } : null
            }
          };
        }
      }
      
      // Fallback for simulation
      return {
        ...inputData,
        response: {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { message: 'Simulated response', timestamp: new Date().toISOString() }
        }
      };
    } catch (error: any) {
      console.error('Error executing HTTP request node:', error);
      throw new Error(`HTTP Request failed: ${error.message}`);
    }
  }
  
  getDescription(): NodeDescription {
    return {
      type: 'http-request',
      displayName: 'HTTP Request',
      description: 'Make HTTP requests to external services',
      version: 1,
      category: 'Communication',
      icon: 'fa:globe',
      inputs: 1,
      outputs: 1,
      properties: [
        {
          name: 'method',
          displayName: 'Method',
          type: 'options',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
            { name: 'DELETE', value: 'DELETE' },
            { name: 'PATCH', value: 'PATCH' }
          ],
          default: 'GET',
          description: 'HTTP method to use for the request'
        },
        {
          name: 'url',
          displayName: 'URL',
          type: 'string',
          default: 'https://example.com',
          description: 'URL to make the request to',
          required: true
        },
        {
          name: 'headers',
          displayName: 'Headers',
          type: 'json',
          default: {},
          description: 'Headers to include in the request'
        },
        {
          name: 'data',
          displayName: 'Request Data',
          type: 'json',
          default: {},
          description: 'Data to send with the request'
        }
      ]
    };
  }
}

/**
 * Function node for custom code
 */
export class FunctionNode extends BaseNodeExecutor {
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const code = node.parameters?.code || 'return item;';
      
      // In a real implementation, we'd safely execute the code in a sandbox
      // For now, we'll just simulate execution
      console.log(`Simulating function execution with code length: ${code.length}`);
      
      return {
        ...inputData,
        result: 'Function executed successfully',
        processedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error executing function node:', error);
      throw new Error(`Function execution failed: ${error.message}`);
    }
  }
  
  getDescription(): NodeDescription {
    return {
      type: 'function',
      displayName: 'Function',
      description: 'Run custom JavaScript code',
      version: 1,
      category: 'Core',
      icon: 'fa:code',
      inputs: 1,
      outputs: 1,
      properties: [
        {
          name: 'code',
          displayName: 'Code',
          type: 'string',
          default: 'return {...item, processed: true};',
          description: 'JavaScript code to execute',
          required: true
        }
      ]
    };
  }
}

/**
 * If/Else conditional node
 */
export class IfNode extends BaseNodeExecutor {
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const condition = node.parameters?.condition || 'true';
      
      // In a real implementation, we'd evaluate the condition
      // For now, we'll simulate it
      const conditionResult = true; // Simulated result
      
      return {
        ...inputData,
        conditionResult,
        route: conditionResult ? 'true' : 'false'
      };
    } catch (error: any) {
      console.error('Error executing IF node:', error);
      throw new Error(`Condition evaluation failed: ${error.message}`);
    }
  }
  
  getDescription(): NodeDescription {
    return {
      type: 'if',
      displayName: 'IF',
      description: 'Conditional logic to route workflow',
      version: 1,
      category: 'Logic',
      icon: 'fa:question-circle',
      inputs: 1,
      outputs: 2,
      properties: [
        {
          name: 'condition',
          displayName: 'Condition',
          type: 'string',
          default: '',
          description: 'JavaScript condition that evaluates to true/false',
          required: true
        }
      ]
    };
  }
}

/**
 * Set node to set values
 */
export class SetNode extends BaseNodeExecutor {
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const values = node.parameters?.values || {};
      
      const outputData = { ...inputData };
      
      // Set each value from the parameters
      Object.entries(values).forEach(([key, value]) => {
        outputData[key] = value;
      });
      
      return outputData;
    } catch (error: any) {
      console.error('Error executing SET node:', error);
      throw new Error(`Setting values failed: ${error.message}`);
    }
  }
  
  getDescription(): NodeDescription {
    return {
      type: 'set',
      displayName: 'Set',
      description: 'Set data values',
      version: 1,
      category: 'Core',
      icon: 'fa:edit',
      inputs: 1,
      outputs: 1,
      properties: [
        {
          name: 'values',
          displayName: 'Values',
          type: 'json',
          default: {},
          description: 'Values to set in the data',
          required: true
        }
      ]
    };
  }
}

/**
 * Lead Scoring node (custom for our application)
 */
export class LeadScoringNode extends BaseNodeExecutor {
  async execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>> {
    try {
      const leadData = inputData.lead || {};
      
      // In a real implementation, we'd use our AI scoring logic
      // For now, just simulate a score
      const score = Math.floor(Math.random() * 100);
      let label = 'cold';
      
      if (score >= 80) {
        label = 'hot';
      } else if (score >= 50) {
        label = 'warm';
      }
      
      return {
        ...inputData,
        scoredLead: {
          ...leadData,
          aiScore: score,
          aiScoreLabel: label,
          aiNotes: `Lead scored by workflow node at ${new Date().toISOString()}`
        }
      };
    } catch (error: any) {
      console.error('Error executing lead scoring node:', error);
      throw new Error(`Lead scoring failed: ${error.message}`);
    }
  }
  
  getDescription(): NodeDescription {
    return {
      type: 'lead-scoring',
      displayName: 'Lead Scoring',
      description: 'Score a lead using AI',
      version: 1,
      category: 'CRM',
      icon: 'fa:chart-line',
      inputs: 1,
      outputs: 1,
      properties: [
        {
          name: 'scoreType',
          displayName: 'Scoring Type',
          type: 'options',
          options: [
            { name: 'Basic', value: 'basic' },
            { name: 'Advanced (AI)', value: 'ai' }
          ],
          default: 'ai',
          description: 'Type of scoring to perform'
        }
      ]
    };
  }
}

/**
 * Node registry to store all available node types
 */
export class NodeRegistry {
  private static instance: NodeRegistry | null = null;
  private nodeTypes: Map<string, NodeExecutor> = new Map();
  
  private constructor() {
    // Register default node types
    this.registerNodeType('trigger', new TriggerNode());
    this.registerNodeType('http-request', new HttpRequestNode());
    this.registerNodeType('function', new FunctionNode());
    this.registerNodeType('if', new IfNode());
    this.registerNodeType('set', new SetNode());
    this.registerNodeType('lead-scoring', new LeadScoringNode());
  }
  
  public static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }
  
  public registerNodeType(type: string, executor: NodeExecutor): void {
    this.nodeTypes.set(type, executor);
  }
  
  public getNodeExecutor(type: string): NodeExecutor | undefined {
    return this.nodeTypes.get(type);
  }
  
  public getAllNodeTypes(): NodeDescription[] {
    return Array.from(this.nodeTypes.values()).map(executor => executor.getDescription());
  }
}

// Initialize the node registry singleton
export const nodeRegistry = NodeRegistry.getInstance();