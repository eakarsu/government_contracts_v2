const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const puppeteer = require('puppeteer');
const officegen = require('officegen');
const compression = require('compression');
const { SitemapStream, streamToPromise } = require('sitemap');

//add
// Add these imports at the top
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const { optionalAuth } = require('./middleware/auth');

// Import new feature modules
const { validateCompliance, complianceChecker } = require('./middleware/compliance');
const nlpRoutes = require('./routes/nlp');
const esignatureRoutes = require('./routes/esignature');
const templatesRoutes = require('./routes/templates');
const http = require('http');
const socketIo = require('socket.io');
//add

require('dotenv').config();

// Debug: Check if .env file is loaded
console.log('=== Environment Variables Check ===');
console.log('OPENROUTER_API_KEY loaded:', !!process.env.OPENROUTER_API_KEY);
console.log('OPENROUTER_MODEL loaded:', process.env.OPENROUTER_MODEL || 'not set');
console.log('PORT loaded:', process.env.PORT || 'using default 3000');
console.log('===================================');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Make io available to routes
app.set('io', io);

// Security middleware with relaxed CSP for development
// Enable compression for better performance
app.use(compression());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://code.jquery.com",
        "https://cdnjs.cloudflare.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://www.google-analytics.com"]
    }
  }
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//add
// Add session configuration after existing middleware
app.use(session({
    store: new pgSession({
        pool: db,
        tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add optional auth middleware to all routes
app.use(optionalAuth);

// Add auth routes
app.use('/', authRoutes);

// Add new feature routes AFTER session and auth setup
app.use('/api/nlp', nlpRoutes);
app.use('/api/esignature', esignatureRoutes);
app.use('/api/templates', templatesRoutes);

// Debug: Log registered routes
console.log('Registered API routes:');
console.log('- /api/nlp/*');
console.log('- /api/esignature/*');
console.log('- /api/templates/*');
//add

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Form types configuration
const FORM_TYPES = {
  business_formation: {
    name: 'Business Formation',
    description: 'LLC and Corporation formation documents',
    promptFile: 'prompts/business_formation.txt'
  },
  real_estate: {
    name: 'Real Estate',
    description: 'Purchase agreements, deeds, and property documents',
    promptFile: 'prompts/real_estate.txt'
  },
  family_law: {
    name: 'Family Law',
    description: 'Divorce, custody, and family-related documents',
    promptFile: 'prompts/family_law.txt'
  },
  estate_planning: {
    name: 'Estate Planning',
    description: 'Wills, trusts, and estate documents',
    promptFile: 'prompts/estate_planning.txt'
  },
  civil_litigation: {
    name: 'Civil Litigation',
    description: 'Complaints, motions, and litigation documents',
    promptFile: 'prompts/civil_litigation.txt'
  },
  employment_contracts: {
    name: 'Employment Contracts',
    description: 'Employment agreements and workplace documents',
    promptFile: 'prompts/employment_contracts.txt'
  },
  general_contracts: {
    name: 'General Contracts',
    description: 'Service agreements and commercial contracts',
    promptFile: 'prompts/general_contracts.txt'
  }
};

// Load prompt template for a specific form type
async function loadPrompt(formType) {
  try {
    const promptFile = FORM_TYPES[formType].promptFile;
    const promptPath = path.join(__dirname, promptFile);
    return await fs.readFile(promptPath, 'utf8');
  } catch (error) {
    console.error('Error loading prompt:', error);
    return null;
  }
}

// Load specific prompt based on document type
async function loadSpecificPrompt(specificType) {
  try {
    const promptPath = path.join(__dirname, `prompts/${specificType}.txt`);
    return await fs.readFile(promptPath, 'utf8');
  } catch (error) {
    console.error('Error loading specific prompt:', error);
    return null;
  }
}

// Generate legal document using OpenRouter AI
async function generateDocument(formType, userData, specificType = null) {
  // Debug environment variables
  console.log('Environment check:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
  console.log('OPENROUTER_API_KEY length:', process.env.OPENROUTER_API_KEY?.length);
  console.log('OPENROUTER_MODEL:', process.env.OPENROUTER_MODEL);
  
  // Check if API key is configured and clean
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY environment variable is not set or empty');
    console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('OPENROUTER')));
    throw new Error('AI service is not configured. Please contact support.');
  }

  // Validate API key format
  if (!apiKey.startsWith('sk-or-v1-')) {
    console.error('Invalid OpenRouter API key format. Key starts with:', apiKey.substring(0, 10));
    throw new Error('AI service configuration error. Please contact support.');
  }
  
  console.log('API key validation passed. Key starts with:', apiKey.substring(0, 10));

  let prompt;
  
  // Use specific prompt if available, otherwise fall back to general prompt
  if (specificType) {
    prompt = await loadSpecificPrompt(specificType);
  }
  
  if (!prompt) {
    prompt = await loadPrompt(formType);
  }
  
  if (!prompt) {
    throw new Error('Failed to load prompt template');
  }

  // Replace placeholders in prompt with actual user data
  let processedPrompt = prompt;
  Object.keys(userData).forEach(key => {
    const placeholder = `[${key.toUpperCase()}]`;
    processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), userData[key] || '');
  });

  // Combine processed prompt with user data
  const fullPrompt = `${processedPrompt}\n\nUSER PROVIDED INFORMATION:\n${JSON.stringify(userData, null, 2)}\n\nGenerate a complete, professional legal document based on the above information and template.`;

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': 'Legal Forms Generator'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating document:', error.response?.data || error.message);
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      throw new Error('AI service authentication failed. Please check your API key configuration.');
    } else if (error.response?.status === 429) {
      throw new Error('AI service is temporarily busy. Please try again in a moment.');
    } else if (error.response?.status >= 500) {
      throw new Error('AI service is temporarily unavailable. Please try again later.');
    } else {
      throw new Error('Failed to generate document using AI. Please try again.');
    }
  }
}

