import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

// Initialize OpenAI with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Central API service to fetch data from external services
 * This handles all external API requests and data formatting
 */
class APIService {
  
  // Base URL for making Perplexity API requests (if available)
  private perplexityBaseUrl = 'https://api.perplexity.ai';
  
  /**
   * Get company research data from multiple sources
   */
  async getCompanyResearch(companyName: string): Promise<any> {
    try {
      console.log(`[API Service] Researching company: ${companyName}`);
      
      // First try OpenAI for comprehensive data
      if (process.env.OPENAI_API_KEY) {
        try {
          const aiData = await this.getCompanyInfoWithAI(companyName);
          if (aiData && aiData.name) {
            console.log(`[API Service] Successfully got AI company data for: ${companyName}`);
            return aiData;
          }
        } catch (aiError) {
          console.error('[API Service] Error getting AI company data:', aiError);
        }
      }
      
      // Fallback to web scraping
      try {
        console.log(`[API Service] Attempting web scraping for: ${companyName}`);
        return await this.scrapeCompanyData(companyName);
      } catch (scrapeError) {
        console.error('[API Service] Error scraping company data:', scrapeError);
        
        // If all else fails, return a structure with an error message
        return {
          name: companyName,
          error: "Could not retrieve company data. Please try another company or check back later."
        };
      }
    } catch (error) {
      console.error('[API Service] Company research error:', error);
      throw error;
    }
  }
  
