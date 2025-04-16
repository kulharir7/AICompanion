import { Workflow, NodeType, ConnectionType, executions, InsertExecution } from '@shared/schema';
import { nodeRegistry } from './registry';
import { storage } from '../storage';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';

interface ExecutionOptions {
  workflowId: number;
  triggerData?: Record<string, any>;
  triggerNodeId?: string;
  runMode?: 'regular' | 'manual' | 'test';
  runBy?: number; // User ID who triggered the workflow
}

interface ExecutionContext {
  id: string;
  workflowId: number;
  startedAt: Date;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  nodes: Record<string, NodeExecutionData>;
  currentNodeId?: string;
  data: Record<string, any>;
  error?: Error;
  connections: ConnectionType[];
  webhook?: WebSocket;
}

interface NodeExecutionData {
  id: string;
  name: string;
  type: string;
  executed: boolean;
  startedAt?: Date;
  finishedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  error?: Error;
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
}

/**
 * Workflow execution engine
 */
export class WorkflowEngine {
  private activeExecutions = new Map<string, ExecutionContext>();
  
  /**
   * Execute a workflow
   */
  async execute(workflow: Workflow, options: ExecutionOptions): Promise<string> {
    const executionId = uuidv4();
    
    // Create execution record in database
    try {
      const execution: InsertExecution = {
        status: 'running',
        workflowId: options.workflowId,
        startedAt: new Date().toISOString(),
        data: options.triggerData || null,
        error: null,
        mode: options.runMode || 'regular',
        runBy: options.runBy || null
      };
      
      await db.insert(executions).values(execution);
    } catch (error) {
      console.error('Error creating execution record:', error);
    }
    
    // Set up execution context
    const executionContext: ExecutionContext = {
      id: executionId,
      workflowId: options.workflowId,
      startedAt: new Date(),
      status: 'running',
      nodes: {},
      data: options.triggerData || {},
      connections: workflow.connections || [],
      webhook: undefined
    };
    
    // Initialize nodes
    for (const node of workflow.nodes || []) {
      executionContext.nodes[node.id] = {
        id: node.id,
        name: node.name,
        type: node.type,
        executed: false,
        status: 'pending',
        inputData: {}
      };
    }
    
    // Store the execution context
    this.activeExecutions.set(executionId, executionContext);
    
    // Start the execution
    this.executeWorkflow(executionId, options.triggerNodeId).catch(error => {
      console.error(`Error executing workflow ${workflow.id}:`, error);
      
      // Update execution record in database
      try {
        db.update(executions)
          .set({
            status: 'error',
            finishedAt: new Date().toISOString(),
            error: { message: error.message, stack: error.stack }
          })
          .where({ id: parseInt(executionId) });
      } catch (dbError) {
        console.error('Error updating execution record:', dbError);
      }
      
      // Update execution context
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'error';
        execution.error = error;
      }
    });
    
