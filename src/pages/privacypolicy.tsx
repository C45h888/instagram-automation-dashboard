// src/pages/PrivacyPolicy.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronRight, FileText, Download, ExternalLink } from 'lucide-react';
import { LEGAL_CONTENT, LEGAL_META_TAGS } from '../content/legalcontent';

const PrivacyPolicy: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('introduction');
  const content = LEGAL_CONTENT.privacyPolicy;

  useEffect(() => {
    // Set meta tags for SEO and Meta crawler
    document.title = LEGAL_META_TAGS.privacyPolicy.title;
    
    // Add meta tags
    const metaDescription = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaDescription.setAttribute('name', 'description');
    metaDescription.setAttribute('content', LEGAL_META_TAGS.privacyPolicy.description);
    if (!document.querySelector('meta[name="description"]')) {
      document.head.appendChild(metaDescription);
    }

    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const tableOfContents = [
    { id: 'introduction', title: '1. Introduction' },
    { id: 'information-we-collect', title: '2. Information We Collect' },
    { id: 'how-we-use', title: '3. How We Use Your Information' },
    { id: 'data-sharing', title: '4. Information Sharing' },
    { id: 'your-rights', title: '5. Your Rights and Controls' },
    { id: 'contact', title: '12. Contact Information' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold">888 Intelligence Automation</span>
            </Link>
            <nav className="hidden md:flex space-x-6">
              <Link to="/privacy-policy" className="text-yellow-400 font-medium">Privacy Policy</Link>
              <Link to="/terms-of-service" className="hover:text-yellow-400 transition">Terms</Link>
              <Link to="/data-deletion" className="hover:text-yellow-400 transition">Data Deletion</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{content.title}</h1>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
              <span>Version {content.version}</span>
              <span>•</span>
              <span>Effective: {content.effectiveDate}</span>
              <span>•</span>
              <span>Meta Compliance: {content.metaComplianceDate}</span>
            </div>
            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={() => window.print()}
                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <FileText className="w-4 h-4 mr-2" />
                Print
              </button>
              <button className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Table of Contents - Sticky Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Table of Contents</h2>
              <nav className="space-y-2">
                {tableOfContents.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSectionClick(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm">{item.title}</span>
                  </button>
                ))}
              </nav>

              {/* Quick Actions */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Link
                    to="/dashboard/privacy-controls"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Privacy Dashboard
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                  <Link
                    to="/data-deletion"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Request Data Deletion
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                  <a
                    href="mailto:privacy@888intelligenceautomation.in"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Contact DPO
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="prose prose-lg max-w-none">
              {content.sections.map((section) => (
                <div key={section.id} id={section.id} className="mb-12 scroll-mt-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
                  <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                    {section.content}
                  </div>
                  
                  {section.subsections && section.subsections.map((subsection, idx) => (
                    <div key={idx} className="mt-6">
                      <h3 className="text-xl font-semibold text-gray-800 mb-3">{subsection.title}</h3>
                      <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                        {subsection.content}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Questions about this Privacy Policy?</h3>
                <p className="text-gray-700 mb-4">
                  Contact our Data Protection Officer for any privacy-related inquiries or concerns.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="mailto:privacy@888intelligenceautomation.in"
                    className="inline-flex items-center px-4 py-2 bg-white hover:bg-gray-50 rounded-lg border border-gray-300 transition"
                  >
                    Email DPO
                  </a>
                  <Link
                    to="/dashboard/privacy-controls"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    Privacy Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;