import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { scoreLead } from './ai';
import crypto from 'crypto';

// Create router
export const webhookRouter = Router();

// Generate a random webhook ID
function generateWebhookId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// Verify webhook secret
function validateWebhookSecret(req: Request, webhookSecret: string): boolean {
  const receivedSecret = req.header('X-Webhook-Secret');
  return receivedSecret === webhookSecret;
}

// Receive webhook data from any source
webhookRouter.post('/generic/:id', async (req: Request, res: Response) => {
  try {
    const webhookId = req.params.id;
    
    // In a real implementation, we would validate the webhook ID and secret
    // For demo purposes, we'll just accept the data
    
    const data = req.body;
    
    // Try to extract a lead from the data
    let leadData = {
      fullName: data.name || data.fullName || '',
      email: data.email || '',
      phone: data.phone || data.phoneNumber || data.mobile || '',
      company: data.company || data.companyName || data.organization || '',
      position: data.position || data.jobTitle || data.title || '',
      source: 'webhook',
      sourceDetails: `Webhook ID: ${webhookId}`,
      status: 'new'
    };
    
    // If we have a name or email, create a lead
    if (leadData.fullName || leadData.email) {
      // Score the lead with AI
      const scoredLead = await scoreLead(leadData);
      leadData = { ...leadData, ...scoredLead };
      
      // Create the lead
      const lead = await storage.createLead(leadData);
      
      res.status(201).json({ 
        success: true, 
        message: 'Lead created successfully',
        leadId: lead.id
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Could not extract lead information from webhook data'
      });
    }
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing webhook data',
      error: error.message
    });
  }
});

// Form submission handler
webhookRouter.post('/form/:formId', async (req: Request, res: Response) => {
  try {
    const formId = req.params.formId;
    
    // In a real implementation, we would validate the form ID
    // For demo purposes, we'll just accept the data
    
    const formData = req.body;
    
    // Extract UTM parameters if available
    const utmSource = formData.utm_source || formData.utmSource || req.query.utm_source;
    const utmMedium = formData.utm_medium || formData.utmMedium || req.query.utm_medium;
    const utmCampaign = formData.utm_campaign || formData.utmCampaign || req.query.utm_campaign;
    
    // Construct source details
    let sourceDetails = `Form ID: ${formId}`;
    if (utmSource || utmMedium || utmCampaign) {
      sourceDetails += ` | UTM: ${utmSource || 'direct'} / ${utmMedium || 'none'} / ${utmCampaign || 'none'}`;
    }
    
    // Create lead data
    let leadData = {
      fullName: formData.name || formData.fullName || '',
      email: formData.email || '',
      phone: formData.phone || formData.phoneNumber || '',
      company: formData.company || formData.organization || '',
      position: formData.position || formData.jobTitle || '',
      source: 'website_form',
      sourceDetails,
      status: 'new',
      additionalInfo: {
        formData: { ...formData },
        ipAddress: req.ip,
        userAgent: req.header('User-Agent')
      }
    };
    
    // If we have a name or email, create a lead
    if (leadData.fullName || leadData.email) {
      // Score the lead with AI
      const scoredLead = await scoreLead(leadData);
      leadData = { ...leadData, ...scoredLead };
      
      // Create the lead
      const lead = await storage.createLead(leadData);
      
      // In a real implementation, we might want to send an email notification
      // or trigger another workflow
      
      // Return a success response with html if requested
      if (req.accepts('html')) {
        res.status(201).send(`
          <html>
            <head>
              <title>Form Submitted</title>
              <meta http-equiv="refresh" content="3;url=${formData.redirect_url || '/'}">
              <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                .success { color: green; }
              </style>
            </head>
            <body>
              <h1 class="success">Form Submitted Successfully!</h1>
              <p>Thank you for your submission. Redirecting you in 3 seconds...</p>
            </body>
          </html>
        `);
      } else {
        res.status(201).json({ 
          success: true, 
          message: 'Form submitted successfully',
          leadId: lead.id
        });
      }
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Could not extract lead information from form data'
      });
    }
  } catch (error: any) {
    console.error('Form processing error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing form data',
      error: error.message
    });
  }
});