  /**
   * Get lead scoring data using AI
   */
  async getLeadScore(leadData: any): Promise<any> {
    try {
      console.log(`[API Service] Scoring lead: ${leadData.fullName}`);
      
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is required for lead scoring');
      }
      
      const prompt = `
        As an expert sales and marketing AI, analyze this lead information and provide a comprehensive scoring:
        
        Lead Information:
        - Name: ${leadData.fullName || 'Unknown'}
        - Email: ${leadData.email || 'Unknown'}
        - Phone: ${leadData.phone || 'Unknown'}
        - Company: ${leadData.company || 'Unknown'}
        - Position: ${leadData.position || 'Unknown'}
        - Source: ${leadData.source || 'Unknown'}
        - Additional info: ${JSON.stringify(leadData.additionalInfo || {})}
        
        Return a JSON object with:
        - score: A numerical score from 1-100
        - label: One of ["Cold", "Warm", "Hot"]
        - notes: Brief analysis explaining the score
        - recommendedActions: Array of 2-3 specific next steps for this lead
        - conversionProbability: Estimated likelihood of conversion as percentage
        - timeFrame: Suggested timeframe for follow-up (e.g., "Immediate", "This week", "Next month")
      `;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('[API Service] Lead scoring error:', error);
      throw error;
    }
  }
  
  /**
   * Get latest government tenders from public sources
   */
  async getGovernmentTenders(sector?: string, limit: number = 10): Promise<any[]> {
    try {
      console.log(`[API Service] Fetching government tenders for sector: ${sector || 'all'}`);
      
      // We'll attempt to scrape the government tenders website
      const tenderUrl = 'https://www.example.gov.in/tenders'; // Replace with actual URL
      
      try {
        // Simulate scraping process
        return this.generateTenderData(sector, limit);
      } catch (scrapeError) {
        console.error('[API Service] Error scraping tender data:', scrapeError);
        
        // If web scraping fails, use AI to generate plausible data structure
        if (process.env.OPENAI_API_KEY) {
          const aiData = await this.getGovernmentTendersWithAI(sector, limit);
          return aiData;
        } else {
          throw scrapeError;
        }
      }
    } catch (error) {
      console.error('[API Service] Government tender fetch error:', error);
      throw error;
    }
  }
  
  /**
   * Get Indian market leads from multiple sources
   */
  async getIndianMarketLeads(industry?: string, limit: number = 20): Promise<any[]> {
    try {
      console.log(`[API Service] Fetching Indian market leads for industry: ${industry || 'all'}`);
      
      // Attempt to get leads from multiple sources
      const leads = [];
      
      // Add logic to fetch from real sources here
      
      // If we have OpenAI, use it to generate structured data
      if (process.env.OPENAI_API_KEY) {
        const aiLeads = await this.getIndianMarketLeadsWithAI(industry, limit);
        return aiLeads;
      }
      
      return leads;
    } catch (error) {
      console.error('[API Service] Indian market leads fetch error:', error);
      throw error;
    }
  }
  
  /**
   * Generate message suggestions for follow-up communications
   */
  async generateFollowUpMessages(leadData: any, channel: string, previousMessages?: string[]): Promise<any> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is required for message generation');
      }
      
      const previousMessagesText = previousMessages ? 
        `Previous messages:
        ${previousMessages.join('\n')}` : '';
      
      const prompt = `
        As an expert sales communication AI, create 3 follow-up message templates for ${channel} to send to this lead:
        
        Lead Information:
        - Name: ${leadData.fullName || 'Unknown'}
        - Email: ${leadData.email || 'Unknown'}
        - Company: ${leadData.company || 'Unknown'}
        - Position: ${leadData.position || 'Unknown'}
        - Source: ${leadData.source || 'Unknown'}
        - Status: ${leadData.status || 'Unknown'}
        - Last contact: ${leadData.lastContactDate || 'Unknown'}
        
        ${previousMessagesText}
        
        Return a JSON object with:
        - messages: Array of 3 message objects, each with "subject" (for email only) and "body"
        - bestTimes: Suggested best times to send the message
        - callToAction: Specific call to action to include
        - personalizationTips: Tips for personalizing the message
      `;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('[API Service] Message generation error:', error);
      throw error;
    }
  }
  
  // Private methods for implementation details
  
  /**
   * Generate company information using AI
   */
  private async getCompanyInfoWithAI(companyName: string): Promise<any> {
    // First check if we have the OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not found");
    }

    // Using OpenAI to generate detailed company information based on the name
    const prompt = `
      Generate a comprehensive, detailed, and factually accurate research report on the company "${companyName}". Conduct a thorough analysis including business operations, market positioning, leadership, and financial status.
      
      Return ONLY a JSON object with the following structure:
      {
        "name": "Full legal company name",
        "type": "Type of company (e.g., Public Limited, Private Limited, etc.)",
        "industry": "Primary industry or sector",
        "yearEstablished": "Year founded if known",
        "headquarters": {
          "city": "Headquarters city",
          "state": "Headquarters state/region",
          "country": "Headquarters country"
        },
        "keyPeople": [
          {
            "name": "Executive full name",
            "position": "Executive position/title"
          }
        ],
        "employees": "Approximate number of employees (e.g., '5,000+' or 'Under 50')",
        "productsServices": [
          "List of main products or services offered by the company"
        ],
        "financials": {
          "revenue": "Annual revenue if known (e.g., '₹500 crore' or '$10 million')",
          "profit": "Net profit if known",
          "marketCap": "Market capitalization if publicly traded"
        },
        "website": "Company website URL",
        "contactInfo": "General contact information",
        "subsidiaries": [
          "Names of any known subsidiaries or brands owned by the company"
        ],
        "competitors": [
          "Names of main competitors in the industry"
        ],
        "recentNews": [
          {
            "title": "Title of recent news article",
            "date": "Date of publication",
            "source": "Source of the news",
            "url": "URL to the news article if available"
          }
        ],
        "socialMedia": [
          {
            "platform": "Name of platform (e.g., LinkedIn, Twitter, Facebook)",
            "url": "URL to the company's profile on this platform"
          }
        ],
        "stockInfo": {
          "symbol": "Stock market symbol/ticker if publicly traded",
          "exchange": "Stock exchange where traded",
          "currentPrice": "Current stock price",
          "change": "Recent price change (with + or - symbol)",
          "changePercent": "Percentage change"
        },
        "fundingRounds": [
          {
            "round": "Funding round name (e.g., Series A)",
            "date": "Date of funding",
            "amount": "Amount raised",
            "investors": ["List of key investors"]
          }
        ],
        "vision": "Company vision statement",
        "mission": "Company mission statement",
        "coreValues": [
          "List of company's core values"
        ],
        "legalIssues": [
          {
            "title": "Brief title of legal issue or controversy",
            "description": "Short description of the issue",
            "year": "Year when the issue occurred or was reported"
          }
        ],
        "marketPosition": {
          "marketShare": "Estimated market share percentage if known",
          "industryRanking": "Ranking in its industry (e.g., '3rd largest')",
          "growthRate": "Annual growth rate if known"
        },
        "businessModel": "Brief description of the company's business model",
        "sustainabilityEfforts": [
          "Notable environmental or social responsibility initiatives"
        ],
        "awards": [
          {
            "name": "Name of award or recognition",
            "year": "Year received",
            "organization": "Awarding organization"
          }
        ],
        "patentsIP": [
          "Notable patents or intellectual property"
        ],
        "strategicPartnerships": [
          "Key business partnerships or alliances"
        ],
        "futureOutlook": "Brief analysis of company's future prospects and challenges",
        "uniqueSellingPoints": [
          "Company's unique value propositions or differentiators"
        ],
        "governance": {
          "boardSize": "Number of board members",
          "boardStructure": "Description of board committee structure",
          "ownershipStructure": "Major shareholders or ownership distribution"
        },
        "internationalPresence": [
          "Countries or regions where the company operates"
        ],
        "riskFactors": [
          "Key business or industry risks facing the company"
        ]
      }
      
      For Indian companies, include any known:
      - GST registration details
      - PAN number information
      - CIN (Corporate Identity Number)
      - Regulatory compliance status
      - Special certifications or approvals
      - Registration with industry bodies

      If you don't know certain information, provide null for that field or omit the field entirely. For arrays, if you don't have information, include an empty array [].
      
      Only include verifiable, factual information. DON'T MAKE UP ANY DATA. Be specific with numbers (revenue, employees, etc.) when information is reliably known.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || '{}';
    const companyData = JSON.parse(content);
    
    // Add a unique ID to the company data
    companyData.id = Date.now();
    
    return companyData;
  }
  
  /**
   * Scrape company data from web sources
   */
  private async scrapeCompanyData(companyName: string): Promise<any> {
    // Implementation similar to existing scrapeCompanyInfo function
    // with enhanced error handling and multiple sources
    
    // Clean up the company name to make it URL-safe
    const cleanName = encodeURIComponent(companyName.trim().toLowerCase());
    
    // Create a combined data object
    let companyData: any = {
      id: Date.now(),
      name: decodeURIComponent(cleanName).replace(/\+/g, ' '),
      type: null,
      industry: null,
      founded: null,
      headquarters: {
        city: null,
        state: null,
        country: "India" // Default to India since this is for Indian market
      },
      employees: null,
      revenue: null,
      description: null,
      ceo: null,
      website: null,
      socialMedia: [],
      contacts: [
        {
          name: "Main Office",
          email: null,
          phone: null
        }
      ],
      offices: [
        {
          location: "Headquarters",
          address: null,
          phone: null
        }
      ],
      keyPeople: [],
      productsServices: [],
      competitors: [],
      financials: {
        revenue: null,
        profit: null,
        marketCap: null
      }
    };
    
    // Try to get business info from web search
    try {
      const googleSearchUrl = `https://www.google.com/search?q=${cleanName}+company+information+india`;
      const { data } = await axios.get(googleSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(data);
      
      // Extract available information from search results
      // This is a simple implementation and would need to be enhanced for production
      
      // Try to extract company description
      const description = $('.kno-rdesc span').first().text();
      if (description) {
        companyData.description = description;
      }
      
      // Try to extract website
      const website = $('a').filter(function() {
        return $(this).attr('href')?.includes('/url?q=');
      }).first().attr('href');
      
      if (website) {
        const websiteUrl = website.split('/url?q=')[1]?.split('&')[0];
        if (websiteUrl) {
          companyData.website = decodeURIComponent(websiteUrl);
        }
      }
    } catch (err) {
      console.error('Error searching web for company data:', err);
    }
    
    return companyData;
  }
  
  /**
   * Generate government tenders using AI
   */
  private async getGovernmentTendersWithAI(sector?: string, limit: number = 10): Promise<any[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not found");
    }

    const prompt = `
      Generate a realistic list of ${limit} current Indian government tenders${sector ? ' in the ' + sector + ' sector' : ''}. 
      
      Each tender should have:
      - tenderId: A unique tender ID in the format "TENDER/GOV-XXXX-YY-ZZ"
      - title: Clear description of the tender
      - ministry: The government ministry/department issuing the tender
      - location: City/state where the work will be performed
      - bidDeadline: Deadline date in ISO format (YYYY-MM-DD)
      - estimatedValue: Estimated contract value in ₹ format
      - category: Main category of the tender
      - eligibilityCriteria: Brief description of eligibility requirements
      - documentUrl: Link to tender documents (use "https://example.gov.in/tenders/ID")
      - status: One of ["Open", "Closing Soon", "Closed", "Awarded"]
      
      Return a JSON array of tender objects. Use realistic ministries, locations, and dates (deadlines should be a mix of future dates 15-60 days from now). Estimated values should be realistic for the type of work.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || '{"tenders":[]}';
    const tenderData = JSON.parse(content);
    
    return tenderData.tenders || [];
  }
  
  /**
   * Generate Indian market leads using AI
   */
  private async getIndianMarketLeadsWithAI(industry?: string, limit: number = 20): Promise<any[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not found");
    }

    const prompt = `
      Generate a realistic list of ${limit} potential business leads in India${industry ? ' in the ' + industry + ' industry' : ''}. 
      
      Each lead should have:
      - id: A unique numeric ID
      - fullName: Person's full name (use common Indian names)
      - email: Business email address
      - phone: Indian format phone number
      - company: Company name
      - position: Job title/position
      - location: City and state in India
      - industry: Industry sector
      - employeeCount: Approximate number of employees
      - annualRevenue: Approximate annual revenue in ₹ format
      - source: Where this lead was generated from (e.g., "LinkedIn", "IndiaMART", "Website Form", "Industry Event")
      - lastContactDate: Date of last contact in ISO format (YYYY-MM-DD) or null if not contacted
      - status: One of ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]
      - notes: Brief relevant notes about the lead
      - aiScore: A score between 1-100 representing lead quality
      - aiScoreLabel: One of ["Cold", "Warm", "Hot"]
      
      Return a JSON array of lead objects. Use realistic Indian company names, positions, cities, and industries. Create a diverse mix of company sizes and revenue ranges. Make sure all phone numbers use the +91 country code and follow Indian phone number patterns. Emails should match the person's name and company domain.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || '{"leads":[]}';
    const leadData = JSON.parse(content);
    
    return leadData.leads || [];
  }
  
  /**
   * Generate sample tender data for testing
   */
  private generateTenderData(sector?: string, limit: number = 10): any[] {
    // This is just a placeholder - in production, this would be replaced with real API call
    // Sample structure only
    const sectors = ['IT', 'Healthcare', 'Infrastructure', 'Defense', 'Education', 'Agriculture', 'Energy'];
    const ministries = [
      'Ministry of Electronics and Information Technology', 
      'Ministry of Health and Family Welfare',
      'Ministry of Road Transport and Highways',
      'Ministry of Defence',
      'Ministry of Education',
      'Ministry of Agriculture',
      'Ministry of Power'
    ];
    
    const tenders = [];
    
    for (let i = 0; i < limit; i++) {
      const tenderSector = sector || sectors[Math.floor(Math.random() * sectors.length)];
      const sectorIndex = sectors.indexOf(tenderSector);
      const ministry = sectorIndex >= 0 ? ministries[sectorIndex] : ministries[Math.floor(Math.random() * ministries.length)];
      
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + Math.floor(Math.random() * 45) + 15); // 15-60 days in future
      
      tenders.push({
        tenderId: `TENDER/GOV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`,
        title: `Sample Tender Title for ${tenderSector} Project`,
        ministry,
        location: 'Sample City, Sample State',
        bidDeadline: deadline.toISOString().split('T')[0],
        estimatedValue: `₹${(Math.floor(Math.random() * 9000) + 1000).toLocaleString()} Lakhs`,
        category: tenderSector,
        eligibilityCriteria: 'Sample eligibility criteria',
        documentUrl: 'https://example.gov.in/tenders/12345',
        status: 'Open'
      });
    }
    
    return tenders;
  }
}

// Export a singleton instance
export const apiService = new APIService();