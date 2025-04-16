import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import * as cheerio from 'cheerio';

// Configuration for LinkedIn scraping
const LINKEDIN_URL = 'https://www.linkedin.com';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * LinkedIn Scraper Class
 * This class is used to scrape data from LinkedIn
 */
export class LinkedInScraper {
  private driver: WebDriver | null = null;
  private loggedIn: boolean = false;
  private username: string;
  private password: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  /**
   * Initialize browser driver
   */
  async initialize(): Promise<void> {
    try {
      // Set up Chrome browser in headless mode
      const options = new ChromeOptions()
        .addArguments('--headless')
        .addArguments('--disable-extensions')
        .addArguments('--disable-gpu')
        .addArguments('--no-sandbox')
        .addArguments('--disable-dev-shm-usage')
        .addArguments('--window-size=1920,1080');

      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      console.log('LinkedIn scraper initialized');
    } catch (error) {
      console.error('Error initializing browser:', error);
      throw error;
    }
  }

  /**
   * Login to LinkedIn
   */
  async login(): Promise<boolean> {
    if (!this.driver) {
      throw new Error('Driver not initialized. Call initialize() first.');
    }

    try {
      await this.driver.get(`${LINKEDIN_URL}/login`);
      
      // Input username and password
      await this.driver.findElement(By.id('username')).sendKeys(this.username);
      await this.driver.findElement(By.id('password')).sendKeys(this.password);
      
      // Click the login button
      await this.driver.findElement(By.css('button[type="submit"]')).click();
      
      // Wait for successful login
      await this.driver.wait(
        until.elementLocated(By.css('.feed-identity-module')),
        DEFAULT_TIMEOUT
      );
      
      this.loggedIn = true;
      console.log('Logged in to LinkedIn');
      return true;
    } catch (error) {
      console.error('Error logging in to LinkedIn:', error);
      return false;
    }
  }

  /**
   * Extract company profile data
   * @param companyName Name of the company
   */
  async getCompanyProfile(companyName: string): Promise<any> {
    if (!this.driver) {
      throw new Error('Driver not initialized.');
    }

    if (!this.loggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Could not login to LinkedIn.');
      }
    }

