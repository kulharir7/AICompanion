import type { InsertLead } from "@shared/schema";
import OpenAI from "openai";
import axios from 'axios';
import * as cheerio from 'cheerio';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// Use OpenAI API to score leads based on their data
export async function scoreLead(leadData: Partial<InsertLead>): Promise<{
  aiScore: number;
  aiScoreLabel: string;
  aiNotes: string;
}> {
  try {
    // First try using the OpenAI API for sophisticated lead scoring
    const prompt = `
      Analyze the following lead information and provide a 0-100 score on how likely they are to convert:
      
      Name: ${leadData.fullName || 'Not provided'}
      Email: ${leadData.email || 'Not provided'}
      Phone: ${leadData.phone || 'Not provided'}
      Company: ${leadData.company || 'Not provided'}
      Position: ${leadData.position || 'Not provided'}
      Source: ${leadData.source || 'Not provided'}
      Source Details: ${leadData.sourceDetails || 'Not provided'}
      
      Consider the following factors:
      - LinkedIn leads are often higher quality for B2B (score higher)
      - Website leads show high intent (score higher)
      - Social media leads are medium-intent (score medium)
      - Scraped leads might be lower quality (score lower)
      - More complete lead profiles indicate higher engagement (score higher)
      
      Return a JSON object with the following format:
      {
        "score": (0-100 numeric score),
        "label": "hot", "warm", or "cold",
        "notes": "Brief analysis of the lead's intent and follow-up recommendations"
      }
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content || '{}';
    const result = JSON.parse(content);
    
    return {
      aiScore: result.score,
      aiScoreLabel: result.label,
      aiNotes: result.notes
    };
  } catch (error) {
    console.error('Error using OpenAI for lead scoring:', error);
    
    // Fallback to rule-based scoring if OpenAI API fails
    let score = 50; // Default score
    
    // Score based on source
    if (leadData.source) {
      switch (leadData.source) {
        case 'website':
          score += 15; // Website visitors are often higher intent
          break;
        case 'facebook':
        case 'instagram':
          score += 10; // Social media leads are medium intent
          break;
        case 'linkedin':
          score += 20; // LinkedIn leads are typically higher quality for B2B
          break;
        case 'b2b_scraping':
          score -= 5; // Scraped leads might be lower quality
          break;
      }
    }
    
    // Score based on completeness of information
    if (leadData.email) score += 5;
    if (leadData.phone) score += 10;
    if (leadData.company) score += 10;
    if (leadData.position) score += 5;
    
    // Cap score between 0 and 100
    score = Math.max(0, Math.min(100, score));
    
    // Determine label based on score
    let label: string;
    let notes: string;
    
    if (score >= 80) {
      label = 'hot';
      notes = 'High intent lead based on source and profile. Prioritize immediate follow-up.';
    } else if (score >= 50) {
      label = 'warm';
      notes = 'Medium intent lead. Schedule follow-up within 24-48 hours.';
    } else {
      label = 'cold';
      notes = 'Low intent lead. Add to nurturing campaign.';
    }
    
    return {
      aiScore: score,
      aiScoreLabel: label,
      aiNotes: notes
    };
  }
}

// For auto-caller simulation (in a real app, this would use Twilio)
export async function simulateCall(phone: string, script: string): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> {
  // Since this is an MVP and we don't have actual Twilio integration,
  // we'll just simulate a successful call
  
  // In production with Twilio, the code might look like:
  /*
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);
  
  try {
    const call = await client.calls.create({
      twiml: `<Response><Say>${script}</Say></Response>`,
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    
    return {
      success: true,
      response: call.sid
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
  */
  
  return {
    success: true,
    response: "The lead expressed interest in the product and requested more information."
  };
}

// Function to get company information using AI (similar to Apollo AI)

/**
 * Get company information using a web scraping approach
 * This function will scrape publicly available data about the company
 */
export async function getCompanyInfo(companyName: string): Promise<any> {
  try {
    // First check if the company name is provided
    if (!companyName || companyName.trim().length === 0) {
      throw new Error("Company name is required");
    }

    // Clean up the company name to make it URL-safe
    const cleanName = encodeURIComponent(companyName.trim().toLowerCase());
    console.log(`Searching for company information: ${cleanName}`);
    
    // Start with a web search to find company information
    try {
      return await scrapeCompanyInfo(cleanName);
    } catch (scrapeError) {
      console.error('Error during web scraping:', scrapeError);

      // If we have OpenAI API key available, try using it as fallback
      if (process.env.OPENAI_API_KEY) {
        console.log("Falling back to OpenAI API for company information");
        return await getCompanyInfoWithAI(companyName);
      } else {
        throw scrapeError;
      }
    }
  } catch (error) {
    console.error('Error fetching company information:', error);
    throw error;
  }
}

/**
 * Scrape company information from multiple sources
 */
async function scrapeCompanyInfo(companyName: string): Promise<any> {
  try {
    // Create a combined data object
    let companyData: any = {
      id: Date.now(),
      name: decodeURIComponent(companyName).replace(/\+/g, ' '),
      logo: null,
      website: null,
      founded: null,
      headquarters: null,
      industry: null,
      employees: null,
      revenue: null,
      description: null,
      ceo: null,
      type: null,
      status: "Active", // Default assumption
      socialMedia: {
        linkedin: null,
        twitter: null,
        facebook: null
      },
      contacts: [
        {
          name: "Main Contact",
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
      keyPeople: []
    };

    // First try to get business info from a Google search
    try {
      const googleSearchUrl = `https://www.google.com/search?q=${companyName}+company+information+india`;
      const { data } = await axios.get(googleSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(data);
      
      // Try to extract company description
      const description = $('.kno-rdesc span').first().text();
      if (description) {
        companyData.description = description;
      }
      
      // Try to extract website
      const website = $('a[data-url]').filter(function(this: any) {
        return $(this).attr('href')?.includes('/url?q=');
      }).first().attr('href');
      
      if (website) {
        const websiteUrl = website.split('/url?q=')[1]?.split('&')[0];
        if (websiteUrl) {
          companyData.website = decodeURIComponent(websiteUrl);
        }
      }
    } catch (googleError) {
      console.error('Error searching Google:', googleError);
    }

    // If we found a website, try to extract more information from it
    if (companyData.website) {
      try {
        console.log(`Extracting info from website: ${companyData.website}`);
        const { data } = await axios.get(companyData.website, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
          },
          timeout: 5000
        });
        
        const $ = cheerio.load(data);
        
        // Try to extract the company logo
        const logoUrl = $('img[src*="logo"]').first().attr('src') || 
                      $('a[href="/"] img').first().attr('src') ||
                      $('header img').first().attr('src');
                      
        if (logoUrl) {
          // Make sure it's an absolute URL
          if (logoUrl.startsWith('http')) {
            companyData.logo = logoUrl;
          } else {
            // Convert relative to absolute URL
            const baseUrl = new URL(companyData.website).origin;
            companyData.logo = new URL(logoUrl, baseUrl).toString();
          }
        }
        
        // Try to extract social media links
        $('a[href*="linkedin.com"]').first().each((_, el) => {
          companyData.socialMedia.linkedin = $(el).attr('href');
        });
        
        $('a[href*="twitter.com"]').first().each((_, el) => {
          companyData.socialMedia.twitter = $(el).attr('href');
        });
        
        $('a[href*="facebook.com"]').first().each((_, el) => {
          companyData.socialMedia.facebook = $(el).attr('href');
        });
        
        // Look for contact email
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const bodyText = $('body').text();
        const emailMatch = bodyText.match(emailRegex);
        if (emailMatch && emailMatch[0]) {
          companyData.contacts[0].email = emailMatch[0];
        }
        
        // Look for contact phone
        const phoneRegex = /(\+\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?){2}\d{4}/;
        const phoneMatch = bodyText.match(phoneRegex);
        if (phoneMatch && phoneMatch[0]) {
          companyData.contacts[0].phone = phoneMatch[0];
        }
        
        // Try to find the company address
        $('address').first().each((_, el) => {
          companyData.offices[0].address = $(el).text().trim().replace(/\s+/g, ' ');
        });
        
        // Look for "about us" or "contact" pages for more info
        const aboutLink = $('a[href*="about"]').first().attr('href');
        if (aboutLink) {
          const aboutUrl = aboutLink.startsWith('http') ? aboutLink : new URL(aboutLink, companyData.website).toString();
          try {
            const { data: aboutData } = await axios.get(aboutUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
              },
              timeout: 5000
            });
            
            const about$ = cheerio.load(aboutData);
            
            // Look for founding year
            const foundedMatch = about$('body').text().match(/founded in (\d{4})|established in (\d{4})|since (\d{4})/i);
            if (foundedMatch) {
              companyData.founded = foundedMatch[1] || foundedMatch[2] || foundedMatch[3];
            }
            
            // Look for CEO or leadership info
            about$('h1, h2, h3, h4, h5, h6').each((_, el) => {
              const headerText = about$(el).text().toLowerCase();
              if (headerText.includes('founder') || headerText.includes('ceo') || headerText.includes('leadership')) {
                const nextEl = about$(el).next();
                if (nextEl) {
                  const name = nextEl.find('strong').first().text() || nextEl.text();
                  if (name && name.length < 100) { // Sanity check to avoid capturing paragraphs
                    const position = headerText.includes('ceo') ? 'CEO' : 
                                   headerText.includes('founder') ? 'Founder' : 'Executive';
                    
                    companyData.keyPeople.push({
                      name: name.trim().replace(/\s+/g, ' '),
                      position,
                      linkedin: null
                    });
                    
                    if (position === 'CEO') {
                      companyData.ceo = name.trim().replace(/\s+/g, ' ');
                    }
                  }
                }
              }
            });
          } catch (aboutError) {
            console.error('Error scraping about page:', aboutError);
          }
        }
      } catch (websiteError) {
        console.error('Error scraping company website:', websiteError);
      }
    }
    
    // Fill in headquarters if we have the address
    if (companyData.offices[0].address && !companyData.headquarters) {
      // Extract just the city & country part
      const addressParts = companyData.offices[0].address.split(',');
      if (addressParts.length >= 2) {
        companyData.headquarters = addressParts[addressParts.length - 2].trim() + ', ' + 
                                  addressParts[addressParts.length - 1].trim();
      } else {
        companyData.headquarters = companyData.offices[0].address;
      }
    }

    // Provide a placeholder logo if none was found
    if (!companyData.logo) {
      companyData.logo = `https://logo.clearbit.com/${companyData.website?.replace('https://', '')?.replace('http://', '')?.split('/')[0]}`;
    }
    
    return companyData;
  } catch (error: any) {
    console.error('Error in scrapeCompanyInfo:', error);
    throw new Error(`Failed to scrape company information: ${error.message}`);
  }
}

/**
 * Generate comprehensive company profile information using AI
 */
async function getCompanyInfoWithAI(companyName: string): Promise<any> {
  try {
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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content || '{}';
    const companyData = JSON.parse(content);
    
    // Add a unique ID to the company data
    companyData.id = Date.now();
    
    return companyData;
  } catch (error) {
    console.error('Error fetching company information using AI:', error);
    throw error;
  }
}
