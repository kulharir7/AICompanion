import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertLeadSchema, 
  insertInteractionSchema,
  insertDemoScheduleSchema,
  InsertLead
} from "@shared/schema";
import { scoreLead } from "./ai";
import { formatDistanceToNow } from "date-fns";
import OpenAI from "openai";
import { workflowRouter } from "./workflow/routes";
import { WebSocketServer } from 'ws';
import webhookRouter from './webhooks';
import integrationsRouter from './integrations';
import { apiService } from './api-service';
import { reinforcementLearning } from './reinforcement';
import { linkedinRouter } from './linkedin-api';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up WebSocket server for workflow updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        
        // Handle different message types
        if (data.type === 'subscribe') {
          // Subscribe to workflow updates
          (ws as any).workflowId = data.workflowId;
          ws.send(JSON.stringify({ type: 'subscribed', workflowId: data.workflowId }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
    
    // Send a welcome message
    ws.send(JSON.stringify({ type: 'connected' }));
  });
  
  // API Routes
  const apiRouter = express.Router();
  
  // Get current user
  apiRouter.get('/user', async (req: Request, res: Response) => {
    try {
      // Mock user response for demo purposes
      // In a real app, this would use JWT/session authentication
      const demoUser = {
        id: 1,
        username: "admin",
        fullName: "Admin User",
        email: "admin@example.com",
        role: "admin"
      };
      
      res.json(demoUser);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(401).json({ message: 'Not authenticated' });
    }
  });
  
  // Authentication routes (basic implementation)
  apiRouter.post('/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    const user = await storage.getUserByUsername(username);
    
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // For simplicity, we're just returning the user without proper session management
    // In a real app, you would use JWTs or sessions
    return res.json({ 
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    });
  });
  
  // Dashboard stats
  apiRouter.get('/dashboard/stats', async (req: Request, res: Response) => {
    try {
      let stats = await storage.getLatestLeadStats();
      
      // If no stats found, create default stats
      if (!stats) {
        const mockStats = {
          date: new Date().toISOString(),
          totalLeads: 347,
          hotLeads: 124,
          scheduledDemos: 68,
          conversionRate: 32.5,
          sourceBreakdown: {
            "LinkedIn": 143,
            "Facebook": 97,
            "Website": 64,
            "Referral": 43
          }
        };
        
        // Store these stats in the database
        stats = await storage.createOrUpdateLeadStats(new Date(), mockStats);
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
  });
  
  // Recent activity for dashboard
  apiRouter.get('/dashboard/activity', async (req: Request, res: Response) => {
    try {
      // Get all leads
      const { leads } = await storage.getLeads(1, 100);
      
      // Get recent interactions for each lead
      const allInteractions = [];
      for (const lead of leads) {
        const interactions = await storage.getInteractionsByLeadId(lead.id);
        allInteractions.push(...interactions.map(interaction => ({
          ...interaction,
          leadName: lead.fullName,
          leadEmail: lead.email,
          timeAgo: formatDistanceToNow(new Date(interaction.createdAt || new Date()), { addSuffix: true })
        })));
      }
      
      // Sort by createdAt (most recent first) and limit to 5
      const recentActivity = allInteractions
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);
      
      res.json(recentActivity);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching recent activity' });
    }
  });
  
  // Leads API
  apiRouter.get('/leads', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const source = req.query.source as string;
      const searchTerm = req.query.search as string;
      
      const filter: any = {};
      if (status) filter.status = status;
      if (source) filter.source = source;
      if (searchTerm) filter.searchTerm = searchTerm;
      
      let { leads, total } = await storage.getLeads(page, limit, filter);
      
      // If no leads found and there are no filters active, create some sample leads
      if (leads.length === 0 && !status && !source && !searchTerm) {
        // Create sample leads
        const sampleLeads = [
          {
            fullName: 'Rahul Sharma',
            email: 'rahul.sharma@example.com',
            phone: '+91 98765 43210',
            company: 'TechSolutions India',
            position: 'CTO',
            source: 'LinkedIn',
            status: 'contacted',
            aiScore: 87,
            aiScoreLabel: 'hot',
            aiNotes: 'Highly engaged, looking for immediate solutions'
          },
          {
            fullName: 'Priya Patel',
            email: 'priya.patel@example.com',
            phone: '+91 98765 12345',
            company: 'InnovateX Software',
            position: 'CEO',
            source: 'Website',
            status: 'new',
            aiScore: 76,
            aiScoreLabel: 'warm',
            aiNotes: 'Downloaded whitepaper, browsed pricing page'
          },
          {
            fullName: 'Amit Kumar',
            email: 'amit@example.com',
            phone: '+91 77889 66554',
            company: 'Global Services Ltd',
            position: 'Procurement Manager',
            source: 'Facebook',
            status: 'qualified',
            aiScore: 92,
            aiScoreLabel: 'hot',
            aiNotes: 'Ready to purchase, requested a demo'
          }
        ];
        
        // Add leads to the database
        for (const leadData of sampleLeads) {
          await storage.createLead(leadData);
        }
        
        // Refresh leads from database
        const result = await storage.getLeads(page, limit, filter);
        leads = result.leads;
        total = result.total;
      }
      
      res.json({
        leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: 'Error fetching leads' });
    }
  });
  
  apiRouter.get('/leads/:id', async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      
      // Get interactions for this lead
      const interactions = await storage.getInteractionsByLeadId(leadId);
      
      // Get scheduled demos for this lead
      const demoSchedules = await storage.getDemoSchedulesByLeadId(leadId);
      
      res.json({
        lead,
        interactions,
        demoSchedules
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching lead details' });
    }
  });
  
  apiRouter.post('/leads', async (req: Request, res: Response) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      
      // Use AI to score the lead if no score is provided
      if (!leadData.aiScore) {
        const scoredLead = await scoreLead(leadData);
        leadData.aiScore = scoredLead.aiScore;
        leadData.aiScoreLabel = scoredLead.aiScoreLabel;
        leadData.aiNotes = scoredLead.aiNotes;
      }
      
      const lead = await storage.createLead(leadData);
      
      // Update dashboard stats
      const stats = await storage.getLatestLeadStats() || { 
        date: new Date(),
        totalLeads: 0,
        hotLeads: 0,
        scheduledDemos: 0,
        conversionRate: 0,
        sourceBreakdown: {}
      };
      
      // Increment total leads
      stats.totalLeads = (stats.totalLeads || 0) + 1;
      
      // Increment hot leads if applicable
      if (lead.aiScoreLabel === 'hot') {
        stats.hotLeads = (stats.hotLeads || 0) + 1;
      }
      
      // Update source breakdown
      const sourceBreakdown = stats.sourceBreakdown || {};
      sourceBreakdown[lead.source] = (sourceBreakdown[lead.source] || 0) + 1;
      
      await storage.createOrUpdateLeadStats(new Date(), {
        totalLeads: stats.totalLeads,
        hotLeads: stats.hotLeads,
        sourceBreakdown
      });
      
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ message: 'Invalid lead data', error: error.message });
    }
  });
  
  apiRouter.patch('/leads/:id', async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      
      // Sanitize updateData to only include valid properties from InsertLead
      const updateData: Partial<InsertLead> = {};
      const allowedFields = ['fullName', 'email', 'phone', 'company', 'position', 'source', 
                            'sourceDetails', 'status', 'aiScore', 'aiScoreLabel', 'aiNotes', 
                            'additionalInfo', 'sentimentScore', 'sentimentLabel', 'journeyStage', 
                            'engagementLevel'];
                            
      for (const field of allowedFields) {
        if (field in req.body) {
          updateData[field as keyof InsertLead] = req.body[field];
        }
      }
      
      const updatedLead = await storage.updateLead(leadId, updateData);
      
      if (!updatedLead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      
      res.json(updatedLead);
    } catch (error: any) {
      res.status(400).json({ message: 'Error updating lead', error: error.message });
    }
  });
  
  apiRouter.delete('/leads/:id', async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const result = await storage.deleteLead(leadId);
      
      if (!result) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting lead' });
    }
  });
  
  // Interactions API
  apiRouter.get('/leads/:leadId/interactions', async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const interactions = await storage.getInteractionsByLeadId(leadId);
      
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching interactions' });
    }
  });
  
  apiRouter.post('/interactions', async (req: Request, res: Response) => {
    try {
      const interactionData = insertInteractionSchema.parse(req.body);
      const interaction = await storage.createInteraction(interactionData);
      
      // We can't directly update lastContactDate since it's not in the InsertLead schema
      // Let's get the current lead first
      const lead = await storage.getLead(interaction.leadId);
      if (lead) {
        // Get current additionalInfo and update it to include lastContactDate
        const additionalInfo = lead.additionalInfo || {};
        additionalInfo.lastContactDate = new Date().toISOString();
        
        // Update lead with new additionalInfo
        await storage.updateLead(interaction.leadId, {
          additionalInfo
        });
      }
      
      res.status(201).json(interaction);
    } catch (error: any) {
      res.status(400).json({ message: 'Invalid interaction data', error: error.message });
    }
  });
  
  // Demo scheduling API
  apiRouter.get('/leads/:leadId/demos', async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const demos = await storage.getDemoSchedulesByLeadId(leadId);
      
      res.json(demos);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching demo schedules' });
    }
  });
  
  apiRouter.post('/demos', async (req: Request, res: Response) => {
    try {
      const demoData = insertDemoScheduleSchema.parse(req.body);
      const demo = await storage.createDemoSchedule(demoData);
      
      // Update lead status
      await storage.updateLead(demo.leadId, {
        status: 'demo_scheduled'
      });
      
      // Create an interaction record for this demo scheduling
      await storage.createInteraction({
        leadId: demo.leadId,
        type: 'demo_scheduled',
        content: demo.title,
        status: 'scheduled',
        scheduledAt: demo.scheduledAt,
        notes: `Demo scheduled for ${new Date(demo.scheduledAt).toLocaleString()}`
      });
      
      // Update dashboard stats
      const stats = await storage.getLatestLeadStats();
      if (stats) {
        await storage.createOrUpdateLeadStats(new Date(), {
          scheduledDemos: (stats.scheduledDemos || 0) + 1
        });
      }
      
      res.status(201).json(demo);
    } catch (error) {
      res.status(400).json({ message: 'Invalid demo data', error: error.message });
    }
  });
  
  apiRouter.patch('/demos/:id', async (req: Request, res: Response) => {
    try {
      const demoId = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedDemo = await storage.updateDemoSchedule(demoId, updateData);
      
      if (!updatedDemo) {
        return res.status(404).json({ message: 'Demo schedule not found' });
      }
      
      res.json(updatedDemo);
    } catch (error) {
      res.status(400).json({ message: 'Error updating demo schedule', error: error.message });
    }
  });
  
  // AI Scoring endpoint using centralized API service with reinforcement learning
  apiRouter.post('/ai/score-lead', async (req: Request, res: Response) => {
    try {
      const leadData = req.body;
      // Use the API service to get lead score
      const scoredLead = await apiService.getLeadScore(leadData);
      
      // Save the original request and result for learning
      // We'll update this with feedback later when conversion happens
      console.log('[RL] Processed a new lead score for reinforcement learning:', scoredLead.aiScoreLabel);
      
      res.json(scoredLead);
    } catch (error: any) {
      res.status(500).json({ message: 'Error scoring lead', error: error.message });
    }
  });
  
  // Endpoint to process lead conversion feedback for reinforcement learning
  apiRouter.post('/ai/lead-feedback', async (req: Request, res: Response) => {
    try {
      const { leadId, converted, conversionValue } = req.body;
      
      if (leadId === undefined || converted === undefined) {
        return res.status(400).json({ message: 'leadId and converted fields are required' });
      }
      
      // Get the original lead data
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      
      // Get original scoring result
      const scoringResult = {
        score: lead.aiScore || 0,
        label: lead.aiScoreLabel || 'unknown'
      };
      
      // Process the feedback using the RL system
      reinforcementLearning.processLeadScoringFeedback(
        lead,
        scoringResult,
        converted,
        conversionValue || 1
      );
      
      res.json({ 
        success: true, 
        message: 'Lead feedback processed for reinforcement learning',
        rlState: reinforcementLearning.getModelsState()
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Error processing lead feedback', error: error.message });
    }
  });
  
  // Lead intent classification endpoint
  apiRouter.post('/ai/classify-intent', async (req: Request, res: Response) => {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }
    
    try {
      // Initialize the OpenAI client
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a lead classification expert. Analyze the lead's message and classify their intent. Focus on their buying readiness, interest level, and specific needs."
          },
          {
            role: "user",
            content: `Classify the following message from a potential lead. Return a single classification phrase like "Hot Lead - Ready for Demo" or "Warm Lead - Price Sensitive": "${message}"`
          }
        ],
      });
      
      const content = response.choices[0].message.content || '';
      const classification = content.trim();
      
      res.json({ classification });
    } catch (error) {
      console.error('Error classifying lead intent:', error);
      res.status(500).json({ message: 'Error classifying lead intent', error: error.message });
    }
  });
  
  // AI-powered follow-up message generation with reinforcement learning
  apiRouter.post('/ai/generate-message', async (req: Request, res: Response) => {
    const { lead, context } = req.body;
    
    if (!lead) {
      return res.status(400).json({ message: 'Lead data is required' });
    }
    
    try {
      // Initialize the OpenAI client
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      
      // Create a prompt based on the lead status and context
      let systemContent = "You are an expert sales assistant who crafts personalized follow-up messages to leads. ";
      
      switch (context?.messageType) {
        case 'reminder':
          systemContent += "Create a friendly reminder about an upcoming demo. Be concise and professional.";
          break;
        case 'follow_up':
          systemContent += "Create a follow-up message that checks in on the lead's interest level without being pushy.";
          break;
        case 'introduction':
          systemContent += "Create a warm introduction that thanks the lead for their interest and suggests next steps.";
          break;
        default:
          systemContent += "Create a general check-in message that re-engages the lead.";
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemContent
          },
          {
            role: "user",
            content: `Create a personalized follow-up message for ${lead.fullName} from ${lead.company || 'unknown company'}. 
                     Their status is ${lead.status}. 
                     Their AI score is ${lead.aiScore}/100 (${lead.aiScoreLabel}).
                     Additional context: ${lead.aiNotes || 'No additional information available'}.
                     Previous interactions: ${JSON.stringify(context?.previousInteractions || [])}`
          }
        ],
      });
      
      const message = response.choices[0].message.content || '';
      
      // Save message data for reinforcement learning feedback later
      const messageData = {
        templateId: 1, // Using a default template ID
        type: context?.messageType || 'general',
        channel: context?.channel || 'email',
        content: message.trim(),
        timestamp: new Date().toISOString()
      };
      
      console.log('[RL] Generated follow-up message for reinforcement learning:', messageData.type);
      
      res.json({ message: message.trim(), messageId: Date.now() });
    } catch (error: any) {
      console.error('Error generating follow-up message:', error);
      res.status(500).json({ message: 'Error generating follow-up message', error: error.message });
    }
  });
  
  // Endpoint to process message effectiveness feedback for reinforcement learning
  apiRouter.post('/ai/message-feedback', async (req: Request, res: Response) => {
    try {
      const { leadId, messageData, responseType, responseTime } = req.body;
      
      if (!leadId || !messageData || !responseType) {
        return res.status(400).json({ message: 'leadId, messageData, and responseType are required' });
      }
      
      // Get the lead data
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      
      // Process the message feedback using the RL system
      reinforcementLearning.processMessageFeedback(
        lead,
        messageData,
        responseType,
        responseTime || 0
      );
      
      res.json({ 
        success: true, 
        message: 'Message feedback processed for reinforcement learning',
        rlState: reinforcementLearning.getModelsState()
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Error processing message feedback', error: error.message });
    }
  });
  
  // Twilio integration for automated calls
  apiRouter.post('/integrations/call', async (req: Request, res: Response) => {
    const { leadId, phone, script } = req.body;
    
    if (!leadId || !phone) {
      return res.status(400).json({ message: 'Lead ID and phone number are required' });
    }
    
    try {
      // This would be a real Twilio API call in production
      // For now, we'll simulate a successful call
      
      // In a real implementation, we would use Twilio's API like this:
      // const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // const call = await twilioClient.calls.create({
      //   url: 'http://your-twiml-url.com/script',
      //   to: phone,
      //   from: process.env.TWILIO_PHONE_NUMBER
      // });
      
      // Simulate a call ID
      const callId = `CALL${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      res.json({ 
        success: true, 
        callId,
        message: `Call initiated to ${phone}`
      });
    } catch (error: any) {
      console.error('Error initiating call:', error);
      res.status(500).json({ message: 'Error initiating automated call', error: error.message });
    }
  });
  
  // Multi-channel messaging integration (WhatsApp, SMS, Email)
  apiRouter.post('/integrations/multi-channel', async (req: Request, res: Response) => {
    const { leadId, message, channels } = req.body;
    
    if (!leadId || !message) {
      return res.status(400).json({ message: 'Lead ID and message content are required' });
    }
    
    try {
      const lead = await storage.getLead(parseInt(leadId));
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      
      // Track which channels successfully delivered
      const deliveryStatus = {
        whatsapp: false,
        sms: false,
        email: false
      };
      
      // In a real implementation, these would be actual API calls
      // For WhatsApp using WhatsApp Business API
      if (channels.whatsapp && lead.phone) {
        // const whatsappResult = await whatsappClient.sendMessage(lead.phone, message);
        deliveryStatus.whatsapp = true;
      }
      
      // For SMS using Twilio
      if (channels.sms && lead.phone) {
        // const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // const smsResult = await twilioClient.messages.create({
        //   body: message,
        //   to: lead.phone,
        //   from: process.env.TWILIO_PHONE_NUMBER
        // });
        deliveryStatus.sms = true;
      }
      
      // For Email using a service like SendGrid
      if (channels.email && lead.email) {
        // const sgMail = require('@sendgrid/mail');
        // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        // const emailResult = await sgMail.send({
        //   to: lead.email,
        //   from: 'your@company.com',
        //   subject: 'Following up on your interest',
        //   text: message,
        // });
        deliveryStatus.email = true;
      }
      
      res.json({
        success: true,
        channels: deliveryStatus,
        message: 'Follow-up message sent through available channels'
      });
    } catch (error: any) {
      console.error('Error sending multi-channel message:', error);
      res.status(500).json({ message: 'Error sending message', error: error.message });
    }
  });
  
  // LinkedIn Integration API
  apiRouter.post('/integrations/linkedin', async (req: Request, res: Response) => {
    const { profileUrl, message, leadId } = req.body;
    
    if (!profileUrl) {
      return res.status(400).json({ message: 'LinkedIn profile URL is required' });
    }
    
    try {
      // In a real implementation, this would use LinkedIn's API
      // For now, simulate a successful connection
      
      res.json({
        success: true,
        connectionId: `LI${Date.now()}`,
        message: `LinkedIn connection request sent to profile at ${profileUrl}`
      });
    } catch (error: any) {
      console.error('Error with LinkedIn integration:', error);
      res.status(500).json({ message: 'Error with LinkedIn integration', error: error.message });
    }
  });
  
  // Indian Market Integration APIs (JustDial, IndiaMART)
  apiRouter.post('/integrations/indiamart/import', async (req: Request, res: Response) => {
    try {
      // In production, this would connect to IndiaMART's API
      // Simulate importing leads
      
      const importedLeads = [
        {
          fullName: 'Vikram Singh',
          email: 'vikram.singh@example.com',
          phone: '+91 98765 87654',
          company: 'TechSolutions India',
          position: 'Procurement Manager',
          source: 'IndiaMART',
          sourceDetails: 'Product inquiry',
          status: 'new'
        },
        {
          fullName: 'Neha Gupta',
          email: 'neha.gupta@example.com',
          phone: '+91 87654 98765',
          company: 'InnovateTech Ltd',
          position: 'CEO',
          source: 'IndiaMART',
          sourceDetails: 'Price request',
          status: 'new'
        }
      ];
      
      // Store these leads in the database
      const savedLeads = [];
      for (const leadData of importedLeads) {
        const scoredLead = await scoreLead(leadData);
        const lead = await storage.createLead({
          ...leadData,
          aiScore: scoredLead.aiScore,
          aiScoreLabel: scoredLead.aiScoreLabel,
          aiNotes: scoredLead.aiNotes
        });
        savedLeads.push(lead);
      }
      
      res.json({
        success: true,
        importedCount: savedLeads.length,
        leads: savedLeads
      });
    } catch (error: any) {
      console.error('Error importing IndiaMART leads:', error);
      res.status(500).json({ message: 'Error importing leads from IndiaMART', error: error.message });
    }
  });
  
  // Government Tender Search API
  apiRouter.get('/integrations/gov-tenders', async (req: Request, res: Response) => {
    const { sector, keyword } = req.query;
    
    try {
      // In production, this would call an actual government tender API
      // For now, simulate results
      
      const tenders = [
        {
          id: 'GT001',
          title: 'IT Infrastructure Upgrade for Ministry of Technology',
          department: 'Ministry of Technology',
          value: '₹5,00,00,000',
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          location: 'New Delhi',
          description: 'Complete overhaul of IT infrastructure including servers, networking equipment, and workstations.',
          category: 'IT Infrastructure',
          documentUrl: 'https://example.com/tender/GT001'
        },
        {
          id: 'GT002',
          title: 'Software Development Services for E-Governance',
          department: 'Ministry of Digital Services',
          value: '₹2,50,00,000',
          deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days from now
          location: 'Bangalore',
          description: 'Development of new e-governance platform for citizen services and internal government operations.',
          category: 'Software Development',
          documentUrl: 'https://example.com/tender/GT002'
        }
      ];
      
      // Filter by sector or keyword if provided
      const filteredTenders = tenders.filter(tender => {
        if (sector && !tender.category.toLowerCase().includes(sector.toString().toLowerCase())) {
          return false;
        }
        if (keyword && !(
          tender.title.toLowerCase().includes(keyword.toString().toLowerCase()) || 
          tender.description.toLowerCase().includes(keyword.toString().toLowerCase())
        )) {
          return false;
        }
        return true;
      });
      
      res.json({
        success: true,
        tenders: filteredTenders
      });
    } catch (error: any) {
      console.error('Error fetching government tenders:', error);
      res.status(500).json({ message: 'Error searching government tenders', error: error.message });
    }
  });
  
  // Company Info API
  // Original, simpler company info endpoint
  apiRouter.get('/integrations/company-info', async (req: Request, res: Response) => {
    const { name, registrationNumber } = req.query;
    
    if (!name && !registrationNumber) {
      return res.status(400).json({ message: 'Company name or registration number is required' });
    }
    
    try {
      // Import the getCompanyInfo function from the AI module
      const { getCompanyInfo } = await import('./ai');
      
      // If the query is for a specific company and OpenAI API key is available
      // we'll try to get the info using AI first (like Apollo AI)
      if (name && process.env.OPENAI_API_KEY) {
        try {
          console.log(`Attempting AI lookup for company: ${name}`);
          const aiCompanyData = await getCompanyInfo(name.toString());
          
          if (aiCompanyData && aiCompanyData.name) {
            console.log(`AI lookup successful for: ${name}`);
            return res.json({
              success: true,
              company: aiCompanyData,
              source: 'ai'
            });
          }
        } catch (aiError) {
          console.error('Error using AI for company lookup:', aiError);
          // Continue to fallback data
        }
      }
      // In production, this would call a real company information API
      // For now, simulate company data with more comprehensive details
      
      // Sample company data that matches frontend expectations
      const companySamples = [
        {
          id: 1,
          name: "Infosys Limited",
          logo: "https://logo.clearbit.com/infosys.com",
          website: "https://www.infosys.com",
          founded: "1981",
          headquarters: "Bengaluru, Karnataka, India",
          industry: "Information Technology Services",
          employees: "335,186",
          revenue: "₹146,767 crore (US$17.9 billion) (2023)",
          description: "Infosys Limited is an Indian multinational information technology company that provides business consulting, information technology and outsourcing services.",
          ceo: "Salil Parekh",
          socialMedia: {
            linkedin: "https://www.linkedin.com/company/infosys",
            twitter: "https://twitter.com/Infosys",
            facebook: "https://www.facebook.com/Infosys"
          },
          contacts: [
            {
              name: "Investor Relations",
              email: "investors@infosys.com",
              phone: "+91-80-4116-7463"
            },
            {
              name: "Media Relations",
              email: "PR@infosys.com",
              phone: "+91-80-4156-3998"
            },
            {
              name: "Customer Service",
              email: "askus@infosys.com",
              phone: "+91-80-2852-0261"
            }
          ],
          offices: [
            {
              location: "Headquarters",
              address: "Electronics City, Hosur Road, Bengaluru, 560 100, India",
              phone: "+91-80-2852-0261"
            },
            {
              location: "Mumbai Office",
              address: "Godrej & Boyce Complex, Mumbai, Maharashtra, India",
              phone: "+91-22-6776-4199"
            },
            {
              location: "Delhi Office",
              address: "Stellar IT Park, Noida, Uttar Pradesh, India",
              phone: "+91-120-512-5200"
            }
          ],
          keyPeople: [
            {
              name: "Nandan Nilekani",
              position: "Chairman",
              linkedin: "https://www.linkedin.com/in/nandan-nilekani"
            },
            {
              name: "Salil Parekh",
              position: "CEO & MD",
              linkedin: "https://www.linkedin.com/in/salil-parekh"
            },
            {
              name: "Nilanjan Roy",
              position: "CFO",
              linkedin: "https://www.linkedin.com/in/nilanjan-roy"
            }
          ],
          registrationNumber: "L85110KA1981PLC013115",
          incorporationDate: "1981-07-02",
          type: "Public Limited Company",
          status: "Active",
          registeredAddress: "Electronics City, Hosur Road, Bengaluru, 560 100, India",
          financials: {
            revenue: { '2023': '₹146,767 crore', '2022': '₹121,641 crore', '2021': '₹100,472 crore' },
            profit: { '2023': '₹24,508 crore', '2022': '₹22,110 crore', '2021': '₹19,351 crore' },
            assets: { '2023': '₹132,941 crore', '2022': '₹109,357 crore', '2021': '₹92,793 crore' }
          }
        },
        {
          id: 2,
          name: "Tata Consultancy Services",
          logo: "https://logo.clearbit.com/tcs.com",
          website: "https://www.tcs.com",
          founded: "1968",
          headquarters: "Mumbai, Maharashtra, India",
          industry: "Information Technology Services",
          employees: "614,795",
          revenue: "₹240,893 crore (US$29.7 billion) (2023)",
          description: "Tata Consultancy Services Limited (TCS) is an Indian multinational information technology services and consulting company with its headquarters in Mumbai, Maharashtra, India.",
          ceo: "K Krithivasan",
          socialMedia: {
            linkedin: "https://www.linkedin.com/company/tata-consultancy-services",
            twitter: "https://twitter.com/TCS",
            facebook: "https://www.facebook.com/TataConsultancyServices"
          },
          contacts: [
            {
              name: "Investor Relations",
              email: "investor.relations@tcs.com",
              phone: "+91-22-6778-9999"
            },
            {
              name: "Media Relations",
              email: "corporate.communications@tcs.com",
              phone: "+91-22-6778-9999"
            },
            {
              name: "Customer Support",
              email: "customer.support@tcs.com",
              phone: "+91-22-6778-9999"
            }
          ],
          offices: [
            {
              location: "Headquarters",
              address: "TCS House, Raveline Street, Fort, Mumbai - 400001, India",
              phone: "+91-22-6778-9999"
            },
            {
              location: "Bengaluru Office",
              address: "Whitefield, Bengaluru, Karnataka, India",
              phone: "+91-80-6667-8000"
            },
            {
              location: "Chennai Office",
              address: "Siruseri, Chennai, Tamil Nadu, India",
              phone: "+91-44-6667-8000"
            }
          ],
          keyPeople: [
            {
              name: "N Chandrasekaran",
              position: "Chairman, Tata Sons (Former CEO)",
              linkedin: "https://www.linkedin.com/in/n-chandrasekaran"
            },
            {
              name: "K Krithivasan",
              position: "CEO",
              linkedin: "https://www.linkedin.com/in/krithivasan"
            },
            {
              name: "Samir Seksaria",
              position: "CFO",
              linkedin: "https://www.linkedin.com/in/samir-seksaria"
            }
          ],
          registrationNumber: "L22210MH1995PLC084781",
          incorporationDate: "1968-04-19",
          type: "Public Limited Company",
          status: "Active",
          registeredAddress: "9th Floor, Nirmal Building, Nariman Point, Mumbai 400021",
          financials: {
            revenue: { '2023': '₹240,893 crore', '2022': '₹206,549 crore', '2021': '₹167,356 crore' },
            profit: { '2023': '₹42,884 crore', '2022': '₹38,327 crore', '2021': '₹33,388 crore' },
            assets: { '2023': '₹186,826 crore', '2022': '₹155,863 crore', '2021': '₹131,710 crore' }
          }
        },
        {
          id: 3,
          name: "Reliance Industries",
          logo: "https://logo.clearbit.com/ril.com",
          website: "https://www.ril.com",
          founded: "1966",
          headquarters: "Mumbai, Maharashtra, India",
          industry: "Conglomerate (Energy, Petrochemicals, Retail, Telecommunications, Mass Media)",
          employees: "389,000+",
          revenue: "₹933,970 crore (US$117 billion) (2023)",
          description: "Reliance Industries Limited (RIL) is an Indian multinational conglomerate company, headquartered in Mumbai. RIL's diverse businesses include energy, petrochemicals, natural gas, retail, telecommunications, mass media, and textiles.",
          ceo: "Mukesh Ambani",
          socialMedia: {
            linkedin: "https://www.linkedin.com/company/reliance-industries-limited",
            twitter: "https://twitter.com/reliancejio",
            facebook: "https://www.facebook.com/reliancejio"
          },
          contacts: [
            {
              name: "Investor Relations",
              email: "investor.relations@ril.com",
              phone: "+91-22-3555-5000"
            },
            {
              name: "Media Relations",
              email: "media.relations@ril.com",
              phone: "+91-22-3555-5000"
            },
            {
              name: "Corporate Office",
              email: "info@ril.com",
              phone: "+91-22-3555-5000"
            }
          ],
          offices: [
            {
              location: "Corporate Office",
              address: "Maker Chambers IV, 3rd Floor, 222, Nariman Point, Mumbai - 400021, India",
              phone: "+91-22-3555-5000"
            },
            {
              location: "Registered Office",
              address: "3rd Floor, Maker Chambers IV, 222, Nariman Point, Mumbai - 400021, India",
              phone: "+91-22-2278-5000"
            },
            {
              location: "Jamnagar Refinery",
              address: "Village Meghpar/Padana, Taluka Lalpur, Jamnagar, Gujarat, India",
              phone: "+91-288-6622-4001"
            }
          ],
          keyPeople: [
            {
              name: "Mukesh Ambani",
              position: "Chairman & Managing Director",
              linkedin: "https://www.linkedin.com/in/mukesh-ambani"
            },
            {
              name: "Nikhil Meswani",
              position: "Executive Director",
              linkedin: "https://www.linkedin.com/in/nikhil-meswani"
            },
            {
              name: "Hital Meswani",
              position: "Executive Director",
              linkedin: "https://www.linkedin.com/in/hital-meswani"
            }
          ],
          registrationNumber: "L17110MH1973PLC019786",
          incorporationDate: "1966-05-08",
          type: "Public Limited Company",
          status: "Active",
          registeredAddress: "3rd Floor, Maker Chambers IV, 222, Nariman Point, Mumbai - 400021",
          financials: {
            revenue: { '2023': '₹933,970 crore', '2022': '₹721,634 crore', '2021': '₹523,114 crore' },
            profit: { '2023': '₹73,670 crore', '2022': '₹67,845 crore', '2021': '₹53,739 crore' },
            assets: { '2023': '₹1,733,218 crore', '2022': '₹1,476,468 crore', '2021': '₹1,309,238 crore' }
          }
        }
      ];
      
      // Find the company in our sample data
      let matchedCompany = null;
      
      if (name) {
        const searchTerm = name.toString().toLowerCase();
        matchedCompany = companySamples.find(company => 
          company.name.toLowerCase().includes(searchTerm)
        );
      } else if (registrationNumber) {
        matchedCompany = companySamples.find(company => 
          company.registrationNumber === registrationNumber
        );
      }
      
      if (matchedCompany) {
        res.json({
          success: true,
          company: matchedCompany
        });
      } else {
        // Return a default generic company if no match is found
        res.json({
          success: true,
          company: {
            id: 999,
            name: name?.toString() || 'Example Corp India Pvt Ltd',
            logo: "https://via.placeholder.com/150",
            website: "https://www.example.com",
            founded: "2015",
            headquarters: "Bangalore, Karnataka, India",
            industry: "Information Technology",
            employees: "120+",
            revenue: "₹25,00,00,000 (FY 2022-23)",
            description: "A growing IT services and consulting company specializing in digital transformation.",
            ceo: "Amit Sharma",
            registrationNumber: registrationNumber?.toString() || "U72200KHXXXXX",
            incorporationDate: "2015-06-15",
            type: "Private Limited Company",
            status: "Active",
            registeredAddress: "123 Business Park, Tech Lane, Bangalore 560001",
            socialMedia: {
              linkedin: "https://www.linkedin.com/company/example",
              twitter: "https://twitter.com/example",
              facebook: "https://www.facebook.com/example"
            },
            contacts: [
              {
                name: "Corporate Office",
                email: "info@example.com",
                phone: "+91-80-1234-5678"
              }
            ],
            offices: [
              {
                location: "Headquarters",
                address: "123 Business Park, Tech Lane, Bangalore 560001",
                phone: "+91-80-1234-5678"
              }
            ],
            keyPeople: [
              {
                name: "Amit Sharma",
                position: "CEO",
                linkedin: "https://www.linkedin.com/in/amit-sharma"
              },
              {
                name: "Priya Verma",
                position: "CTO",
                linkedin: "https://www.linkedin.com/in/priya-verma"
              }
            ],
            financials: {
              revenue: { '2022': '₹25,00,00,000', '2021': '₹18,50,00,000', '2020': '₹12,00,00,000' },
              profit: { '2022': '₹5,25,00,000', '2021': '₹3,50,00,000', '2020': '₹1,80,00,000' },
              assets: { '2022': '₹35,00,00,000', '2021': '₹28,00,00,000', '2020': '₹18,50,00,000' }
            }
          }
        });
      }
    } catch (error: any) {
      console.error('Error fetching company information:', error);
      res.status(500).json({ message: 'Error retrieving company information', error: error.message });
    }
  });
  
  // Mount the API router
  app.use('/api', apiRouter);
  
  // Mount n8n-style workflow router
  app.use('/api/workflows', workflowRouter);
  
  // Mount webhooks router
  app.use('/api/webhooks', webhookRouter);
  
  // Advanced Company Research API using centralized API service
  // Reinforcement learning status API
  apiRouter.get('/ai/rl-status', async (req: Request, res: Response) => {
    try {
      // Get the current state of all RL models
      const rlState = reinforcementLearning.getModelsState();
      
      res.json({
        success: true,
        rlState,
        initialized: true,
        message: 'Reinforcement learning models are active and learning'
      });
    } catch (error: any) {
      console.error('Error fetching RL status:', error);
      res.status(500).json({ message: 'Error retrieving reinforcement learning status', error: error.message });
    }
  });
  
  apiRouter.get('/company-research', async (req: Request, res: Response) => {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Company name is required' 
      });
    }
    
    try {
      console.log(`[API Router] Requesting company research for: ${name}`);
      
      // Use the API service to get company data
      const companyProfile = await apiService.getCompanyResearch(name.toString());
      
      if (companyProfile && companyProfile.name) {
        console.log(`[API Router] Company research successful for: ${name}`);
        return res.json({ 
          success: true, 
          company: companyProfile
        });
      } else {
        return res.status(404).json({ 
          success: false, 
          message: 'Could not generate company profile with provided information' 
        });
      }
    } catch (error: any) {
      console.error('[API Router] Error processing company research request:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching company information',
        error: error.message
      });
    }
  });

  // Mount integrations router
  app.use('/api/integrations', integrationsRouter);
  
  // Mount LinkedIn API router for data scraping
  app.use('/api/linkedin', linkedinRouter);
  
  // WebSocket server has already been set up above
  // Use the existing wss instance for workflow events
  
  return httpServer;
}
