import { Router, Request, Response } from 'express';
import { LinkedInScraper } from './linkedin-scraper';

export const linkedinRouter = Router();

// Create scraper with LinkedIn credentials
// Note: In a real scenario, these should be obtained from environment variables
const getLinkedInScraper = (): LinkedInScraper => {
  const username = process.env.LINKEDIN_USERNAME || '';
  const password = process.env.LINKEDIN_PASSWORD || '';
  
  if (!username || !password) {
    throw new Error('LinkedIn credentials missing. Set LINKEDIN_USERNAME and LINKEDIN_PASSWORD environment variables.');
  }
  
  return new LinkedInScraper(username, password);
};

/**
 * Get company profile
 * GET /api/linkedin/company?name=Microsoft
 */
linkedinRouter.get('/company', async (req: Request, res: Response) => {
  const { name } = req.query;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Company name is required'
    });
  }
  
  let scraper: LinkedInScraper | null = null;
  
  try {
    scraper = getLinkedInScraper();
    await scraper.initialize();
    
    const result = await scraper.getCompanyProfile(name.toString());
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error getting LinkedIn company profile:', error);
    return res.status(500).json({
      success: false,
      error: `Error getting LinkedIn company profile: ${error.message || 'Unknown error'}`
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
});

/**
 * Search for people
 * GET /api/linkedin/people?query=software%20engineer&limit=10
 */
linkedinRouter.get('/people', async (req: Request, res: Response) => {
  const { query, limit = '10' } = req.query;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }
  
  let scraper: LinkedInScraper | null = null;
  
  try {
    scraper = getLinkedInScraper();
    await scraper.initialize();
    
    const result = await scraper.searchPeople(
      query.toString(),
      parseInt(limit.toString(), 10)
    );
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error searching for people on LinkedIn:', error);
    return res.status(500).json({
      success: false,
      error: `Error searching for people on LinkedIn: ${error.message || 'Unknown error'}`
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
});

/**
 * Get user profile
 * GET /api/linkedin/profile?url=https://www.linkedin.com/in/username
 */
linkedinRouter.get('/profile', async (req: Request, res: Response) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Profile URL is required'
    });
  }
  
  let scraper: LinkedInScraper | null = null;
  
  try {
    scraper = getLinkedInScraper();
    await scraper.initialize();
    
    const result = await scraper.getUserProfile(url.toString());
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error getting LinkedIn user profile:', error);
    return res.status(500).json({
      success: false,
      error: `Error getting LinkedIn user profile: ${error.message || 'Unknown error'}`
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
});

/**
 * Search jobs
 * GET /api/linkedin/jobs?query=software%20engineer&limit=10
 */
linkedinRouter.get('/jobs', async (req: Request, res: Response) => {
  const { query, limit = '10' } = req.query;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }
  
  let scraper: LinkedInScraper | null = null;
  
  try {
    scraper = getLinkedInScraper();
    await scraper.initialize();
    
    const result = await scraper.searchJobs(
      query.toString(),
      parseInt(limit.toString(), 10)
    );
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error searching for jobs on LinkedIn:', error);
    return res.status(500).json({
      success: false,
      error: `Error searching for jobs on LinkedIn: ${error.message || 'Unknown error'}`
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
});

/**
 * API to create a lead from LinkedIn profile
 * POST /api/linkedin/import-lead
 * Body: { profileUrl: string }
 */
linkedinRouter.post('/import-lead', async (req: Request, res: Response) => {
  const { profileUrl } = req.body;
  
  if (!profileUrl) {
    return res.status(400).json({
      success: false,
      error: 'Profile URL is required'
    });
  }
  
  let scraper: LinkedInScraper | null = null;
  
  try {
    scraper = getLinkedInScraper();
    await scraper.initialize();
    
    // Get profile data from LinkedIn
    const profileResult = await scraper.getUserProfile(profileUrl);
    
    if (!profileResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Error getting LinkedIn profile'
      });
    }
    
    const profileData = profileResult.data;
    
    // Create lead object
    const lead = {
      fullName: profileData.name,
      email: '', // Email cannot be obtained from LinkedIn API
      phone: '', // Phone cannot be obtained from LinkedIn API
      company: profileData.experiences && profileData.experiences.length > 0 
        ? profileData.experiences[0].company 
        : '',
      position: profileData.headline || '',
      source: 'LinkedIn',
      status: 'New',
      notes: `Imported from LinkedIn: ${profileUrl}`,
      score: 0,
      tags: ['LinkedIn Import'],
      linkedinUrl: profileUrl,
      // Additional fields
      location: profileData.location,
      experience: profileData.experiences,
      education: profileData.education,
      skills: profileData.skills
    };
    
    // This can be saved to the lead database here
    // Example: await storage.createLead(lead);
    
    return res.json({
      success: true,
      message: 'Successfully imported lead from LinkedIn profile',
      lead
    });
  } catch (error: any) {
    console.error('Error importing lead from LinkedIn profile:', error);
    return res.status(500).json({
      success: false,
      error: `Error importing lead from LinkedIn profile: ${error.message || 'Unknown error'}`
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
});

/**
 * Validate LinkedIn credentials
 * POST /api/linkedin/validate-credentials
 * Body: { username: string, password: string }
 */
linkedinRouter.post('/validate-credentials', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }
  
  let scraper: LinkedInScraper | null = null;
  
  try {
    scraper = new LinkedInScraper(username, password);
    await scraper.initialize();
    
    const loginSuccess = await scraper.login();
    
    return res.json({
      success: true,
      valid: loginSuccess,
      message: loginSuccess 
        ? 'LinkedIn credentials are valid' 
        : 'LinkedIn credentials are invalid'
    });
  } catch (error: any) {
    console.error('Error validating LinkedIn credentials:', error);
    return res.status(500).json({
      success: false,
      error: `Error validating LinkedIn credentials: ${error.message || 'Unknown error'}`
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
});