    return executionId;
  }
  
  /**
   * Set WebSocket for real-time updates
   */
  setWebSocket(executionId: string, socket: WebSocket): void {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.webhook = socket;
    }
  }
  
  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): ExecutionContext | undefined {
    return this.activeExecutions.get(executionId);
  }
  
  /**
   * Execute the workflow
   */
  private async executeWorkflow(executionId: string, startNodeId?: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    // Find the trigger node or start node
    let startNode: NodeType | undefined;
    
    if (startNodeId) {
      startNode = this.getNodeById(execution, startNodeId);
    } else {
      // Find the first trigger node
      const nodes = Object.values(execution.nodes);
      startNode = this.getNodeById(execution, nodes.find(n => n.type.includes('trigger'))?.id);
    }
    
    if (!startNode) {
      throw new Error('No trigger node found');
    }
    
    // Execute the trigger node
    await this.executeNode(executionId, startNode.id);
    
    // Update execution record in database
    try {
      await db.update(executions)
        .set({
          status: execution.status,
          finishedAt: new Date().toISOString(),
          results: this.formatResults(execution)
        })
        .where({ id: parseInt(executionId) });
    } catch (error) {
      console.error('Error updating execution record:', error);
    }
  }
  
  /**
   * Execute a node and follow connections
   */
  private async executeNode(executionId: string, nodeId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    const nodeExecution = execution.nodes[nodeId];
    if (!nodeExecution) {
      throw new Error(`Node ${nodeId} not found in execution ${executionId}`);
    }
    
    // Skip if already executed
    if (nodeExecution.executed) {
      return;
    }
    
    // Mark as running
    nodeExecution.status = 'running';
    nodeExecution.startedAt = new Date();
    execution.currentNodeId = nodeId;
    
    // Send update to webhook
    this.sendExecutionUpdate(execution);
    
    try {
      // Get node data
      const node = this.getNodeById(execution, nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} definition not found`);
      }
      
      // Get node handler
      const handler = nodeRegistry.getHandler(node.type);
      if (!handler) {
        throw new Error(`No handler found for node type: ${node.type}`);
      }
      
      // Execute the node
      const outputData = await handler.execute(node, nodeExecution.inputData);
      
      // Update node execution data
      nodeExecution.executed = true;
      nodeExecution.status = 'completed';
      nodeExecution.finishedAt = new Date();
      nodeExecution.outputData = outputData;
      
      // Send update to webhook
      this.sendExecutionUpdate(execution);
      
      // Find next nodes to execute
      const nextNodeIds = this.findNextNodes(execution, nodeId);
      
      // Prepare input data for next nodes
      for (const nextNodeId of nextNodeIds) {
        const nextNodeExecution = execution.nodes[nextNodeId];
        if (nextNodeExecution) {
          nextNodeExecution.inputData = {
            ...nextNodeExecution.inputData,
            ...outputData
          };
        }
      }
      
      // Execute next nodes
      for (const nextNodeId of nextNodeIds) {
        await this.executeNode(executionId, nextNodeId);
      }
      
    } catch (error) {
      // Update node execution data with error
      nodeExecution.status = 'error';
      nodeExecution.finishedAt = new Date();
      nodeExecution.error = error;
      
      // Send update to webhook
      this.sendExecutionUpdate(execution);
      
      // Throw the error to stop workflow execution
      throw error;
    }
  }
  
  /**
   * Find next nodes to execute based on connections
   */
  private findNextNodes(execution: ExecutionContext, nodeId: string): string[] {
    const nextNodeIds: string[] = [];
    
    for (const connection of execution.connections) {
      if (connection.source === nodeId) {
        nextNodeIds.push(connection.target);
      }
    }
    
    return nextNodeIds;
  }
  
  /**
   * Get node by ID
   */
  private getNodeById(execution: ExecutionContext, nodeId?: string): NodeType | undefined {
    if (!nodeId) return undefined;
    
    const workflow = storage.getWorkflow(execution.workflowId);
    return workflow?.nodes.find(node => node.id === nodeId);
  }
  
  /**
   * Send execution update via WebSocket
   */
  private sendExecutionUpdate(execution: ExecutionContext): void {
    if (execution.webhook && execution.webhook.readyState === WebSocket.OPEN) {
      try {
        execution.webhook.send(JSON.stringify({
          type: 'execution_update',
          execution: this.formatExecutionForWebSocket(execution)
        }));
      } catch (error) {
        console.error('Error sending execution update:', error);
      }
    }
  }
  
  /**
   * Format execution data for WebSocket
   */
  private formatExecutionForWebSocket(execution: ExecutionContext): any {
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      startedAt: execution.startedAt.toISOString(),
      currentNodeId: execution.currentNodeId,
      nodes: Object.values(execution.nodes).map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        status: node.status,
        executed: node.executed,
        startedAt: node.startedAt ? node.startedAt.toISOString() : undefined,
        finishedAt: node.finishedAt ? node.finishedAt.toISOString() : undefined,
        error: node.error ? node.error.message : undefined
      }))
    };
  }
  
  /**
   * Format results for database storage
   */
  private formatResults(execution: ExecutionContext): Record<string, any> {
    const nodeResults: Record<string, any> = {};
    
    for (const [nodeId, nodeExecution] of Object.entries(execution.nodes)) {
      nodeResults[nodeId] = {
        status: nodeExecution.status,
        executed: nodeExecution.executed,
        startedAt: nodeExecution.startedAt ? nodeExecution.startedAt.toISOString() : undefined,
        finishedAt: nodeExecution.finishedAt ? nodeExecution.finishedAt.toISOString() : undefined,
        error: nodeExecution.error ? nodeExecution.error.message : undefined,
        outputData: nodeExecution.outputData
      };
    }
    
    return {
      status: execution.status,
      nodeResults,
      error: execution.error ? execution.error.message : undefined
    };
  }
}

// Create the singleton instance
export const workflowEngine = new WorkflowEngine();