// Get all webhooks
webhookRouter.get('/webhooks', async (req: Request, res: Response) => {
  try {
    // In a real implementation, we would fetch webhooks from the database
    // For demo purposes, we'll return a sample list
    
    res.json([
      {
        id: '12345abc',
        name: 'Website Contact Form',
        url: `${req.protocol}://${req.get('host')}/api/webhooks/generic/12345abc`,
        createdAt: '2025-03-15T10:00:00Z',
        status: 'active',
        leadCount: 17
      },
      {
        id: '67890def',
        name: 'Landing Page Form',
        url: `${req.protocol}://${req.get('host')}/api/webhooks/generic/67890def`,
        createdAt: '2025-04-01T15:30:00Z',
        status: 'active',
        leadCount: 8
      }
    ]);
  } catch (error: any) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching webhooks',
      error: error.message
    });
  }
});

// Create new webhook
webhookRouter.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const { name, endpoint } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Webhook name is required' });
    }
    
    // Generate a unique ID and secret for this webhook
    const webhookId = generateWebhookId();
    const webhookSecret = crypto.randomBytes(16).toString('hex');
    
    // In a real implementation, we would store this in the database
    // For demo purposes, we'll just return the details
    
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/webhooks/generic/${webhookId}`;
    
    res.status(201).json({
      success: true,
      message: 'Webhook created successfully',
      id: webhookId,
      name,
      url: webhookUrl,
      secret: webhookSecret,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating webhook',
      error: error.message
    });
  }
});

// Get HTML/JS snippet for embedding form on website
webhookRouter.get('/snippet/:formId', async (req: Request, res: Response) => {
  try {
    const formId = req.params.formId;
    const apiEndpoint = `${req.protocol}://${req.get('host')}/api/webhooks/form/${formId}`;
    
    // HTML form snippet with JavaScript
    const htmlSnippet = `
    <!-- LeadGenius Form Widget -->
    <div id="leadgenius-form-${formId}">
      <form id="lg-form-${formId}" action="${apiEndpoint}" method="POST">
        <div class="lg-form-group">
          <label for="lg-name-${formId}">Full Name</label>
          <input type="text" id="lg-name-${formId}" name="fullName" required>
        </div>
        <div class="lg-form-group">
          <label for="lg-email-${formId}">Email</label>
          <input type="email" id="lg-email-${formId}" name="email" required>
        </div>
        <div class="lg-form-group">
          <label for="lg-phone-${formId}">Phone</label>
          <input type="tel" id="lg-phone-${formId}" name="phone">
        </div>
        <div class="lg-form-group">
          <label for="lg-company-${formId}">Company</label>
          <input type="text" id="lg-company-${formId}" name="company">
        </div>
        <div class="lg-form-group">
          <label for="lg-message-${formId}">Message</label>
          <textarea id="lg-message-${formId}" name="message" rows="4"></textarea>
        </div>
        <div class="lg-form-group">
          <button type="submit">Submit</button>
        </div>
      </form>
    </div>
    
    <script>
      // Add UTM parameters from URL to form submission
      document.addEventListener('DOMContentLoaded', function() {
        const form = document.getElementById('lg-form-${formId}');
        const urlParams = new URLSearchParams(window.location.search);
        const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
        
        form.addEventListener('submit', function(e) {
          utmParams.forEach(param => {
            if (urlParams.has(param)) {
              const hiddenField = document.createElement('input');
              hiddenField.type = 'hidden';
              hiddenField.name = param;
              hiddenField.value = urlParams.get(param);
              form.appendChild(hiddenField);
            }
          });
        });
      });
    </script>
    
    <style>
      #leadgenius-form-${formId} {
        max-width: 500px;
        margin: 0 auto;
        font-family: Arial, sans-serif;
      }
      #leadgenius-form-${formId} .lg-form-group {
        margin-bottom: 15px;
      }
      #leadgenius-form-${formId} label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      #leadgenius-form-${formId} input,
      #leadgenius-form-${formId} textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      #leadgenius-form-${formId} button {
        background-color: #4a6cf7;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      }
      #leadgenius-form-${formId} button:hover {
        background-color: #3a5bd9;
      }
    </style>
    <!-- End LeadGenius Form Widget -->
    `;
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(htmlSnippet);
  } catch (error: any) {
    console.error('Error generating form snippet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating form snippet',
      error: error.message
    });
  }
});

// Module export
export default webhookRouter;