// Specific form types within each category
const getSpecificFormTypes = (formType) => {
  console.log('getSpecificFormTypes called with:', formType);
  
  const specificTypes = {
    business_formation: [
      { value: 'llc_articles', label: 'LLC Articles of Organization' },
      { value: 'corp_articles', label: 'Corporation Articles of Incorporation' },
      { value: 'llc_operating_agreement', label: 'LLC Operating Agreement' },
      { value: 'corp_bylaws', label: 'Corporate Bylaws' },
      { value: 'partnership_agreement', label: 'Partnership Agreement' },
      { value: 'dba_filing', label: 'DBA (Doing Business As) Filing' }
    ],
    real_estate: [
      { value: 'purchase_agreement', label: 'Real Estate Purchase Agreement' },
      { value: 'lease_agreement', label: 'Residential Lease Agreement' },
      { value: 'commercial_lease', label: 'Commercial Lease Agreement' },
      { value: 'deed_transfer', label: 'Property Deed Transfer' },
      { value: 'disclosure_form', label: 'Property Disclosure Form' },
      { value: 'listing_agreement', label: 'Real Estate Listing Agreement' },
      { value: 'rental_application', label: 'Rental Application' },
      { value: 'lease_termination', label: 'Lease Termination Notice' }
    ],
    family_law: [
      { value: 'divorce_petition', label: 'Divorce Petition' },
      { value: 'custody_agreement', label: 'Child Custody Agreement' },
      { value: 'support_order', label: 'Child Support Order' },
      { value: 'prenuptial_agreement', label: 'Prenuptial Agreement' },
      { value: 'adoption_petition', label: 'Adoption Petition' },
      { value: 'separation_agreement', label: 'Legal Separation Agreement' }
    ],
    estate_planning: [
      { value: 'last_will', label: 'Last Will and Testament' },
      { value: 'living_trust', label: 'Living Trust' },
      { value: 'power_of_attorney', label: 'Power of Attorney' },
      { value: 'healthcare_directive', label: 'Healthcare Directive' },
      { value: 'guardianship_nomination', label: 'Guardianship Nomination' },
      { value: 'beneficiary_designation', label: 'Beneficiary Designation' }
    ],
    civil_litigation: [
      { value: 'civil_complaint', label: 'Civil Complaint' },
      { value: 'motion_dismiss', label: 'Motion to Dismiss' },
      { value: 'discovery_request', label: 'Discovery Request' },
      { value: 'settlement_agreement', label: 'Settlement Agreement' },
      { value: 'subpoena', label: 'Subpoena' },
      { value: 'judgment_collection', label: 'Judgment Collection Documents' }
    ],
    employment_contracts: [
      { value: 'employment_agreement', label: 'Employment Agreement' },
      { value: 'nda_agreement', label: 'Non-Disclosure Agreement' },
      { value: 'noncompete_agreement', label: 'Non-Compete Agreement' },
      { value: 'severance_agreement', label: 'Severance Agreement' },
      { value: 'contractor_agreement', label: 'Independent Contractor Agreement' },
      { value: 'employee_handbook', label: 'Employee Handbook' }
    ],
    general_contracts: [
      { value: 'service_agreement', label: 'Service Agreement' },
      { value: 'purchase_contract', label: 'Purchase Contract' },
      { value: 'licensing_agreement', label: 'Licensing Agreement' },
      { value: 'vendor_contract', label: 'Vendor Contract' },
      { value: 'consulting_agreement', label: 'Consulting Agreement' },
      { value: 'partnership_contract', label: 'Partnership Contract' }
    ]
  };
  
  const result = specificTypes[formType] || [];
  console.log('Returning specific types for', formType, ':', result);
  return result;
};

