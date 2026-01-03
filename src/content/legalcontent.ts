// src/content/legalContent.ts
// This file contains all legal documents content for the Instagram Automation Platform
// Meta Compliance: February 3, 2025 Requirements

export const LEGAL_CONTENT = {
    privacyPolicy: {
      version: "2.0",
      effectiveDate: "2025-01-01",
      lastUpdated: "2025-01-01",
      metaComplianceDate: "2025-02-03",
      title: "Privacy Policy - Instagram Automation Platform",
      sections: [
        {
          id: "introduction",
          title: "1. Introduction",
          content: `888 Intelligence Automation ("we," "our," "us," or "Company") operates an Instagram Business Automation Platform that integrates with Meta's Instagram Graph API to provide comprehensive social media management and automation services. This Privacy Policy describes how we collect, use, process, share, and protect your information when you use our service.

  Our Platform operates through:
  • Secure Cloudflare tunnel architecture with zero-trust security
  • Integration with Instagram's Graph API under Meta's Platform Terms
  • Advanced N8N workflow automation systems
  • AI-powered customer service and analytics capabilities
  • Cross-platform integration with business tools and services

  Meta Platform Compliance: This policy complies with Meta's Platform Terms effective February 3, 2025, including requirements for privacy policy accessibility, user consent for profile augmentation, and transparent data processing practices.

  Instagram Data Policy: Our use of Instagram data is also governed by Instagram's Data Policy, which you can review at: https://help.instagram.com/155833707900388

  If you have questions about how Instagram itself handles your data, please refer to Instagram's Data Policy. This Privacy Policy describes only our handling of data obtained through your use of our service.`
        },
        {
          id: "information-we-collect",
          title: "2. Information We Collect",
          subsections: [
            {
              title: "2.1 Instagram API Permissions and Data Access",
              content: `We request the following permissions from Instagram's Graph API to provide our automation services. By connecting your Instagram Business account, you authorize us to access data associated with these permissions:

  instagram_basic (Basic Profile Information):
  • Your Instagram business account username and ID
  • Profile picture, biography, and website URL
  • Account type (Business or Creator)
  • Follower count and media count
  Purpose: Display your account information in our dashboard and verify account ownership

  instagram_manage_comments (Comment Management):
  • Read comments on your posts and stories
  • Reply to comments on your behalf
  • Moderate and hide/unhide comments
  • Access comment metadata (author, timestamp, like count)
  Purpose: Automated comment moderation, AI-powered response generation, and community management

  instagram_manage_insights (Analytics and Insights):
  • Account-level insights (reach, impressions, profile views)
  • Media-level insights (likes, comments, saves, shares)
  • Story insights (replies, exits, taps forward/back)
  • Audience demographics (age, gender, location, active hours)
  Purpose: Performance analytics, automated reporting, and audience analysis

  instagram_manage_messages (Direct Message Automation):
  • Read direct messages sent to your business account
  • Send automated responses within 24-hour messaging window
  • Access message metadata and conversation history
  • Manage message reactions
  Purpose: Customer service automation, FAQ responses, and inquiry routing

  pages_show_list (Facebook Pages Access):
  • List of Facebook Pages you manage
  • Page access tokens required for Instagram Business accounts
  Purpose: Required for Instagram Business API access (Instagram accounts must be linked to Facebook Pages)

  pages_read_engagement (Page Engagement Data):
  • Page-level engagement metrics
  • Visitor post data for brand mentions
  Purpose: Cross-platform analytics and user-generated content discovery

  pages_read_user_content (User-Generated Content):
  • Posts by visitors to your Facebook Page
  • Tagged posts mentioning your brand
  Purpose: Brand mention monitoring and UGC collection for marketing campaigns

  For complete details on how Instagram handles your data, please review Instagram's Data Policy: https://help.instagram.com/155833707900388`
            },
            {
              title: "2.2 Instagram Business Data Collected",
              content: `Account Information:
  • Instagram business and creator account profiles
  • Account metadata (username, business name, biography)
  • Profile pictures, website URLs, and contact information
  • Account verification status and category classification
  • Follower and following counts, media statistics

  Content and Media:
  • Instagram posts, stories, reels, and IGTV content
  • Media URLs, thumbnails, and permalinks
  • Captions, hashtags, mentions, and location tags
  • Publishing timestamps and content metadata
  • User-generated content mentioning your brand`
            },
            {
              title: "2.2 Automation and Workflow Data",
              content: `N8N Workflow Systems (5 Primary Automations):
  
  Instagram Analytics Pipeline:
  • Daily and weekly performance aggregations
  • Google Analytics integration and attribution data
  • Historical data tracking and trend analysis
  • Automated reporting configurations and schedules
  • Cross-platform performance correlation
  
  Instagram Engagement Monitor:
  • Real-time comment monitoring (every 5 minutes)
  • AI-powered response generation logs via OpenAI
  • Sentiment analysis results and classifications
  • Human escalation triggers and priority assignments
  • Automated response delivery confirmations`
            }
          ]
        },
        {
          id: "how-we-use",
          title: "3. How We Use Your Information",
          content: `Primary Service Functions:
  
  Instagram Content Automation:
  • Schedule and publish posts, stories, and reels
  • Optimize posting times based on audience engagement
  • Manage content calendars and campaign coordination
  • Cross-post content to multiple business accounts
  • Monitor content performance and engagement
  
  AI-Powered Customer Service:
  • Automatically classify incoming comments and messages
  • Generate contextually appropriate responses using OpenAI
  • Route complex inquiries to human support representatives
  • Track response times and customer satisfaction metrics
  • Maintain conversation history for service continuity`
        },
        {
          id: "data-sharing",
          title: "4. Information Sharing and Third-Party Integrations",
          content: `Meta/Instagram Integration:
  • Data Shared: OAuth access tokens, API requests, business account data
  • Purpose: Instagram Graph API integration, content publishing, analytics retrieval
  • Data Location: Meta's global infrastructure
  • Retention: Per Meta's data retention policies and our active use requirements
  • Legal Basis: Contractual necessity for service provision and user consent
  
  Supabase (Database and Authentication):
  • Data Shared: All encrypted user and business data, authentication records
  • Purpose: Secure data storage, user authentication, real-time synchronization
  • Security: End-to-end encryption, Row Level Security (RLS), SOC 2 compliance
  
  Cloudflare (Security and Infrastructure):
  • Data Shared: HTTP request logs, security events, performance metrics
  • Purpose: Zero-trust security, DDoS protection, content delivery, tunnel services
  • Security: TLS 1.3 encryption, Web Application Firewall, threat intelligence`
        },
        {
          id: "legal-basis",
          title: "5. Legal Basis for Data Processing (GDPR Compliance)",
          content: `For users in the European Economic Area (EEA), United Kingdom, and Switzerland, we process your personal data under the following lawful bases as defined by the General Data Protection Regulation (GDPR):

  Consent (Article 6(1)(a) GDPR):
  • Instagram API data access and automation services
  • AI-powered response generation
  • Marketing communications and promotional materials
  • Analytics and performance tracking
  You may withdraw your consent at any time through the privacy dashboard or by contacting privacy@888intelligenceautomation.in

  Contractual Necessity (Article 6(1)(b) GDPR):
  • Providing our automation platform services
  • Account management and authentication
  • Processing your service subscriptions and payments
  • Technical support and customer service
  Processing is necessary to fulfill our contractual obligations to provide the services you've subscribed to.

  Legitimate Interests (Article 6(1)(f) GDPR):
  • Platform security and fraud prevention
  • Service improvement and optimization
  • Technical troubleshooting and bug fixes
  • Business analytics and operational efficiency
  We have conducted legitimate interest assessments to ensure our interests do not override your fundamental rights and freedoms.

  Legal Obligations (Article 6(1)(c) GDPR):
  • Tax and financial record keeping
  • Compliance with law enforcement requests
  • Regulatory reporting requirements
  • Data breach notifications

  Data Protection Officer Contact:
  Email: privacy@888intelligenceautomation.in
  Address: 888 Intelligence Automation, Data Protection Officer, [Your Business Address]

  Supervisory Authority Rights:
  EEA users have the right to lodge a complaint with their local data protection supervisory authority. Find your supervisory authority at: https://edpb.europa.eu/about-edpb/about-edpb/members_en`
        },
        {
          id: "international-transfers",
          title: "6. International Data Transfers",
          content: `Our services involve international data transfers to countries outside the European Economic Area (EEA), United Kingdom, and Switzerland. We ensure adequate protection for these transfers through the following mechanisms:

  Standard Contractual Clauses (SCCs):
  We use European Commission-approved Standard Contractual Clauses (2021/914) with our third-party service providers located outside the EEA. These clauses provide contractual guarantees for data protection equivalent to GDPR standards.

  Data Transfer Recipients and Safeguards:

  United States (Meta/Instagram):
  • Recipient: Meta Platforms, Inc.
  • Purpose: Instagram Graph API integration
  • Safeguards: Standard Contractual Clauses, Meta's Data Transfer Addendum
  • Additional Info: https://www.facebook.com/privacy/policy

  United States (Supabase):
  • Recipient: Supabase, Inc.
  • Purpose: Database hosting and authentication
  • Safeguards: Standard Contractual Clauses, SOC 2 Type II certification, encryption in transit and at rest
  • Data Center: AWS US-East-1 (Virginia) with optional EU hosting available

  United States (OpenAI):
  • Recipient: OpenAI, LP
  • Purpose: AI-powered response generation
  • Safeguards: Standard Contractual Clauses, OpenAI Data Processing Agreement
  • Data Processing: https://openai.com/policies/data-processing-addendum

  United States (Cloudflare):
  • Recipient: Cloudflare, Inc.
  • Purpose: Security, DDoS protection, and content delivery
  • Safeguards: Standard Contractual Clauses, EU Data Localization options
  • Data Processing: https://www.cloudflare.com/cloudflare-customer-dpa/

  Your Rights Regarding International Transfers:
  • Right to object to transfers on grounds relating to your particular situation
  • Right to request a copy of the safeguards in place
  • Right to request transfer to a data processor in your country (subject to technical feasibility)

  Contact our Data Protection Officer at privacy@888intelligenceautomation.in for:
  • Copies of Standard Contractual Clauses
  • Information about specific data transfer safeguards
  • Questions about international data processing`
        },
        {
          id: "your-rights",
          title: "7. Your Rights and Controls",
          content: `Data Access: View all stored information through your dashboard or request a comprehensive data export in JSON format.

  Data Deletion: Our platform provides a user-friendly data deletion interface accessible through your account dashboard at:
  https://app.888intelligenceautomation.in/dashboard/privacy-controls

  Deletion Options:
  • Selective Deletion: Choose specific data categories
  • Complete Account Deletion: Remove entire account and all associated data
  • Export Before Deletion: Automatically download your data before deletion (recommended)
  • Third-Party Coordination: Automatically revoke Instagram tokens and disable connected services

  Additional GDPR Rights (for EEA/UK/Swiss users):
  • Right to Rectification: Correct inaccurate or incomplete personal data
  • Right to Restriction: Request limitation of processing in certain circumstances
  • Right to Data Portability: Receive your data in a structured, machine-readable format
  • Right to Object: Object to processing based on legitimate interests
  • Right to Withdraw Consent: Withdraw consent for consent-based processing at any time
  • Right to Complain: Lodge a complaint with your local data protection supervisory authority`
        },
        {
          id: "contact",
          title: "12. Contact Information and Support",
          content: `Privacy and Data Protection:
  • Data Protection Officer: privacy@888intelligenceautomation.in
  • General Privacy Inquiries: privacy@888intelligenceautomation.in
  • GDPR/CCPA Requests: privacy@888intelligenceautomation.in
  
  Technical and Customer Support:
  • General Support: support@888intelligenceautomation.in
  • Technical Issues: technical@888intelligenceautomation.in
  • Account Management: accounts@888intelligenceautomation.in
  
  Legal and Compliance:
  • Legal Department: legal@888intelligenceautomation.in
  • Compliance Officer: compliance@888intelligenceautomation.in`
        }
      ]
    },
  
    termsOfService: {
      version: "2.0",
      effectiveDate: "2025-01-01",
      lastUpdated: "2025-01-01",
      title: "Terms and Conditions - Instagram Automation Platform",
      sections: [
        {
          id: "acceptance",
          title: "1. Acceptance of Terms",
          content: `By accessing, using, or subscribing to the Instagram Automation Platform operated by 888 Intelligence Automation ("Company," "we," "our," "us"), you ("User," "Subscriber," "you") acknowledge that you have read, understood, and agree to be legally bound by these Terms and Conditions ("Terms"). These Terms constitute a legally binding agreement between you and 888 Intelligence Automation.
  
  IF YOU DO NOT AGREE TO THESE TERMS IN THEIR ENTIRETY, YOU ARE PROHIBITED FROM ACCESSING OR USING THE SERVICE AND MUST DISCONTINUE USE IMMEDIATELY.`
        },
        {
          id: "service-description",
          title: "2. Service Description and Platform Capabilities",
          content: `888 Intelligence Automation provides a comprehensive Instagram business automation platform that integrates with Meta's Instagram Graph API through secure Cloudflare tunnel architecture. Our Service enables authorized Instagram Business and Creator accounts to automate specific business functions through five (5) core automation workflows:
  
  • Instagram Analytics Pipeline - Automated reporting and performance tracking
  • Instagram Engagement Monitor - Real-time comment and message monitoring
  • Instagram Sales Attribution - E-commerce integration and ROI tracking
  • Instagram UGC Collection - User-generated content discovery and management
  • Instagram Customer Service Router - Automated message classification and routing`
        },
        {
          id: "acceptable-use",
          title: "4. Acceptable Use Policy and Prohibited Activities",
          content: `Permitted Uses:
  The Service may be used solely for:
  • Legitimate Business Operations: Authentic business communication and customer service
  • Content Marketing: Authorized promotion of products, services, or business activities
  • Customer Service: Professional response to customer inquiries and support requests
  • Analytics and Reporting: Business intelligence and performance measurement
  • Community Management: Professional management of brand community and engagement
  
  Strictly Prohibited Activities:
  • Fake Engagement: Creating, purchasing, or encouraging artificial likes, follows, comments, or shares
  • Spam Activities: Bulk messaging, repetitive commenting, or aggressive automated outreach
  • Inauthentic Behavior: Creating fake accounts, impersonation, or misleading representation
  • Content Violations: Distribution of prohibited content as defined by Instagram Community Guidelines
  • Rate Limit Circumvention: Attempting to bypass or exceed Instagram's API rate limitations`
        }
      ]
    },
  
    dataDeletionPolicy: {
      version: "2.0",
      effectiveDate: "2025-01-01",
      lastUpdated: "2025-01-01",
      title: "Data Deletion Policy - Instagram Automation Platform",
      sections: [
        {
          id: "overview",
          title: "1. Policy Overview and Legal Foundation",
          content: `This Data Deletion Policy establishes comprehensive procedures for the deletion of personal data and business information processed by 888 Intelligence Automation's Instagram Automation Platform. This Policy ensures compliance with applicable data protection laws, including the European Union General Data Protection Regulation ("GDPR"), California Consumer Privacy Act ("CCPA"), and Meta Platform Terms effective February 3, 2025.
  
  Legal Rights and Foundations:
  • GDPR Article 17 - Right to Erasure
  • CCPA Section 1798.105 - Right to Delete
  • Meta Platform Terms - Data Deletion Requirements`
        },
        {
          id: "deletion-methods",
          title: "2. Data Deletion Request Methods",
          content: `Primary Deletion Method: Dashboard Self-Service
  The primary and recommended method for data deletion is through the secure user dashboard located at:
  https://app.888intelligenceautomation.in/dashboard/privacy-controls
  
  Dashboard Deletion Features:
  • Granular Deletion Options: Selective deletion of specific data categories
  • Comprehensive Account Deletion: Complete removal of all account data and associated information
  • Export Before Deletion: Automatic data export functionality prior to deletion execution
  • Real-Time Status Updates: Live progress monitoring during deletion process
  • Completion Confirmation: Detailed summary of deleted data categories and retention exceptions
  
  Alternative Methods:
  • Email Request: privacy@888intelligenceautomation.in (30-day response time)
  • Support Ticket: Through our support system (30-day response time)`
        },
        {
          id: "deletion-scope",
          title: "3. Comprehensive Data Deletion Scope",
          content: `Instagram Graph API Data:
  • Instagram business account profiles and metadata
  • All cached Instagram posts, stories, reels, and IGTV content
  • Comments and replies on all connected account content
  • Direct messages sent to connected business accounts
  • All Instagram Insights data and performance metrics
  
  N8N Workflow Automation Data:
  • All five (5) automation workflow configurations
  • Workflow execution history and logs
  • AI-powered response generation history
  • Sentiment analysis results and classifications
  • Customer service routing decisions and records
  
  Third-Party Integration Data:
  • OpenAI processing request logs
  • Shopify integration and order tracking data
  • Google Analytics integration data
  • Slack notification configurations
  • All API tokens and authentication credentials`
        }
      ]
    }
  };
  
  // Structured data for SEO and Meta crawlers
  export const LEGAL_STRUCTURED_DATA = {
    privacyPolicy: {
      "@context": "https://schema.org",
      "@type": "PrivacyPolicy",
      "name": "Instagram Automation Platform Privacy Policy",
      "publisher": {
        "@type": "Organization",
        "name": "888 Intelligence Automation",
        "url": "https://888intelligenceautomation.in"
      },
      "datePublished": "2025-01-01",
      "dateModified": "2025-01-01",
      "inLanguage": "en-US",
      "isAccessibleForFree": true,
      "url": "https://api.888intelligenceautomation.in/privacy-policy"
    },
    termsOfService: {
      "@context": "https://schema.org",
      "@type": "TermsOfService",
      "name": "Instagram Automation Platform Terms and Conditions",
      "publisher": {
        "@type": "Organization",
        "name": "888 Intelligence Automation",
        "url": "https://888intelligenceautomation.in"
      },
      "datePublished": "2025-01-01",
      "dateModified": "2025-01-01",
      "inLanguage": "en-US",
      "url": "https://api.888intelligenceautomation.in/terms-of-service"
    }
  };
  
  // Meta tags for each legal page
  export const LEGAL_META_TAGS = {
    privacyPolicy: {
      title: "Privacy Policy - Instagram Automation Platform | 888 Intelligence",
      description: "Comprehensive privacy policy covering Instagram API usage, data processing, and user rights. Meta Platform Terms compliant (February 3, 2025).",
      ogTitle: "Privacy Policy - Instagram Automation Platform",
      ogDescription: "Learn how we protect your data and comply with GDPR, CCPA, and Meta Platform Terms.",
      ogUrl: "https://api.888intelligenceautomation.in/privacy-policy"
    },
    termsOfService: {
      title: "Terms and Conditions - Instagram Automation Platform | 888 Intelligence",
      description: "Terms of service for Instagram business automation platform. Acceptable use policy and Meta compliance.",
      ogTitle: "Terms and Conditions - Instagram Automation Platform",
      ogDescription: "Review our terms of service and acceptable use policy for Instagram automation.",
      ogUrl: "https://api.888intelligenceautomation.in/terms-of-service"
    },
    dataDeletion: {
      title: "Data Deletion Policy - Instagram Automation Platform | 888 Intelligence",
      description: "Comprehensive data deletion procedures compliant with GDPR Article 17 and CCPA Section 1798.105.",
      ogTitle: "Data Deletion Policy - Instagram Automation Platform",
      ogDescription: "Learn how to delete your data and exercise your privacy rights.",
      ogUrl: "https://api.888intelligenceautomation.in/data-deletion"
    }
  };