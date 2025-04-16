import { NodeType } from '@shared/schema';
import { INodeHandler } from '../registry';

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