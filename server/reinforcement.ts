/**
 * Reinforcement Learning Module
 * 
 * This module implements simple RL algorithms to improve:
 * 1. Lead scoring accuracy
 * 2. Follow-up message effectiveness
 * 3. Best time to send messages
 */

interface State {
  featureVector: number[];
  metadata: any;
}

interface Action {
  id: number;
  name: string;
  parameters?: any;
}

interface Experience {
  state: State;
  action: Action;
  reward: number;
  nextState: State;
  timestamp: number;
}

interface Model {
  id: string;
  type: 'scoring' | 'messaging' | 'timing';
  experienceBuffer: Experience[];
  qTable: Map<string, Map<number, number>>;
  policy: Map<string, number>;
  metadata: any;
}

class ReinforcementLearning {
  private models: Map<string, Model> = new Map();
  private learningRate: number = 0.1;
  private discountFactor: number = 0.9;
  private explorationRate: number = 0.2;
  
  constructor() {
    // Initialize models for different aspects of the system
    this.initializeModel('lead-scoring', 'scoring');
    this.initializeModel('message-effectiveness', 'messaging');
    this.initializeModel('timing-optimization', 'timing');
    
    console.log('[RL] Reinforcement Learning module initialized');
  }
  
  /**
   * Initialize a new RL model
   */
  private initializeModel(id: string, type: 'scoring' | 'messaging' | 'timing'): void {
    const model: Model = {
      id,
      type,
      experienceBuffer: [],
      qTable: new Map(),
      policy: new Map(),
      metadata: {}
    };
    
    this.models.set(id, model);
    console.log(`[RL] Model initialized: ${id}`);
  }
  
  /**
   * Convert a state to a string key for the Q-table
   */
  private getStateKey(state: State): string {
    return JSON.stringify(state.featureVector);
  }
  
