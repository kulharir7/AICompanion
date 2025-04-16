import { NodeType } from '@shared/schema';

/**
 * Interface for node handlers
 */
export interface INodeHandler {
  type: string;
  description: string;
  
  execute(node: NodeType, inputData: Record<string, any>): Promise<Record<string, any>>;
}

/**
 * Registry of node handlers
 */
export class NodeRegistry {
  private handlers: Map<string, INodeHandler> = new Map();
  
  /**
   * Register a node handler
   */
  register(handler: INodeHandler): void {
    this.handlers.set(handler.type, handler);
  }
  
  /**
   * Get a node handler by type
   */
  getHandler(type: string): INodeHandler | undefined {
    return this.handlers.get(type);
  }
  
  /**
   * Get all registered handler types
   */
  getTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
  
  /**
   * Get all node types with their descriptions
   */
  getNodeTypes(): { type: string; description: string }[] {
    return Array.from(this.handlers.values()).map(handler => ({
      type: handler.type,
      description: handler.description
    }));
  }
}

// Create the singleton instance
export const nodeRegistry = new NodeRegistry();