    try {
      // Search for company
      await this.driver.get(`${LINKEDIN_URL}/search/results/companies/?keywords=${encodeURIComponent(companyName)}`);
      
      // Wait for the first result
      await this.driver.wait(
        until.elementLocated(By.css('.search-results__list .entity-result__title-text a')),
        DEFAULT_TIMEOUT
      );
      
      // Click on the first result
      const firstResultLink = await this.driver.findElement(By.css('.search-results__list .entity-result__title-text a'));
      const companyUrl = await firstResultLink.getAttribute('href');
      await this.driver.get(companyUrl);
      
      // Wait for the company page to load
      await this.driver.wait(
        until.elementLocated(By.css('.org-top-card')),
        DEFAULT_TIMEOUT
      );

      // Extract the HTML
      const pageSource = await this.driver.getPageSource();
      
      // Parse the HTML
      const companyData = this.parseCompanyPage(pageSource);
      
      return {
        success: true,
        data: companyData
      };
    } catch (error) {
      console.error(`Error extracting company profile (${companyName}):`, error);
      return {
        success: false,
        error: `Error extracting company profile: ${(error as any)?.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Search and scrape people profiles
   * @param searchQuery Search query
   * @param limit Maximum number of results
   */
  async searchPeople(searchQuery: string, limit: number = 10): Promise<any> {
    if (!this.driver) {
      throw new Error('Driver not initialized.');
    }

    if (!this.loggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Could not login to LinkedIn.');
      }
    }

    try {
      // Search for people
      await this.driver.get(`${LINKEDIN_URL}/search/results/people/?keywords=${encodeURIComponent(searchQuery)}`);
      
      // Wait for search results
      await this.driver.wait(
        until.elementLocated(By.css('.search-results__list .entity-result')),
        DEFAULT_TIMEOUT
      );
      
      // Extract the HTML
      const pageSource = await this.driver.getPageSource();
      
      // Parse the search results
      const peopleData = this.parsePeopleSearchResults(pageSource, limit);
      
      return {
        success: true,
        data: peopleData
      };
    } catch (error) {
      console.error(`Error searching for people (${searchQuery}):`, error);
      return {
        success: false,
        error: `Error searching for people: ${(error as any)?.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Scrape user profile
   * @param profileUrl Profile URL
   */
  async getUserProfile(profileUrl: string): Promise<any> {
    if (!this.driver) {
      throw new Error('Driver not initialized.');
    }

    if (!this.loggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Could not login to LinkedIn.');
      }
    }

    try {
      // Go to profile page
      await this.driver.get(profileUrl);
      
      // Wait for profile to load
      await this.driver.wait(
        until.elementLocated(By.css('.pv-top-card')),
        DEFAULT_TIMEOUT
      );

      // Extract the HTML
      const pageSource = await this.driver.getPageSource();
      
      // Parse the profile page
      const profileData = this.parseUserProfilePage(pageSource);
      
      return {
        success: true,
        data: profileData
      };
    } catch (error) {
      console.error(`Error scraping user profile:`, error);
      return {
        success: false,
        error: `Error scraping user profile: ${(error as any)?.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Search job posts
   * @param searchQuery Search query
   * @param limit Maximum number of results
   */
  async searchJobs(searchQuery: string, limit: number = 10): Promise<any> {
    if (!this.driver) {
      throw new Error('Driver not initialized.');
    }

    if (!this.loggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Could not login to LinkedIn.');
      }
    }

    try {
      // Search for jobs
      await this.driver.get(`${LINKEDIN_URL}/jobs/search/?keywords=${encodeURIComponent(searchQuery)}`);
      
      // Wait for search results
      await this.driver.wait(
        until.elementLocated(By.css('.jobs-search__results-list')),
        DEFAULT_TIMEOUT
      );
      
      // Extract the HTML
      const pageSource = await this.driver.getPageSource();
      
      // Parse job results
      const jobsData = this.parseJobSearchResults(pageSource, limit);
      
      return {
        success: true,
        data: jobsData
      };
    } catch (error) {
      console.error(`Error searching for jobs (${searchQuery}):`, error);
      return {
        success: false,
        error: `Error searching for jobs: ${(error as any)?.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Clean up and close the scraper
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
      this.loggedIn = false;
      console.log('LinkedIn scraper closed');
    }
  }

  /**
   * Parse company page
   * @param html HTML string
   */
  private parseCompanyPage(html: string): any {
    const $ = cheerio.load(html);
    
    // Extract basic company information
    const companyName = $('.org-top-card__title').text().trim();
    const industry = $('.org-top-card__industry').text().trim();
    const website = $('.org-top-card__link--website').attr('href') || '';
    const companySize = $('.org-about-company-module__company-size-definition-text').text().trim();
    const followers = $('.org-top-card-summary-info-list__info-item').first().text().trim();
    const about = $('.org-about-us-organization-description__text').text().trim();
    
    // Company locations
    const locations: string[] = [];
    $('.org-locations__item').each((_, el) => {
      locations.push($(el).text().trim());
    });
    
    // Recent posts
    const recentPosts: any[] = [];
    $('.updates-content-card').each((_, el) => {
      const postText = $(el).find('.update-components-text').text().trim();
      const timestamp = $(el).find('.update-components-actor__sub-description').text().trim();
      
      if (postText) {
        recentPosts.push({
          text: postText,
          timestamp: timestamp
        });
      }
    });
    
    return {
      name: companyName,
      industry,
      website,
      companySize,
      followers,
      about,
      locations,
      recentPosts: recentPosts.slice(0, 3) // Only take 3 recent posts
    };
  }

  /**
   * Parse people search results
   * @param html HTML string
   * @param limit Maximum results
   */
  private parsePeopleSearchResults(html: string, limit: number): any[] {
    const $ = cheerio.load(html);
    const people: any[] = [];
    
    $('.entity-result').each((i, el) => {
      if (i >= limit) return;
      
      const name = $(el).find('.entity-result__title-text a').text().trim();
      const profileUrl = $(el).find('.entity-result__title-text a').attr('href') || '';
      const title = $(el).find('.entity-result__primary-subtitle').text().trim();
      const location = $(el).find('.entity-result__secondary-subtitle').text().trim();
      
      people.push({
        name,
        profileUrl,
        title,
        location
      });
    });
    
    return people;
  }

  /**
   * Parse user profile page
   * @param html HTML string
   */
  private parseUserProfilePage(html: string): any {
    const $ = cheerio.load(html);
    
    // Basic profile information
    const name = $('.pv-top-card--list .text-heading-xlarge').text().trim();
    const headline = $('.pv-top-card--list .text-body-medium').text().trim();
    const location = $('.pv-top-card--list .text-body-small').text().trim();
    
    // Experience
    const experiences: any[] = [];
    $('.experience-section .pv-entity__position-group').each((_, el) => {
      const company = $(el).find('.pv-entity__secondary-title').text().trim();
      const title = $(el).find('.pv-entity__summary-info-margin-top .t-14').text().trim();
      const duration = $(el).find('.pv-entity__date-range .pv-entity__date-range span:not(.visually-hidden)').text().trim();
      
      experiences.push({
        company,
        title,
        duration
      });
    });
    
    // Education
    const education: any[] = [];
    $('.education-section .pv-education-entity').each((_, el) => {
      const institution = $(el).find('.pv-entity__school-name').text().trim();
      const degree = $(el).find('.pv-entity__degree-name .pv-entity__comma-item').text().trim();
      const field = $(el).find('.pv-entity__fos .pv-entity__comma-item').text().trim();
      const dates = $(el).find('.pv-entity__dates span:not(.visually-hidden)').text().trim();
      
      education.push({
        institution,
        degree,
        field,
        dates
      });
    });
    
    // Skills
    const skills: string[] = [];
    $('.pv-skill-categories-section .pv-skill-category-entity__name-text').each((_, el) => {
      skills.push($(el).text().trim());
    });
    
    return {
      name,
      headline,
      location,
      experiences,
      education,
      skills: skills.slice(0, 10) // Only take 10 skills
    };
  }

  /**
   * Parse job search results
   * @param html HTML string
   * @param limit Maximum results
   */
  private parseJobSearchResults(html: string, limit: number): any[] {
    const $ = cheerio.load(html);
    const jobs: any[] = [];
    
    $('.jobs-search__results-list li').each((i, el) => {
      if (i >= limit) return;
      
      const title = $(el).find('.job-card-list__title').text().trim();
      const company = $(el).find('.job-card-container__company-name').text().trim();
      const location = $(el).find('.job-card-container__metadata-item').text().trim();
      const link = $(el).find('.job-card-list__title').attr('href') || '';
      const listed = $(el).find('.job-card-container__listed-time').text().trim();
      
      jobs.push({
        title,
        company,
        location,
        link: link.startsWith('http') ? link : `${LINKEDIN_URL}${link}`,
        listed
      });
    });
    
    return jobs;
  }
}

// Example usage
// const scraper = new LinkedInScraper('your-email@example.com', 'your-password');
// await scraper.initialize();
// const companyData = await scraper.getCompanyProfile('Microsoft');
// await scraper.close();