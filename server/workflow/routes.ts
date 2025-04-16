import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { workflowEngine } from './engine';
import { nodeRegistry } from './registry';
import { v4 as uuidv4 } from 'uuid';
import { NodeType, ConnectionType } from '@shared/schema';

// Register handlers
import { 
  ScheduleTriggerHandler, 
  WebhookTriggerHandler 
} from './handlers/triggers';
import { 
  HttpRequestHandler, 
  EmailSendHandler, 
  FilterHandler,
  LeadCreateHandler,
  LeadScoreHandler
} from './handlers/actions';

// Register all handlers
nodeRegistry.register(new ScheduleTriggerHandler());
nodeRegistry.register(new WebhookTriggerHandler());
nodeRegistry.register(new HttpRequestHandler());
nodeRegistry.register(new EmailSendHandler());
nodeRegistry.register(new FilterHandler());
nodeRegistry.register(new LeadCreateHandler());
nodeRegistry.register(new LeadScoreHandler());

export const workflowRouter = express.Router();

/**
 * Get all workflows
 */
workflowRouter.get('/', async (req: Request, res: Response) => {
  try {
    const workflows = await storage.getAllWorkflows();
    
    // If no workflows found, create a sample workflow
    if (workflows.length === 0) {
      // Create a sample workflow
      const sampleWorkflow = {
        name: 'Lead Capture and Scoring',
        nodes: [
          {
            id: 'node_1',
            name: 'Webhook Trigger',
            type: 'webhook.trigger',
            position: { x: 100, y: 100 },
            parameters: {
              path: '/lead-capture',
              method: 'POST'
            }
          },
          {
            id: 'node_2',
            name: 'Lead Creation',
            type: 'lead.create',
            position: { x: 400, y: 100 },
            parameters: {
              leadData: {
                source: 'workflow',
                status: 'new'
              }
            }
          },
          {
            id: 'node_3',
            name: 'Lead Scoring',
            type: 'lead.score',
            position: { x: 700, y: 100 },
            parameters: {}
          },
          {
            id: 'node_4',
            name: 'Send Notification',
            type: 'email.send',
            position: { x: 1000, y: 100 },
            parameters: {
              to: '{{data.email}}',
              subject: 'New Lead Captured',
              body: 'A new lead has been captured and scored: {{data.fullName}}'
            }
          }
        ],
        connections: [
          {
            source: 'node_1',
            target: 'node_2'
          },
          {
            source: 'node_2',
            target: 'node_3'
          },
          {
            source: 'node_3',
            target: 'node_4'
          }
        ],
        active: true,
        createdAt: new Date().toISOString()
      };
      
      await storage.createWorkflow(sampleWorkflow);
      
      const createdWorkflows = await storage.getAllWorkflows();
      return res.json(createdWorkflows);
    }
    
    res.json(workflows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ message: 'Error fetching workflows' });
  }
});

/**
 * Get a workflow by ID
 */
workflowRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const workflow = await storage.getWorkflow(id);
    
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching workflow' });
  }
});

/**
 * Create a new workflow
 */
workflowRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, nodes, connections, active } = req.body;
    
    // Validate the workflow
    if (!name) {
      return res.status(400).json({ message: 'Workflow name is required' });
    }
    
    const workflow = await storage.createWorkflow({
      name,
      nodes: nodes || [],
      connections: connections || [],
      active: active || false,
      createdAt: new Date().toISOString()
    });
    
    res.status(201).json(workflow);
  } catch (error) {
    res.status(500).json({ message: 'Error creating workflow' });
  }
});

/**
 * Update a workflow
 */
workflowRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, nodes, connections, active } = req.body;
    
    const updatedWorkflow = await storage.updateWorkflow(id, {
      name,
      nodes,
      connections,
      active
    });
    
    if (!updatedWorkflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    
    res.json(updatedWorkflow);
  } catch (error) {
    res.status(500).json({ message: 'Error updating workflow' });
  }
});

/**
 * Delete a workflow
 */
workflowRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await storage.deleteWorkflow(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting workflow' });
  }
});

/**
 * Execute a workflow
 */
workflowRouter.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { triggerData, triggerNodeId, runMode, runBy } = req.body;
    
    const workflow = await storage.getWorkflow(workflowId);
    
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }
    
    // Execute the workflow
    const executionId = await workflowEngine.execute(workflow, {
      workflowId,
      triggerData,
      triggerNodeId,
      runMode,
      runBy
    });
    
    res.json({ executionId });
  } catch (error) {
    res.status(500).json({ message: 'Error executing workflow' });
  }
});

/**
 * Get workflow executions
 */
workflowRouter.get('/:id/executions', async (req: Request, res: Response) => {
  try {
    const workflowId = parseInt(req.params.id);
    const executions = await storage.getWorkflowExecutions(workflowId);
    
    res.json(executions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching workflow executions' });
  }
});

/**
 * Get execution status
 */
workflowRouter.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = await storage.getExecution(parseInt(executionId));
    
    if (!execution) {
      return res.status(404).json({ message: 'Execution not found' });
    }
    
    res.json(execution);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching execution status' });
  }
});

/**
 * Get available node types
 */
workflowRouter.get('/node-types/list', (req: Request, res: Response) => {
  try {
    const nodeTypes = nodeRegistry.getNodeTypes();
    
    // Group node types by category
    const groupedNodeTypes = {
      triggers: nodeTypes.filter(type => type.type.includes('trigger')),
      actions: nodeTypes.filter(type => !type.type.includes('trigger'))
    };
    
    res.json(groupedNodeTypes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching node types' });
  }
});

/**
 * Webhook endpoint for triggering workflows
 */
workflowRouter.post('/webhook/:path', async (req: Request, res: Response) => {
  try {
    const { path } = req.params;
    const data = req.body;
    
    // Find workflows with webhook triggers that match this path
    const workflows = await storage.getAllWorkflows();
    const matchingWorkflows = workflows.filter(workflow => {
      if (!workflow.active) return false;
      
      return workflow.nodes.some(node => {
        return (
          node.type === 'webhook.trigger' &&
          node.parameters.path === path &&
          (!node.parameters.method || node.parameters.method === req.method)
        );
      });
    });
    
    if (matchingWorkflows.length === 0) {
      return res.status(404).json({ message: 'No workflow configured for this webhook path' });
    }
    
    // Execute each matching workflow
    const executionResults = [];
    
    for (const workflow of matchingWorkflows) {
      // Find the webhook trigger node
      const triggerNode = workflow.nodes.find(
        node => node.type === 'webhook.trigger' && node.parameters.path === path
      );
      
      if (triggerNode) {
        const executionId = await workflowEngine.execute(workflow, {
          workflowId: workflow.id,
          triggerData: {
            body: data,
            headers: req.headers,
            method: req.method,
            query: req.query
          },
          triggerNodeId: triggerNode.id
        });
        
        executionResults.push({
          workflowId: workflow.id,
          executionId
        });
      }
    }
    
    res.json({
      success: true,
      message: `Triggered ${executionResults.length} workflows`,
      executions: executionResults
    });
  } catch (error) {
    res.status(500).json({ message: 'Error executing workflow webhook' });
  }
});