// Form field configurations
const getFormFields = (formType, specificType) => {
  const baseFields = [
    { name: 'client_name', label: 'Full Legal Name', type: 'text', required: true },
    { name: 'client_address', label: 'Address', type: 'textarea', required: true },
    { name: 'client_phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'client_email', label: 'Email Address', type: 'email', required: true }
  ];

  const specificFields = {
    // Business Formation Fields
    llc_articles: [
      ...baseFields,
      { name: 'llc_name', label: 'LLC Name', type: 'text', required: true },
      { name: 'state_formation', label: 'State of Formation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'business_purpose', label: 'Business Purpose', type: 'textarea', required: true },
      { name: 'registered_agent', label: 'Registered Agent Name', type: 'text', required: true },
      { name: 'agent_address', label: 'Registered Agent Address', type: 'textarea', required: true },
      { name: 'management_type', label: 'Management Type', type: 'select', options: ['Member-Managed', 'Manager-Managed'], required: true }
    ],
    corp_articles: [
      ...baseFields,
      { name: 'corp_name', label: 'Corporation Name', type: 'text', required: true },
      { name: 'corp_type', label: 'Corporation Type', type: 'select', options: ['C-Corporation', 'S-Corporation', 'Professional Corporation'], required: true },
      { name: 'state_incorporation', label: 'State of Incorporation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'authorized_shares', label: 'Number of Authorized Shares', type: 'number', required: true },
      { name: 'par_value', label: 'Par Value per Share', type: 'number', required: true },
      { name: 'initial_directors', label: 'Initial Directors (Names)', type: 'textarea', required: true }
    ],
    llc_operating_agreement: [
      ...baseFields,
      { name: 'llc_name', label: 'LLC Name', type: 'text', required: true },
      { name: 'state_formation', label: 'State of Formation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'members_info', label: 'Members Information', type: 'textarea', required: true },
      { name: 'management_structure', label: 'Management Structure', type: 'select', options: ['Member-Managed', 'Manager-Managed'], required: true },
      { name: 'capital_contributions', label: 'Capital Contributions', type: 'textarea', required: true },
      { name: 'profit_distribution', label: 'Profit Distribution Method', type: 'textarea', required: true }
    ],
    corp_bylaws: [
      ...baseFields,
      { name: 'corp_name', label: 'Corporation Name', type: 'text', required: true },
      { name: 'state_incorporation', label: 'State of Incorporation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'board_size', label: 'Number of Directors', type: 'number', required: true },
      { name: 'meeting_frequency', label: 'Board Meeting Frequency', type: 'select', options: ['Monthly', 'Quarterly', 'Annually', 'As Needed'], required: true },
      { name: 'fiscal_year_end', label: 'Fiscal Year End', type: 'date', required: true },
      { name: 'stock_classes', label: 'Stock Classes', type: 'textarea', required: true }
    ],
    
    // Real Estate Fields
    purchase_agreement: [
      ...baseFields,
      { name: 'buyer_name', label: 'Buyer Full Name', type: 'text', required: true },
      { name: 'seller_name', label: 'Seller Full Name', type: 'text', required: true },
      { name: 'property_address', label: 'Property Address', type: 'textarea', required: true },
      { name: 'purchase_price', label: 'Purchase Price ($)', type: 'number', required: true },
      { name: 'earnest_money', label: 'Earnest Money Amount ($)', type: 'number', required: true },
      { name: 'closing_date', label: 'Proposed Closing Date', type: 'date', required: true },
      { name: 'financing_contingency', label: 'Financing Contingency Period (days)', type: 'number', required: true }
    ],
    lease_agreement: [
      ...baseFields,
      { name: 'landlord_name', label: 'Landlord Name', type: 'text', required: true },
      { name: 'tenant_name', label: 'Tenant Name', type: 'text', required: true },
      { name: 'property_address', label: 'Rental Property Address', type: 'textarea', required: true },
      { name: 'monthly_rent', label: 'Monthly Rent ($)', type: 'number', required: true },
      { name: 'security_deposit', label: 'Security Deposit ($)', type: 'number', required: true },
      { name: 'lease_start', label: 'Lease Start Date', type: 'date', required: true },
      { name: 'lease_end', label: 'Lease End Date', type: 'date', required: true }
    ],
    commercial_lease: [
      ...baseFields,
      { name: 'landlord_name', label: 'Landlord/Company Name', type: 'text', required: true },
      { name: 'tenant_name', label: 'Tenant/Business Name', type: 'text', required: true },
      { name: 'property_address', label: 'Commercial Property Address', type: 'textarea', required: true },
      { name: 'monthly_rent', label: 'Monthly Base Rent ($)', type: 'number', required: true },
      { name: 'square_footage', label: 'Square Footage', type: 'number', required: true },
      { name: 'lease_term', label: 'Lease Term (years)', type: 'number', required: true },
      { name: 'permitted_use', label: 'Permitted Use', type: 'textarea', required: true }
    ],
    
    // Family Law Fields
    divorce_petition: [
      ...baseFields,
      { name: 'petitioner_name', label: 'Petitioner Full Name', type: 'text', required: true },
      { name: 'respondent_name', label: 'Respondent Full Name', type: 'text', required: true },
      { name: 'marriage_date', label: 'Date of Marriage', type: 'date', required: true },
      { name: 'separation_date', label: 'Date of Separation', type: 'date', required: false },
      { name: 'children_info', label: 'Children Information (Names, Ages)', type: 'textarea', required: false },
      { name: 'grounds_divorce', label: 'Grounds for Divorce', type: 'select', options: ['Irreconcilable Differences', 'Adultery', 'Abandonment', 'Cruelty', 'Other'], required: true }
    ],
    
    // Estate Planning Fields
    last_will: [
      ...baseFields,
      { name: 'testator_name', label: 'Testator Full Name', type: 'text', required: true },
      { name: 'spouse_name', label: 'Spouse Name (if applicable)', type: 'text', required: false },
      { name: 'beneficiaries', label: 'Primary Beneficiaries', type: 'textarea', required: true },
      { name: 'executor_name', label: 'Executor Name', type: 'text', required: true },
      { name: 'guardian_minors', label: 'Guardian for Minor Children', type: 'text', required: false },
      { name: 'assets_description', label: 'Description of Major Assets', type: 'textarea', required: true }
    ],
    
    // Civil Litigation Fields
    civil_complaint: [
      ...baseFields,
      { name: 'plaintiff_name', label: 'Plaintiff Name', type: 'text', required: true },
      { name: 'defendant_name', label: 'Defendant Name', type: 'text', required: true },
      { name: 'case_description', label: 'Case Description', type: 'textarea', required: true },
      { name: 'damages_amount', label: 'Damages Sought ($)', type: 'number', required: true },
      { name: 'court_jurisdiction', label: 'Court Jurisdiction', type: 'text', required: true },
      { name: 'incident_date', label: 'Date of Incident', type: 'date', required: true }
    ],
    motion_dismiss: [
      ...baseFields,
      { name: 'case_number', label: 'Case Number', type: 'text', required: true },
      { name: 'court_name', label: 'Court Name', type: 'text', required: true },
      { name: 'moving_party', label: 'Moving Party', type: 'text', required: true },
      { name: 'grounds_dismissal', label: 'Grounds for Dismissal', type: 'textarea', required: true },
      { name: 'legal_authority', label: 'Legal Authority/Citations', type: 'textarea', required: true }
    ],
    settlement_agreement: [
      ...baseFields,
      { name: 'party1_name', label: 'First Party Name', type: 'text', required: true },
      { name: 'party2_name', label: 'Second Party Name', type: 'text', required: true },
      { name: 'dispute_description', label: 'Dispute Description', type: 'textarea', required: true },
      { name: 'settlement_amount', label: 'Settlement Amount ($)', type: 'number', required: true },
      { name: 'payment_terms', label: 'Payment Terms', type: 'textarea', required: true },
      { name: 'release_scope', label: 'Scope of Release', type: 'textarea', required: true }
    ],
    
    // Employment Contract Fields
    employment_agreement: [
      ...baseFields,
      { name: 'employer_name', label: 'Employer/Company Name', type: 'text', required: true },
      { name: 'employee_name', label: 'Employee Name', type: 'text', required: true },
      { name: 'position_title', label: 'Position Title', type: 'text', required: true },
      { name: 'salary', label: 'Annual Salary ($)', type: 'number', required: true },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true },
      { name: 'job_duties', label: 'Job Duties and Responsibilities', type: 'textarea', required: true }
    ],
    nda_agreement: [
      ...baseFields,
      { name: 'disclosing_party', label: 'Disclosing Party Name', type: 'text', required: true },
      { name: 'receiving_party', label: 'Receiving Party Name', type: 'text', required: true },
      { name: 'confidential_info', label: 'Description of Confidential Information', type: 'textarea', required: true },
      { name: 'agreement_term', label: 'Agreement Term (years)', type: 'number', required: true },
      { name: 'permitted_use', label: 'Permitted Use of Information', type: 'textarea', required: true }
    ],
    noncompete_agreement: [
      ...baseFields,
      { name: 'employer_name', label: 'Employer Name', type: 'text', required: true },
      { name: 'employee_name', label: 'Employee Name', type: 'text', required: true },
      { name: 'restricted_activities', label: 'Restricted Activities', type: 'textarea', required: true },
      { name: 'geographic_scope', label: 'Geographic Scope', type: 'text', required: true },
      { name: 'time_period', label: 'Time Period (months)', type: 'number', required: true },
      { name: 'consideration', label: 'Consideration Provided', type: 'textarea', required: true }
    ],
    
    // General Contract Fields
    service_agreement: [
      ...baseFields,
      { name: 'service_provider', label: 'Service Provider Name', type: 'text', required: true },
      { name: 'client_company', label: 'Client/Company Name', type: 'text', required: true },
      { name: 'service_description', label: 'Service Description', type: 'textarea', required: true },
      { name: 'contract_value', label: 'Contract Value ($)', type: 'number', required: true },
      { name: 'start_date', label: 'Service Start Date', type: 'date', required: true },
      { name: 'end_date', label: 'Service End Date', type: 'date', required: true }
    ]
  };

  // Return specific fields if available, otherwise return base fields
  return specificFields[specificType] || baseFields;
};

// Legacy function for backward compatibility
const getLegacyFormFields = (formType) => {
  const formFields = {
    business_formation: [
      { name: 'client_name', label: 'Full Legal Name', type: 'text', required: true },
      { name: 'client_address', label: 'Address', type: 'textarea', required: true },
      { name: 'client_phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'client_email', label: 'Email Address', type: 'email', required: true },
      { name: 'entity_type', label: 'Entity Type', type: 'select', options: ['LLC', 'Corporation'], required: true },
      { name: 'entity_name', label: 'Proposed Entity Name', type: 'text', required: true },
      { name: 'state_formation', label: 'State of Formation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'Other'], required: true },
      { name: 'business_purpose', label: 'Business Purpose', type: 'textarea', required: true }
    ],
    real_estate: [
      { name: 'buyer_name', label: 'Buyer Full Name', type: 'text', required: true },
      { name: 'seller_name', label: 'Seller Full Name', type: 'text', required: true },
      { name: 'property_address', label: 'Property Address', type: 'textarea', required: true },
      { name: 'purchase_price', label: 'Purchase Price', type: 'number', required: true },
      { name: 'earnest_money', label: 'Earnest Money Amount', type: 'number', required: true },
      { name: 'closing_date', label: 'Proposed Closing Date', type: 'date', required: true },
      { name: 'property_type', label: 'Property Type', type: 'select', options: ['Single Family', 'Condo', 'Commercial', 'Vacant Land'], required: true }
    ],
    family_law: [
      { name: 'petitioner_name', label: 'Petitioner Full Name', type: 'text', required: true },
      { name: 'respondent_name', label: 'Respondent Full Name', type: 'text', required: true },
      { name: 'marriage_date', label: 'Date of Marriage', type: 'date', required: true },
      { name: 'separation_date', label: 'Date of Separation', type: 'date', required: false },
      { name: 'children_names', label: 'Children Names and Ages', type: 'textarea', required: false },
      { name: 'grounds_divorce', label: 'Grounds for Divorce', type: 'select', options: ['Irreconcilable Differences', 'Adultery', 'Abandonment', 'Other'], required: true }
    ],
    estate_planning: [
      { name: 'testator_name', label: 'Testator Full Name', type: 'text', required: true },
      { name: 'testator_address', label: 'Testator Address', type: 'textarea', required: true },
      { name: 'spouse_name', label: 'Spouse Name (if applicable)', type: 'text', required: false },
      { name: 'beneficiaries', label: 'Primary Beneficiaries', type: 'textarea', required: true },
      { name: 'executor_name', label: 'Executor Name', type: 'text', required: true },
      { name: 'assets_description', label: 'Description of Assets', type: 'textarea', required: true }
    ],
    civil_litigation: [
      { name: 'plaintiff_name', label: 'Plaintiff Name', type: 'text', required: true },
      { name: 'defendant_name', label: 'Defendant Name', type: 'text', required: true },
      { name: 'case_description', label: 'Case Description', type: 'textarea', required: true },
      { name: 'damages_amount', label: 'Damages Sought', type: 'number', required: true },
      { name: 'court_jurisdiction', label: 'Court Jurisdiction', type: 'text', required: true },
      { name: 'incident_date', label: 'Date of Incident', type: 'date', required: true }
    ],
    employment_contracts: [
      { name: 'employer_name', label: 'Employer Name', type: 'text', required: true },
      { name: 'employee_name', label: 'Employee Name', type: 'text', required: true },
      { name: 'position_title', label: 'Position Title', type: 'text', required: true },
      { name: 'salary', label: 'Annual Salary', type: 'number', required: true },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true },
      { name: 'job_duties', label: 'Job Duties', type: 'textarea', required: true }
    ],
    general_contracts: [
      { name: 'party1_name', label: 'First Party Name', type: 'text', required: true },
      { name: 'party2_name', label: 'Second Party Name', type: 'text', required: true },
      { name: 'contract_subject', label: 'Contract Subject Matter', type: 'textarea', required: true },
      { name: 'contract_value', label: 'Contract Value', type: 'number', required: true },
      { name: 'effective_date', label: 'Effective Date', type: 'date', required: true },
      { name: 'terms_conditions', label: 'Key Terms and Conditions', type: 'textarea', required: true }
    ]
  };

  return formFields[formType] || [];
};

// SEO helper function to generate page metadata
function generatePageMeta(page, formType = null) {
  const baseUrl = process.env.SITE_URL || 'https://legalaiforms.com';
  
  const pageMeta = {
    home: {
      title: 'Legal Forms Generator - AI-Powered Legal Documents | LegalFormsAI',
      description: 'Generate professional legal documents instantly with AI. Business formation, real estate contracts, family law, estate planning & more. Trusted by 10,000+ users.',
      keywords: 'legal forms generator, AI legal documents, business formation documents, real estate contracts, family law forms, estate planning documents',
      canonical: baseUrl + '/'
    },
    business_formation: {
      title: 'Business Formation Documents - LLC & Corporation Forms | LegalFormsAI',
      description: 'Create LLC articles, corporation bylaws, operating agreements & more. AI-generated business formation documents with state-specific compliance.',
      keywords: 'LLC formation, corporation documents, business formation, articles of incorporation, operating agreement, business bylaws',
      canonical: baseUrl + '/form/business_formation'
    },
    real_estate: {
      title: 'Real Estate Legal Forms - Purchase Agreements & Contracts | LegalFormsAI',
      description: 'Generate real estate purchase agreements, lease contracts, property deeds & disclosure forms. Professional real estate legal documents.',
      keywords: 'real estate contracts, purchase agreement, lease agreement, property deed, real estate forms',
      canonical: baseUrl + '/form/real_estate'
    },
    family_law: {
      title: 'Family Law Documents - Divorce, Custody & Legal Forms | LegalFormsAI',
      description: 'Create divorce petitions, custody agreements, prenuptial agreements & family law documents. State-compliant family legal forms.',
      keywords: 'divorce petition, custody agreement, family law forms, prenuptial agreement, legal separation',
      canonical: baseUrl + '/form/family_law'
    },
    estate_planning: {
      title: 'Estate Planning Documents - Wills, Trusts & Legal Forms | LegalFormsAI',
      description: 'Generate last wills, living trusts, power of attorney & healthcare directives. Professional estate planning legal documents.',
      keywords: 'last will testament, living trust, power of attorney, estate planning, healthcare directive',
      canonical: baseUrl + '/form/estate_planning'
    },
    contact: {
      title: 'Contact LegalFormsAI - Legal Document Generation Support',
      description: 'Contact our legal document generation experts. Get help with AI-powered legal forms, business documents, and professional legal templates.',
      keywords: 'legal forms support, contact legal AI, legal document help',
      canonical: baseUrl + '/contact'
    }
  };
  
  return pageMeta[formType || page] || pageMeta.home;
}

// Routes
app.get('/', (req, res) => {
  const meta = generatePageMeta('home');
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "LegalFormsAI",
    "url": "https://legalaiforms.com",
    "description": "Professional AI-powered legal document generation platform",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://legalaiforms.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };
  
  res.render('index', { 
    formTypes: FORM_TYPES,
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    canonical: meta.canonical,
    structuredData: structuredData,
    req: req
  });
});

app.get('/home', (req, res) => {
  res.redirect('/');
});

app.get('/services', (req, res) => {
  res.render('index', { 
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Services'
  });
});

app.get('/features', (req, res) => {
  res.render('index', { 
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Features'
  });
});

app.get('/about', (req, res) => {
  res.render('about', { 
    title: 'About LegalFormsAI - Professional Legal Document Generation',
    description: 'Learn about LegalFormsAI\'s mission to democratize legal document creation through AI technology. Trusted by attorneys, businesses, and individuals nationwide.',
    keywords: 'about legal forms AI, legal document automation, AI legal technology, professional legal services',
    canonical: process.env.SITE_URL + '/about' || 'https://legalaiforms.com/about',
    req: req
  });
});

app.get('/faq', (req, res) => {
  res.render('faq', { 
    title: 'FAQ - Legal Forms Generator | LegalFormsAI',
    description: 'Frequently asked questions about LegalFormsAI\'s legal document generation service. Get answers about pricing, legal compliance, document formats, and more.',
    keywords: 'legal forms FAQ, legal document questions, AI legal help, legal template questions',
    canonical: process.env.SITE_URL + '/faq' || 'https://legalaiforms.com/faq',
    req: req
  });
});

app.get('/contact', (req, res) => {
  const meta = generatePageMeta('contact');
  res.render('contact', { 
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    canonical: meta.canonical,
    req: req
  });
});

// Legal pages routes
app.get('/privacy', (req, res) => {
  res.render('privacy', { 
    title: 'Privacy Policy - LegalFormsAI',
    description: 'LegalFormsAI Privacy Policy - Learn how we collect, use, and protect your personal information when using our legal document generation service.',
    keywords: 'privacy policy, data protection, legal forms privacy, personal information',
    canonical: process.env.SITE_URL + '/privacy' || 'https://legalaiforms.com/privacy',
    req: req
  });
});

app.get('/terms', (req, res) => {
  res.render('terms', { 
    title: 'Terms of Service - LegalFormsAI',
    description: 'LegalFormsAI Terms of Service - Read our terms and conditions for using our AI-powered legal document generation platform.',
    keywords: 'terms of service, terms and conditions, legal forms terms, user agreement',
    canonical: process.env.SITE_URL + '/terms' || 'https://legalaiforms.com/terms',
    req: req
  });
});

app.get('/disclaimer', (req, res) => {
  res.render('disclaimer', { 
    title: 'Legal Disclaimer - LegalFormsAI',
    description: 'LegalFormsAI Legal Disclaimer - Important information about the limitations and proper use of our legal document generation service.',
    keywords: 'legal disclaimer, limitations, legal advice disclaimer, document templates',
    canonical: process.env.SITE_URL + '/disclaimer' || 'https://legalaiforms.com/disclaimer',
    req: req
  });
});

app.get('/cookies', (req, res) => {
  res.render('cookies', { 
    title: 'Cookie Policy - LegalFormsAI',
    description: 'LegalFormsAI Cookie Policy - Learn about how we use cookies and similar technologies to improve your experience on our website.',
    keywords: 'cookie policy, cookies, tracking, website analytics, user experience',
    canonical: process.env.SITE_URL + '/cookies' || 'https://legalaiforms.com/cookies',
    req: req
  });
});

// SEO Routes
app.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = new SitemapStream({ hostname: process.env.SITE_URL || 'https://legalaiforms.com' });
    
    // Add static pages
    sitemap.write({ url: '/', changefreq: 'weekly', priority: 1.0 });
    sitemap.write({ url: '/about', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/faq', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/contact', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/privacy', changefreq: 'yearly', priority: 0.6 });
    sitemap.write({ url: '/terms', changefreq: 'yearly', priority: 0.6 });
    sitemap.write({ url: '/disclaimer', changefreq: 'yearly', priority: 0.6 });
    sitemap.write({ url: '/cookies', changefreq: 'yearly', priority: 0.6 });
    
    // Add form pages
    Object.keys(FORM_TYPES).forEach(formType => {
      sitemap.write({ 
        url: `/form/${formType}`, 
        changefreq: 'monthly', 
        priority: 0.9 
      });
    });
    
    sitemap.end();
    
    const sitemapXML = await streamToPromise(sitemap);
    res.header('Content-Type', 'application/xml');
    res.send(sitemapXML.toString());
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

app.get('/robots.txt', (req, res) => {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /uploads/
Disallow: /api/
Disallow: /download/

Sitemap: ${process.env.SITE_URL || 'https://legalaiforms.com'}/sitemap.xml`;
  
  res.type('text/plain');
  res.send(robotsTxt);
});

app.get('/form/:formType', (req, res) => {
  const formType = req.params.formType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(404).render('404');
  }

  const formConfig = FORM_TYPES[formType];
  const meta = generatePageMeta('form', formType);
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": formConfig.name,
    "description": formConfig.description,
    "provider": {
      "@type": "Organization",
      "name": "LegalFormsAI"
    },
    "serviceType": "Legal Document Generation",
    "areaServed": "United States"
  };
  
  res.render('form', { 
    formType, 
    formConfig,
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    canonical: meta.canonical,
    structuredData: structuredData,
    req: req
  });
});

// Clean document content for different formats
function cleanDocumentContent(content, format) {
  let cleanedContent = content;
  
  if (format === 'pdf' || format === 'docx') {
    // Remove markdown-style formatting for professional documents while preserving line breaks
    
    // Convert **text** to plain text but preserve the content structure
    cleanedContent = cleanedContent.replace(/\*\*(.*?)\*\*/g, '$1');
    
    // Remove ### headers but keep the text and add line break after
    cleanedContent = cleanedContent.replace(/^### (.*$)/gm, '$1\n');
    cleanedContent = cleanedContent.replace(/^## (.*$)/gm, '$1\n');
    cleanedContent = cleanedContent.replace(/^# (.*$)/gm, '$1\n');
    
    // Convert horizontal rules (---) to line breaks
    cleanedContent = cleanedContent.replace(/^---+$/gm, '\n');
    
    // Preserve important line breaks - add extra line break after colons and important sections
    cleanedContent = cleanedContent.replace(/^(.*?:)\s*$/gm, '$1\n');
    
    // Clean up excessive whitespace but preserve intentional spacing
    cleanedContent = cleanedContent.replace(/\n\n\n+/g, '\n\n');
    cleanedContent = cleanedContent.trim();
  }
  
  return cleanedContent;
}

// Convert content to HTML with proper formatting
function convertToHTML(content) {
  let htmlContent = content;
  
  // Convert **text** to <strong>text</strong>
  htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert ### to h3, ## to h2, # to h1 with proper spacing
  htmlContent = htmlContent.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  htmlContent = htmlContent.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  htmlContent = htmlContent.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Convert --- to horizontal rules
  htmlContent = htmlContent.replace(/^---+$/gm, '<hr>');
  
  // Handle multi-line field values (like addresses) - process before single line fields
  // Look for pattern: Label:\nValue1\nValue2\n etc.
  htmlContent = htmlContent.replace(/^([A-Z][^:]*:)\s*\n((?:(?!^[A-Z][^:]*:)[^\n]+\n?)+)/gm, function(match, label, value) {
    const cleanValue = value.trim().replace(/\n/g, '<br>');
    return `<p class="field-line"><strong>${label}</strong><br>${cleanValue}</p>`;
  });
  
  // Handle single-line field values (like "Phone: (804) 360-1129")
  htmlContent = htmlContent.replace(/^([A-Z][^:]*:)\s*(.+)$/gm, '<p class="field-line"><strong>$1</strong> $2</p>');
  
  // Handle labels without values (like "Address:" on its own line) - only if not already processed
  htmlContent = htmlContent.replace(/^([A-Z][^:]*:)\s*$/gm, '<p class="field-label"><strong>$1</strong></p>');
  
  // Convert double line breaks to paragraph breaks
  htmlContent = htmlContent.replace(/\n\n/g, '</p><p>');
  
  // Convert remaining single line breaks to <br> tags
  htmlContent = htmlContent.replace(/\n/g, '<br>');
  
  // Wrap remaining content in paragraphs
  htmlContent = '<p>' + htmlContent + '</p>';
  
  // Clean up empty paragraphs and fix nested tags
  htmlContent = htmlContent.replace(/<p><\/p>/g, '');
  htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, '');
  htmlContent = htmlContent.replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1');
  htmlContent = htmlContent.replace(/<p>(<hr>)<\/p>/g, '$1');
  htmlContent = htmlContent.replace(/<p>(<p class="field-line">.*?<\/p>)<\/p>/g, '$1');
  htmlContent = htmlContent.replace(/<p>(<p class="field-label">.*?<\/p>)<\/p>/g, '$1');
  
  return htmlContent;
}

// Modified generatePDF function that saves to file AND returns filename
async function generatePDF(content, filename) {
  const cleanedContent = cleanDocumentContent(content, 'pdf');
  const htmlFormattedContent = convertToHTML(cleanedContent);
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Legal Document</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1, h2, h3 { color: #333; margin-top: 30px; }
        p { margin-bottom: 15px; }
        .signature-line { border-bottom: 1px solid #000; width: 300px; margin: 20px 0; }
      </style>
    </head>
    <body>
      ${htmlFormattedContent}
      <div style="margin-top: 50px;">
        <p><strong>Signature:</strong></p>
        <div class="signature-line"></div>
        <p>Date: _______________</p>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    
    // Fix: Use only the filename, not full path
    const safeFilename = path.basename(filename);
    const fullPath = path.join(__dirname, 'uploads', safeFilename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write the PDF buffer to file
    await fs.writeFile(fullPath, pdfBuffer);
    
    return fullPath;
    
  } finally {
    await browser.close();
  }
}


// Endpoint that works with file-based approach
app.post('/generate-pdf', async (req, res) => {
  try {
    const filename = `${formType}_${Date.now()}.pdf`;
    const filePath = await generatePDF(documentContent, filename);
    
    // Send file and optionally clean up
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Optionally delete file after sending
      // fs.unlink(filePath).catch(console.error);
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF document' });
  }
});


async function generateWord(content, filename) {
  return new Promise((resolve, reject) => {
    const docx = officegen('docx');
    
    // Add document properties
    docx.setDocTitle('Legal Document');
    docx.setDocSubject('Generated Legal Document');
    docx.setDocKeywords('legal, document, generated');
    
    // Clean the content for Word format
    const cleanedContent = cleanDocumentContent(content, 'docx');
    
    // Split content into lines and process formatting
    const lines = cleanedContent.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        // Add empty paragraph for spacing
        docx.createP();
      } else if (trimmedLine.startsWith('# ')) {
        // Main heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(2), { bold: true, font_size: 16 });
        heading.options.align = 'center';
        // Add spacing after heading
        docx.createP();
      } else if (trimmedLine.startsWith('## ')) {
        // Sub heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(3), { bold: true, font_size: 14 });
        // Add spacing after heading
        docx.createP();
      } else if (trimmedLine.startsWith('### ')) {
        // Sub-sub heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(4), { bold: true, font_size: 12 });
        // Add spacing after heading
        docx.createP();
      } else if (trimmedLine.includes(':') && !trimmedLine.includes('**')) {
        // Handle field labels (like "Organizer: Name")
        const colonIndex = trimmedLine.indexOf(':');
        const label = trimmedLine.substring(0, colonIndex + 1);
        const value = trimmedLine.substring(colonIndex + 1).trim();
        
        const paragraph = docx.createP();
        paragraph.addText(label, { bold: true });
        if (value) {
          paragraph.addText(' ' + value);
        }
        // Add line break after field
        docx.createP();
      } else {
        // Regular paragraph
        const paragraph = docx.createP();
        
        // Handle bold text within paragraphs
        if (trimmedLine.includes('**')) {
          const parts = trimmedLine.split(/(\*\*.*?\*\*)/);
          parts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              paragraph.addText(part.slice(2, -2), { bold: true });
            } else {
              paragraph.addText(part);
            }
          });
        } else {
          paragraph.addText(trimmedLine);
        }
      }
    });
    
    // Add signature section
    docx.createP();
    docx.createP();
    const sigLine = docx.createP();
    sigLine.addText('_'.repeat(50));
    const sigLabel = docx.createP();
    sigLabel.addText('Signature');
    docx.createP();
    const dateLine = docx.createP();
    dateLine.addText('Date: _________________');
    
    // Generate the document
    const output = require('fs').createWriteStream(filename);
    docx.generate(output);
    
    output.on('close', () => {
      resolve(filename);
    });
    
    output.on('error', (err) => {
      reject(err);
    });
  });
}

// Enhanced document generation with compliance checking and review
app.post('/generate', validateCompliance, async (req, res) => {
  try {
    const { form_type: formType, specific_type: specificType, form_data: userData, format = 'txt' } = req.body;

    if (!FORM_TYPES[formType]) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    // Validate format
    const allowedFormats = ['txt', 'pdf', 'docx'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid document format' });
    }

    // Check compliance validation results
    if (req.complianceValidation && !req.complianceValidation.isCompliant) {
      const highSeverityIssues = req.complianceValidation.issues.filter(issue => issue.severity === 'high');
      if (highSeverityIssues.length > 0) {
        return res.status(400).json({ 
          error: 'Compliance issues must be resolved before generating document',
          complianceIssues: req.complianceValidation.issues,
          suggestions: req.complianceValidation.suggestions
        });
      }
    }

    // Validate required fields based on specific type
    const requiredFields = specificType ? 
      getFormFields(formType, specificType).filter(field => field.required) :
      getLegacyFormFields(formType).filter(field => field.required);
    
    const missingFields = requiredFields.filter(field => !userData[field.name] || userData[field.name].trim() === '');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.map(f => f.label).join(', ')}` 
      });
    }

    // Generate the document with specific type information
    const document = await generateDocument(formType, userData, specificType);

    // Save generated document in requested format
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const documentType = specificType || formType;
    const baseFilename = `${documentType}_${timestamp}`;
    
    let filename, filepath;
    
    switch (format) {
      case 'pdf':
        filename = `${baseFilename}.pdf`;
        await generatePDF(document, filename );
        break;
        
      case 'docx':
        filename = `${baseFilename}.docx`;
        filepath = path.join(uploadDir, filename);
        await generateWord(document, filepath);
        break;
        
      default: // txt
        filename = `${baseFilename}.txt`;
        filepath = path.join(uploadDir, filename);
        // For text format, keep the original formatting
        await fs.writeFile(filepath, document, 'utf8');
        break;
    }

    // Save to database if user is authenticated
    let documentId = null;
    if (req.user) {
      const docResult = await db.query(`
        INSERT INTO document_history (user_id, document_type, specific_type, title, content, form_data, file_format, file_path)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        req.user.id,
        formType,
        specificType,
        `${documentType}_${timestamp}`,
        document,
        JSON.stringify(userData),
        format,
        filename
      ]);
      documentId = docResult.rows[0].id;
    }

    // Perform automated review
    const reviewResults = await performDocumentReview(document, formType, userData);
    
    // Save review results if document was saved
    if (documentId && reviewResults) {
      await db.query(`
        INSERT INTO document_reviews (document_id, review_type, issues_found, suggestions, overall_score)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        documentId,
        'automated_review',
        JSON.stringify(reviewResults.issues),
        JSON.stringify(reviewResults.suggestions),
        reviewResults.score
      ]);
    }

    res.json({
      success: true,
      document: document,
      filename: filename,
      format: format,
      documentId: documentId,
      complianceValidation: req.complianceValidation,
      reviewResults: reviewResults
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: 'Failed to generate document. Please try again.' });
  }
});

app.post('/contact', (req, res) => {
  try {
    const { firstName, lastName, email, phone, subject, message } = req.body;
    
    // In a real application, you would send an email or save to database
    console.log('Contact form submission:', { firstName, lastName, email, phone, subject, message });
    
    res.json({ success: true, message: 'Thank you for your message! We will get back to you soon.' });
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, filename);
    
    // Check if file exists
    await fs.access(filepath);
    
    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(filepath);
  } catch (error) {
    res.status(404).send('File not found');
  }
});

app.get('/api/form-types/:formType', (req, res) => {
  const formType = req.params.formType;
  console.log('API request for form types:', formType);
  console.log('Available form types:', Object.keys(FORM_TYPES));
  
  if (!FORM_TYPES[formType]) {
    console.log('Invalid form type:', formType);
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const specificTypes = getSpecificFormTypes(formType);
    console.log('Returning specific types for', formType, ':', specificTypes);
    console.log('Number of types:', specificTypes.length);
    
    // Ensure we return a proper JSON response with CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(specificTypes);
  } catch (error) {
    console.error('Error getting specific types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint to verify API is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    timestamp: new Date().toISOString(),
    formTypes: Object.keys(FORM_TYPES),
    envCheck: {
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      keyLength: process.env.OPENROUTER_API_KEY?.length || 0,
      model: process.env.OPENROUTER_MODEL || 'not set',
      nodeEnv: process.env.NODE_ENV || 'not set'
    }
  });
});

app.get('/api/form-fields/:formType/:specificType?', (req, res) => {
  const formType = req.params.formType;
  const specificType = req.params.specificType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  const fields = specificType ? getFormFields(formType, specificType) : getLegacyFormFields(formType);
  res.setHeader('Content-Type', 'application/json');
  res.json(fields);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Real-time compliance checking endpoint
app.post('/api/compliance/validate', async (req, res) => {
  try {
    const { form_type, field_name, value, jurisdiction = 'US' } = req.body;
    
    const validation = complianceChecker.validateField(form_type, field_name, value, jurisdiction);
    
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('Compliance validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// Automated document review function
async function performDocumentReview(document, formType, userData) {
  try {
    const issues = [];
    const suggestions = [];
    let score = 1.0;

    // Check for missing critical information
    const criticalFields = ['client_name', 'client_address'];
    criticalFields.forEach(field => {
      if (!userData[field] || userData[field].trim() === '') {
        issues.push({
          type: 'missing_info',
          severity: 'high',
          field: field,
          message: `Missing critical information: ${field}`
        });
        score -= 0.2;
      }
    });

    // Check document length (too short might indicate incomplete generation)
    if (document.length < 500) {
      issues.push({
        type: 'completeness',
        severity: 'medium',
        message: 'Document appears to be unusually short'
      });
      score -= 0.1;
    }

    // Check for placeholder text that wasn't replaced
    const placeholders = document.match(/\[.*?\]/g);
    if (placeholders && placeholders.length > 0) {
      issues.push({
        type: 'incomplete_generation',
        severity: 'high',
        message: `Document contains unreplaced placeholders: ${placeholders.join(', ')}`
      });
      score -= 0.3;
    }

    // AI-powered risk assessment
    try {
      const riskPrompt = `
Review this legal document for potential risks or issues:

${document.substring(0, 2000)}...

Identify any:
1. Ambiguous language
2. Missing standard clauses
3. Potential legal risks
4. Inconsistencies

Return a JSON object with "risks" array and "suggestions" array.`;

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: riskPrompt }],
        max_tokens: 1000,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      let aiResponseContent = response.data.choices[0].message.content;
      console.log (` aiResponseConten: ${aiResponseContent}`)
      
      // Remove markdown code blocks if present
      if (aiResponseContent.includes('```json')) {
        aiResponseContent = aiResponseContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (aiResponseContent.includes('```')) {
        aiResponseContent = aiResponseContent.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      const aiReview = JSON.parse(aiResponseContent.trim());
      if (aiReview.risks) {
        issues.push(...aiReview.risks.map(risk => ({
          type: 'ai_risk_assessment',
          severity: 'medium',
          message: risk
        })));
      }
      if (aiReview.suggestions) {
        suggestions.push(...aiReview.suggestions);
      }
    } catch (error) {
      console.error('AI review error:', error);
    }

    return {
      issues,
      suggestions,
      score: Math.max(score, 0)
    };
  } catch (error) {
    console.error('Document review error:', error);
    return null;
  }
}

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected for real-time features');
  
  // Real-time compliance checking
  socket.on('validate_field', async (data) => {
    try {
      const { form_type, field_name, value, jurisdiction } = data;
      const validation = complianceChecker.validateField(form_type, field_name, value, jurisdiction);
      socket.emit('validation_result', { field_name, ...validation });
    } catch (error) {
      socket.emit('validation_error', { field_name: data.field_name, error: 'Validation failed' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Legal Forms Generator server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
  console.log('Real-time features enabled via Socket.io');
});

module.exports = app;
