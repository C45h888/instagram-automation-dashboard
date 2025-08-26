// src/pages/TermsOfService.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Users, Lock, Scale, AlertCircle, ChevronRight, ArrowLeft } from 'lucide-react';

interface Section {
  id: string;
  title: string;
  content: string;
  subsections?: { title: string; content: string }[];
}

const TermsOfService: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('');
  const [lastUpdated] = useState('December 10, 2024');
  const [effectiveDate] = useState('December 15, 2024');

  const sections: Section[] = [
    {
      id: 'acceptance',
      title: '1. Acceptance of Terms',
      content: 'By accessing or using the InstaAutomation service ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you do not have permission to access the Service.',
      subsections: [
        {
          title: 'Eligibility',
          content: 'You must be at least 18 years old and have the legal capacity to enter into binding contracts to use this Service. By using the Service, you represent and warrant that you meet these eligibility requirements.'
        },
        {
          title: 'Account Registration',
          content: 'You must provide accurate, complete, and current information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.'
        }
      ]
    },
    {
      id: 'service-description',
      title: '2. Service Description',
      content: 'InstaAutomation provides Instagram automation tools, analytics, and management services designed to help businesses and creators optimize their Instagram presence.',
      subsections: [
        {
          title: 'Core Features',
          content: 'Our Service includes automated posting, engagement analytics, comment management, DM automation, and campaign tracking. Features may be added, modified, or removed at our discretion.'
        },
        {
          title: 'Third-Party Integration',
          content: 'The Service integrates with Instagram through official APIs. Your use of Instagram features is also subject to Instagram\'s Terms of Service and Community Guidelines.'
        },
        {
          title: 'Service Availability',
          content: 'We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance and updates may temporarily affect availability.'
        }
      ]
    },
    {
      id: 'acceptable-use',
      title: '3. Acceptable Use Policy',
      content: 'You agree to use the Service only for lawful purposes and in accordance with these Terms.',
      subsections: [
        {
          title: 'Prohibited Activities',
          content: 'You may not: (a) violate Instagram\'s Terms or API policies; (b) use the Service for spam, harassment, or malicious activities; (c) attempt to gain unauthorized access to our systems; (d) use the Service to infringe on intellectual property rights; (e) resell or redistribute the Service without permission.'
        },
        {
          title: 'Content Guidelines',
          content: 'All content posted through our Service must comply with Instagram\'s Community Guidelines. We reserve the right to suspend accounts that violate these guidelines.'
        },
        {
          title: 'Rate Limits',
          content: 'To ensure service quality and Instagram API compliance, we enforce rate limits on automated actions. Attempting to bypass these limits may result in account suspension.'
        }
      ]
    },
    {
      id: 'payment-billing',
      title: '4. Payment and Billing',
      content: 'Certain features of the Service require a paid subscription.',
      subsections: [
        {
          title: 'Subscription Plans',
          content: 'We offer monthly and annual subscription plans. Plan details, features, and pricing are subject to change with 30 days notice to existing subscribers.'
        },
        {
          title: 'Billing Cycle',
          content: 'Subscriptions automatically renew unless cancelled before the renewal date. Charges are processed at the beginning of each billing period.'
        },
        {
          title: 'Refund Policy',
          content: 'We offer a 14-day money-back guarantee for new subscriptions. After this period, payments are non-refundable except as required by law.'
        },
        {
          title: 'Payment Methods',
          content: 'We accept major credit cards and other payment methods as displayed during checkout. You authorize us to charge your selected payment method for all fees.'
        }
      ]
    },
    {
      id: 'intellectual-property',
      title: '5. Intellectual Property Rights',
      content: 'The Service and its original content, features, and functionality are owned by InstaAutomation and are protected by international copyright, trademark, and other intellectual property laws.',
      subsections: [
        {
          title: 'Your Content',
          content: 'You retain all rights to content you post through the Service. By posting content, you grant us a license to use, store, and display your content as necessary to provide the Service.'
        },
        {
          title: 'Feedback',
          content: 'Any feedback, suggestions, or ideas you provide about the Service may be used by us without any obligation to compensate you.'
        }
      ]
    },
    {
      id: 'privacy',
      title: '6. Privacy and Data Protection',
      content: 'Your use of the Service is also governed by our Privacy Policy. By using the Service, you consent to our collection and use of your information as described in the Privacy Policy.',
      subsections: [
        {
          title: 'Data Security',
          content: 'We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.'
        },
        {
          title: 'Instagram Data',
          content: 'We access and process Instagram data only as authorized by you and in compliance with Instagram\'s Platform Terms and Developer Policies.'
        }
      ]
    },
    {
      id: 'disclaimers',
      title: '7. Disclaimers and Limitations',
      content: 'The Service is provided "as is" and "as available" without warranties of any kind.',
      subsections: [
        {
          title: 'No Warranties',
          content: 'We disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.'
        },
        {
          title: 'Limitation of Liability',
          content: 'To the maximum extent permitted by law, InstaAutomation shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.'
        },
        {
          title: 'Indemnification',
          content: 'You agree to indemnify and hold harmless InstaAutomation from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.'
        }
      ]
    },
    {
      id: 'termination',
      title: '8. Termination',
      content: 'We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.',
      subsections: [
        {
          title: 'Effect of Termination',
          content: 'Upon termination, your right to use the Service will cease immediately. We may delete your account data after 30 days unless legally required to retain it.'
        },
        {
          title: 'Survival',
          content: 'Provisions relating to intellectual property, disclaimers, limitations of liability, and governing law shall survive termination of these Terms.'
        }
      ]
    },
    {
      id: 'governing-law',
      title: '9. Governing Law and Disputes',
      content: 'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which InstaAutomation operates.',
      subsections: [
        {
          title: 'Arbitration',
          content: 'Any disputes arising from these Terms shall be resolved through binding arbitration, except where prohibited by law.'
        },
        {
          title: 'Class Action Waiver',
          content: 'You agree to resolve disputes with us on an individual basis and waive any right to participate in class actions.'
        }
      ]
    },
    {
      id: 'changes',
      title: '10. Changes to Terms',
      content: 'We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service. Continued use after changes constitutes acceptance of the new Terms.'
    },
    {
      id: 'contact',
      title: '11. Contact Information',
      content: 'For questions about these Terms of Service, please contact us at:',
      subsections: [
        {
          title: 'Email',
          content: 'legal@instaautomation.com'
        },
        {
          title: 'Address',
          content: '888 Intelligence Automation, Legal Department, [Your Address]'
        }
      ]
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      const elementPosition = element.offsetTop - offset;
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2 text-white hover:text-yellow-400 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Shield className="w-6 h-6 text-yellow-400" />
              <span className="text-white font-semibold">Terms of Service</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Table of Contents - Sticky Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <h3 className="text-white font-semibold mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-yellow-400" />
                Table of Contents
              </h3>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      activeSection === section.id
                        ? 'bg-yellow-500/20 text-yellow-400 border-l-2 border-yellow-400'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
              
              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-xs text-gray-400">
                  Last Updated: {lastUpdated}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Effective Date: {effectiveDate}
                </p>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              {/* Header Section */}
              <div className="mb-8 pb-8 border-b border-gray-700">
                <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
                <div className="flex items-center space-x-6 text-gray-400">
                  <span className="flex items-center">
                    <Scale className="w-5 h-5 mr-2" />
                    Legal Agreement
                  </span>
                  <span className="flex items-center">
                    <Lock className="w-5 h-5 mr-2" />
                    Binding Contract
                  </span>
                  <span className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    All Users
                  </span>
                </div>
              </div>

              {/* Important Notice */}
              <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-yellow-400 font-semibold">Important Legal Notice</h3>
                    <p className="text-gray-300 text-sm mt-1">
                      These Terms of Service constitute a legally binding agreement between you and InstaAutomation. 
                      Please read them carefully before using our Service. By using InstaAutomation, you acknowledge 
                      that you have read, understood, and agree to be bound by these Terms.
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Sections */}
              <div className="space-y-8">
                {sections.map((section) => (
                  <section key={section.id} id={section.id} className="scroll-mt-24">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                      <ChevronRight className="w-6 h-6 text-yellow-400 mr-2" />
                      {section.title}
                    </h2>
                    <p className="text-gray-300 leading-relaxed mb-4">
                      {section.content}
                    </p>
                    
                    {section.subsections && (
                      <div className="space-y-4 ml-6">
                        {section.subsections.map((subsection, index) => (
                          <div key={index}>
                            <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                              {subsection.title}
                            </h3>
                            <p className="text-gray-300 leading-relaxed">
                              {subsection.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Agreement Section */}
              <div className="mt-12 pt-8 border-t border-gray-700">
                <div className="bg-gray-900/50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-3">Agreement to Terms</h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    By clicking "I Agree," creating an account, or using our Service, you acknowledge that you have 
                    read, understood, and agree to be bound by these Terms of Service and our Privacy Policy.
                  </p>
                  <div className="flex items-center space-x-4">
                    <Link
                      to="/privacy-policy"
                      className="text-yellow-400 hover:text-yellow-300 text-sm underline"
                    >
                      View Privacy Policy
                    </Link>
                    <span className="text-gray-500">•</span>
                    <Link
                      to="/data-deletion"
                      className="text-yellow-400 hover:text-yellow-300 text-sm underline"
                    >
                      Data Deletion Policy
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;