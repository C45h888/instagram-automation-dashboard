// backend/routes/legal.js
const express = require('express');
const router = express.Router();

// Import legal content (you'll need to convert the TypeScript to JavaScript or use a build process)
// For now, we'll define it directly here for the backend
const LEGAL_CONTENT = {
  privacyPolicy: {
    version: "2.0",
    effectiveDate: "2025-01-01",
    lastUpdated: "2025-01-01",
    metaComplianceDate: "2025-02-03",
    title: "Privacy Policy - Instagram Automation Platform"
  },
  termsOfService: {
    version: "2.0",
    effectiveDate: "2025-01-01",
    lastUpdated: "2025-01-01",
    title: "Terms and Conditions - Instagram Automation Platform"
  },
  dataDeletion: {
    version: "2.0",
    effectiveDate: "2025-01-01",
    lastUpdated: "2025-01-01",
    title: "Data Deletion Policy - Instagram Automation Platform"
  }
};

// Helper function to generate HTML for Meta crawlers
const generateLegalHTML = (type, content) => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": type === 'privacy' ? "PrivacyPolicy" : "TermsOfService",
    "name": content.title,
    "publisher": {
      "@type": "Organization",
      "name": "888 Intelligence Automation",
      "url": "https://888intelligenceautomation.in"
    },
    "datePublished": content.effectiveDate,
    "dateModified": content.lastUpdated,
    "inLanguage": "en-US",
    "isAccessibleForFree": true
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title} | 888 Intelligence Automation</title>
    <meta name="description" content="Meta Platform Terms compliant privacy policy for Instagram automation services. Effective ${content.effectiveDate}.">
    
    <!-- Open Graph Meta Tags for Meta/Facebook -->
    <meta property="og:title" content="${content.title}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://instagram-backend.888intelligenceautomation.in/legal/${type}">
    <meta property="og:description" content="Comprehensive ${type} policy covering Instagram API usage, data processing, and user rights.">
    <meta property="og:site_name" content="888 Intelligence Automation">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${content.title}">
    <meta name="twitter:description" content="Meta compliant ${type} policy for Instagram automation platform.">
    
    <!-- Structured Data for Search Engines -->
    <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
    </script>
    
    <!-- Robots Meta Tag -->
    <meta name="robots" content="index, follow">
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
        }
        header {
            background: linear-gradient(to right, #1a202c, #2d3748);
            color: white;
            padding: 2rem;
            margin: -20px -20px 30px -20px;
        }
        h1 {
            margin: 0;
            font-size: 2rem;
        }
        .meta-info {
            margin-top: 1rem;
            opacity: 0.9;
            font-size: 0.9rem;
        }
        .content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .section {
            margin-bottom: 2rem;
        }
        .contact-info {
            background: #f7fafc;
            padding: 1.5rem;
            border-radius: 8px;
            margin-top: 2rem;
        }
        a {
            color: #3b82f6;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <header>
        <h1>${content.title}</h1>
        <div class="meta-info">
            <p>Version: ${content.version} | Effective Date: ${content.effectiveDate}</p>
            <p>Meta Platform Compliance: ${content.metaComplianceDate || 'February 3, 2025'}</p>
        </div>
    </header>
    
    <main class="content">
        <section class="section">
            <h2>Overview</h2>
            <p>This ${type} policy is maintained by 888 Intelligence Automation for our Instagram Business Automation Platform. 
            We are committed to protecting your privacy and ensuring compliance with all applicable data protection laws including GDPR, CCPA, and Meta Platform Terms.</p>
        </section>
        
        <section class="section">
            <h2>Key Information</h2>
            <ul>
                <li><strong>Service Provider:</strong> 888 Intelligence Automation</li>
                <li><strong>Service:</strong> Instagram Business Automation Platform</li>
                <li><strong>Data Processing:</strong> Instagram Graph API Integration</li>
                <li><strong>Security:</strong> Cloudflare Tunnel + Supabase Encryption</li>
                <li><strong>Compliance:</strong> GDPR, CCPA, Meta Platform Terms</li>
            </ul>
        </section>
        
        <section class="section">
            <h2>Full Policy Document</h2>
            <p>For the complete ${type} policy, please visit our application at:</p>
            <p><a href="https://instagram-backend.888intelligenceautomation.in/${type === 'privacy' ? 'privacy-policy' : type === 'terms' ? 'terms-of-service' : 'data-deletion'}">
                View Full ${content.title}
            </a></p>
        </section>
        
        <section class="section contact-info">
            <h2>Contact Information</h2>
            <p><strong>Data Protection Officer:</strong> <a href="mailto:privacy@888intelligenceautomation.in">privacy@888intelligenceautomation.in</a></p>
            <p><strong>Legal Department:</strong> <a href="mailto:legal@888intelligenceautomation.in">legal@888intelligenceautomation.in</a></p>
            <p><strong>General Support:</strong> <a href="mailto:support@888intelligenceautomation.in">support@888intelligenceautomation.in</a></p>
        </section>
    </main>
</body>
</html>
  `;
};

// Privacy Policy Route
router.get('/privacy-policy', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMetaCrawler = /facebookexternalhit|Facebot/i.test(userAgent);
  
  // Log Meta crawler access for monitoring
  if (isMetaCrawler) {
    console.log('📋 Meta crawler accessed privacy policy:', new Date().toISOString());
  }
  
  // Always serve HTML for legal pages (both for crawlers and browsers)
  res.set('Content-Type', 'text/html');
  res.send(generateLegalHTML('privacy', LEGAL_CONTENT.privacyPolicy));
});

// Terms of Service Route
router.get('/terms-of-service', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMetaCrawler = /facebookexternalhit|Facebot/i.test(userAgent);
  
  if (isMetaCrawler) {
    console.log('📋 Meta crawler accessed terms of service:', new Date().toISOString());
  }
  
  res.set('Content-Type', 'text/html');
  res.send(generateLegalHTML('terms', LEGAL_CONTENT.termsOfService));
});

// Data Deletion Policy Route
router.get('/data-deletion', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMetaCrawler = /facebookexternalhit|Facebot/i.test(userAgent);
  
  if (isMetaCrawler) {
    console.log('📋 Meta crawler accessed data deletion policy:', new Date().toISOString());
  }
  
  res.set('Content-Type', 'text/html');
  res.send(generateLegalHTML('deletion', LEGAL_CONTENT.dataDeletion));
});

// Data Deletion Instructions (Meta requirement)
router.get('/data-deletion-instructions', (req, res) => {
  res.json({
    instructions: {
      method_1: {
        name: "Dashboard Self-Service",
        url: "https://instagram-backend.888intelligenceautomation.in/dashboard/privacy-controls",
        steps: [
          "1. Login to your account",
          "2. Navigate to Privacy Controls",
          "3. Select data to delete",
          "4. Confirm deletion",
          "5. Receive confirmation email"
        ],
        processing_time: "Immediate"
      },
      method_2: {
        name: "Email Request",
        email: "privacy@888intelligenceautomation.in",
        processing_time: "30 days maximum",
        required_information: [
          "Account email address",
          "Full name",
          "Deletion scope (partial or complete)",
          "Identity verification"
        ]
      }
    },
    compliance: {
      gdpr: "Article 17 - Right to Erasure",
      ccpa: "Section 1798.105 - Right to Delete",
      meta: "Platform Terms February 3, 2025"
    },
    contact: {
      dpo: "privacy@888intelligenceautomation.in",
      support: "support@888intelligenceautomation.in"
    }
  });
});

// Health check for legal routes
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    routes: [
      '/legal/privacy-policy',
      '/legal/terms-of-service',
      '/legal/data-deletion',
      '/legal/data-deletion-instructions'
    ],
    meta_compliance: true,
    last_updated: LEGAL_CONTENT.privacyPolicy.lastUpdated
  });
});

module.exports = router;