  /**
   * Select an action using epsilon-greedy strategy
   */
  public selectAction(modelId: string, state: State, availableActions: Action[]): Action {
    const model = this.models.get(modelId);
    
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    const stateKey = this.getStateKey(state);
    
    // Exploration: randomly select an action
    if (Math.random() < this.explorationRate) {
      const randomIndex = Math.floor(Math.random() * availableActions.length);
      return availableActions[randomIndex];
    }
    
    // Exploitation: select the best action based on Q-values
    if (!model.qTable.has(stateKey)) {
      model.qTable.set(stateKey, new Map());
    }
    
    const qValues = model.qTable.get(stateKey)!;
    
    // Find action with highest Q-value
    let bestAction = availableActions[0];
    let bestValue = qValues.get(bestAction.id) || 0;
    
    for (const action of availableActions) {
      const value = qValues.get(action.id) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    
    return bestAction;
  }
  
  /**
   * Update the Q-table based on the reward received
   */
  public updateModel(
    modelId: string,
    state: State,
    action: Action,
    reward: number,
    nextState: State
  ): void {
    const model = this.models.get(modelId);
    
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    const stateKey = this.getStateKey(state);
    const nextStateKey = this.getStateKey(nextState);
    
    // Initialize Q-values if they don't exist
    if (!model.qTable.has(stateKey)) {
      model.qTable.set(stateKey, new Map());
    }
    
    if (!model.qTable.has(nextStateKey)) {
      model.qTable.set(nextStateKey, new Map());
    }
    
    const qValues = model.qTable.get(stateKey)!;
    const nextQValues = model.qTable.get(nextStateKey)!;
    
    // Get current Q-value
    const currentQ = qValues.get(action.id) || 0;
    
    // Find max Q-value for next state
    let maxNextQ = 0;
    nextQValues.forEach((value) => {
      maxNextQ = Math.max(maxNextQ, value);
    });
    
    // Q-learning update formula: Q(s,a) += α * (r + γ * max(Q(s')) - Q(s,a))
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    
    // Update Q-value
    qValues.set(action.id, newQ);
    
    // Store experience in buffer
    model.experienceBuffer.push({
      state,
      action,
      reward,
      nextState,
      timestamp: Date.now()
    });
    
    // Limit buffer size
    if (model.experienceBuffer.length > 1000) {
      model.experienceBuffer.shift();
    }
    
    console.log(`[RL] Updated ${modelId} model: action=${action.id}, reward=${reward}, newQ=${newQ}`);
  }
  
  /**
   * Process a lead scoring result and update the model based on conversion
   */
  public processLeadScoringFeedback(
    originalLeadData: any,
    scoredLeadResult: any,
    conversionResult: boolean,
    conversionValue: number = 1
  ): void {
    // Convert lead data to feature vector
    const state: State = {
      featureVector: this.extractLeadFeatures(originalLeadData),
      metadata: originalLeadData
    };
    
    // Define the action that was taken (assigning a score)
    const action: Action = {
      id: Math.floor(scoredLeadResult.score / 10), // Discretize score into bins
      name: 'score_lead',
      parameters: {
        score: scoredLeadResult.score,
        label: scoredLeadResult.label
      }
    };
    
    // Calculate reward based on accuracy of prediction
    // High positive reward if a 'hot' lead converted
    // Negative reward if prediction was wrong
    let reward = 0;
    
    if (conversionResult && scoredLeadResult.label === 'hot') {
      reward = 1.0 * conversionValue; // Correct high score
    } else if (conversionResult && scoredLeadResult.label === 'warm') {
      reward = 0.5 * conversionValue; // Partially correct
    } else if (conversionResult && scoredLeadResult.label === 'cold') {
      reward = -0.5 * conversionValue; // Missed opportunity
    } else if (!conversionResult && scoredLeadResult.label === 'hot') {
      reward = -1.0; // Incorrectly labeled as hot
    } else if (!conversionResult && scoredLeadResult.label === 'warm') {
      reward = -0.3; // Somewhat incorrect
    } else if (!conversionResult && scoredLeadResult.label === 'cold') {
      reward = 0.2; // Correctly identified as unlikely to convert
    }
    
    // Create next state (same as current for terminal states)
    const nextState = { ...state };
    
    // Update the RL model
    this.updateModel('lead-scoring', state, action, reward, nextState);
    
    console.log(`[RL] Processed lead scoring feedback: converted=${conversionResult}, reward=${reward}`);
  }
  
  /**
   * Process message effectiveness feedback
   */
  public processMessageFeedback(
    leadData: any,
    messageData: any,
    responseType: 'replied' | 'clicked' | 'ignored' | 'unsubscribed',
    responseTime: number
  ): void {
    // Convert to state and action
    const state: State = {
      featureVector: this.extractLeadFeatures(leadData),
      metadata: {
        lead: leadData,
        context: 'message_selection'
      }
    };
    
    const action: Action = {
      id: messageData.templateId || 1,
      name: 'send_message',
      parameters: {
        messageType: messageData.type,
        channel: messageData.channel
      }
    };
    
    // Calculate reward based on response
    let reward = 0;
    switch (responseType) {
      case 'replied':
        reward = 1.0;
        break;
      case 'clicked':
        reward = 0.5;
        break;
      case 'ignored':
        reward = -0.1;
        break;
      case 'unsubscribed':
        reward = -1.0;
        break;
    }
    
    // Adjust reward based on response time (faster is better)
    if (responseType === 'replied' || responseType === 'clicked') {
      const responseTimeFactor = Math.max(0, 1 - (responseTime / (24 * 60 * 60 * 1000))); // Normalize by 24 hours
      reward *= (1 + responseTimeFactor);
    }
    
    const nextState = { ...state };
    
    // Update the model
    this.updateModel('message-effectiveness', state, action, reward, nextState);
  }
  
  /**
   * Extract features from lead data
   */
  private extractLeadFeatures(leadData: any): number[] {
    const features = [
      // Normalized source value
      this.getSourceValue(leadData.source) / 10,
      
      // Engagement level (if available)
      (leadData.engagementLevel || 0) / 10,
      
      // Has email? (binary)
      leadData.email ? 1 : 0,
      
      // Has phone? (binary)
      leadData.phone ? 1 : 0,
      
      // Position seniority (estimated)
      this.estimatePositionSeniority(leadData.position) / 10,
      
      // Previous interactions count (normalized)
      Math.min(1, (leadData.interactionsCount || 0) / 10)
    ];
    
    return features;
  }
  
  /**
   * Get a numeric value for source quality
   */
  private getSourceValue(source: string): number {
    const sourceValues: Record<string, number> = {
      'linkedin': 8,
      'website': 7,
      'referral': 9,
      'facebook': 5,
      'twitter': 4,
      'instagram': 3,
      'cold_email': 2,
      'event': 6,
      'other': 3
    };
    
    return sourceValues[source.toLowerCase()] || 5;
  }
  
  /**
   * Estimate position seniority based on common titles
   */
  private estimatePositionSeniority(position: string): number {
    if (!position) return 5;
    
    const lowerPosition = position.toLowerCase();
    
    if (lowerPosition.includes('ceo') || 
        lowerPosition.includes('cto') || 
        lowerPosition.includes('cfo') || 
        lowerPosition.includes('founder') || 
        lowerPosition.includes('president')) {
      return 10;
    }
    
    if (lowerPosition.includes('vp') || 
        lowerPosition.includes('vice president') || 
        lowerPosition.includes('director') || 
        lowerPosition.includes('head')) {
      return 8;
    }
    
    if (lowerPosition.includes('manager') || 
        lowerPosition.includes('lead')) {
      return 6;
    }
    
    if (lowerPosition.includes('senior') || 
        lowerPosition.includes('sr')) {
      return 5;
    }
    
    return 3;
  }
  
  /**
   * Get the current state of RL models
   */
  public getModelsState(): any {
    const result: any = {};
    
    this.models.forEach((model, id) => {
      result[id] = {
        type: model.type,
        experienceCount: model.experienceBuffer.length,
        stateCount: model.qTable.size,
        // Sample of latest experiences
        recentExperiences: model.experienceBuffer
          .slice(-5)
          .map(exp => ({
            actionId: exp.action.id,
            reward: exp.reward,
            timestamp: exp.timestamp
          }))
      };
    });
    
    return result;
  }
}

// Create a singleton instance
export const reinforcementLearning = new ReinforcementLearning();

/**
 * Example usage:
 * 
 * // For lead scoring
 * reinforcementLearning.processLeadScoringFeedback(
 *   originalLeadData,  // The lead data that was scored
 *   scoringResult,     // The AI scoring result
 *   true,              // Whether the lead converted
 *   2                  // Value of the conversion (optional)
 * );
 * 
 * // For message effectiveness
 * reinforcementLearning.processMessageFeedback(
 *   leadData,          // Lead that received the message
 *   messageData,       // The message that was sent
 *   'replied',         // Response type
 *   3600000            // Response time in ms (1 hour)
 * );
 */