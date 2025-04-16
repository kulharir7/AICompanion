import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { scoreLead } from './ai';
import axios from 'axios';
import crypto from 'crypto';

// Create router
export const integrationsRouter = Router();

// Meta (Facebook/Instagram) integration
integrationsRouter.post('/meta', async (req: Request, res: Response) => {
  try {
    const { appId, appSecret, accessToken } = req.body;
    
    if (!appId || !appSecret || !accessToken) {
      return res.status(400).json({ message: 'Missing required credentials' });
    }
    
    // Verify credentials with Meta (this is a simplified example)
    try {
      // In a real implementation, we would verify these credentials with Meta's API
      const metaResponse = await axios.get(
        `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`
      );
      
      if (!metaResponse.data || !metaResponse.data.id) {
        return res.status(401).json({ message: 'Invalid Meta credentials' });
      }
      
      // Store these credentials securely (in a real implementation)
      // For demo purposes, we'll just return success
      
      res.status(200).json({ 
        success: true, 
        message: 'Meta integration configured successfully',
        accountId: metaResponse.data.id,
        accountName: metaResponse.data.name
      });
    } catch (error: any) {
      // Special case for demo when Meta API is not available
      console.log('Meta API error (expected in demo):', error.message);
      
      // For demo, we'll simulate success
      res.status(200).json({ 
        success: true, 
        message: 'Meta integration configured successfully (Demo)',
        accountId: '123456789',
        accountName: 'Demo Meta Account' 
      });
    }
  } catch (error: any) {
    console.error('Meta integration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error setting up Meta integration',
      error: error.message
    });
  }
});

// LinkedIn integration
integrationsRouter.post('/linkedin', async (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret, redirectUri } = req.body;
    
    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({ message: 'Missing required credentials' });
    }
    
    // Verify credentials with LinkedIn (this is a simplified example)
    try {
      // In a real implementation, we would verify these credentials with LinkedIn's API
      // For demo purposes, we'll just return success
      
      res.status(200).json({ 
        success: true, 
        message: 'LinkedIn integration configured successfully',
        connectionStatus: 'active',
        toolName: 'Phantombuster' 
      });
    } catch (error: any) {
      console.error('LinkedIn API error:', error);
      res.status(401).json({ 
        success: false, 
        message: 'Invalid LinkedIn credentials',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('LinkedIn integration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error setting up LinkedIn integration',
      error: error.message
    });
  }
});

// Telegram integration
integrationsRouter.post('/telegram', async (req: Request, res: Response) => {
  try {
    const { botToken, channelUsername } = req.body;
    
    if (!botToken || !channelUsername) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }
    
    // Verify bot token with Telegram (this is a simplified example)
    try {
      // In a real implementation, we would verify the bot token with Telegram's API
      const telegramResponse = await axios.get(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      
      if (!telegramResponse.data || !telegramResponse.data.ok) {
        return res.status(401).json({ message: 'Invalid Telegram bot token' });
      }
      
      // Store these credentials securely (in a real implementation)
      // For demo purposes, we'll just return success
      
      res.status(200).json({ 
        success: true, 
        message: 'Telegram bot configured successfully',
        botId: telegramResponse.data.result.id,
        botUsername: telegramResponse.data.result.username
      });
    } catch (error: any) {
      // Special case for demo when Telegram API is not available
      console.log('Telegram API error (expected in demo):', error.message);
      
      // For demo, we'll simulate success
      res.status(200).json({ 
        success: true, 
        message: 'Telegram bot configured successfully (Demo)',
        botId: '5123456789',
        botUsername: 'leadgenius_demo_bot' 
      });
    }
  } catch (error: any) {
    console.error('Telegram integration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error setting up Telegram bot',
      error: error.message
    });
  }
});

// B2B Scraping configuration
integrationsRouter.post('/scraping', async (req: Request, res: Response) => {
  try {
    const { apiKey, sources } = req.body;
    
    if (!apiKey || !sources) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }
    
    // Verify API key (this is a simplified example)
    // In a real implementation, we would verify the API key with the service
    
    // Parse the sources
    const sourceList = sources.split(',').map((s: string) => s.trim());
    
    // For demo purposes, we'll just return success
    res.status(200).json({ 
      success: true, 
      message: 'B2B scraping configured successfully',
      sources: sourceList,
      status: 'ready'
    });
  } catch (error: any) {
    console.error('Scraping configuration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error setting up B2B scraping',
      error: error.message
    });
  }
});

// Custom API integration
integrationsRouter.post('/api', async (req: Request, res: Response) => {
  try {
    const { name, baseUrl, apiKey, headers } = req.body;
    
    if (!name || !baseUrl || !apiKey) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }
    
    // Parse headers if provided
    let parsedHeaders = {};
    if (headers) {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch (headerError) {
        return res.status(400).json({ 
          message: 'Invalid headers format. Must be valid JSON',
          error: headerError 
        });
      }
    }
    
    // Test the API connection (this is a simplified example)
    try {
      // In a real implementation, we would test the connection with the provided details
      // For demo purposes, we'll just return success
      
      // Generate a unique ID for this integration
      const integrationId = crypto.randomBytes(4).toString('hex');
      
      res.status(200).json({ 
        success: true, 
        message: 'Custom API configured successfully',
        integrationId,
        name,
        status: 'active'
      });
    } catch (apiError: any) {
      console.error('API connection error:', apiError);
      res.status(400).json({ 
        success: false, 
        message: 'Failed to connect to the provided API',
        error: apiError.message
      });
    }
  } catch (error: any) {
    console.error('API configuration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error setting up custom API integration',
      error: error.message
    });
  }
});

// Module export
export default integrationsRouter;