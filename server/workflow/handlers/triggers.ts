import { NodeType } from '@shared/schema';
import { TriggerHandler } from './base';

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