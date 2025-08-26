// src/components/layout/LegalFooter.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Lock, Mail, ExternalLink } from 'lucide-react';

const LegalFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-white font-semibold">888 Intelligence</span>
            </div>
            <p className="text-gray-400 text-sm">
              Instagram Business Automation Platform with Meta API compliance and enterprise-grade security.
            </p>
            <div className="mt-4 flex space-x-3">
              <div className="px-2 py-1 bg-green-900/50 border border-green-700 rounded text-xs text-green-400">
                Meta Compliant
              </div>
              <div className="px-2 py-1 bg-blue-900/50 border border-blue-700 rounded text-xs text-blue-400">
                GDPR Ready
              </div>
            </div>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/data-deletion"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Data Deletion Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/privacy-controls"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:support@888intelligenceautomation.in"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  General Support
                </a>
              </li>
              <li>
                <a
                  href="mailto:privacy@888intelligenceautomation.in"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy Inquiries
                </a>
              </li>
              <li>
                <a
                  href="mailto:legal@888intelligenceautomation.in"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Legal Department
                </a>
              </li>
              <li>
                <a
                  href="https://888intelligenceautomation.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Main Website
                </a>
              </li>
            </ul>
          </div>

          {/* Compliance */}
          <div>
            <h3 className="text-white font-semibold mb-4">Compliance</h3>
            <div className="space-y-3">
              <div className="text-sm">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Meta Platform</p>
                <p className="text-gray-400">Terms Compliant</p>
                <p className="text-gray-500 text-xs">Effective: Feb 3, 2025</p>
              </div>
              <div className="text-sm">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Data Protection</p>
                <p className="text-gray-400">GDPR & CCPA</p>
                <p className="text-gray-500 text-xs">Full Compliance</p>
              </div>
              <div className="text-sm">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Security</p>
                <p className="text-gray-400">Cloudflare Protected</p>
                <p className="text-gray-500 text-xs">Zero-Trust Architecture</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm">
              © {currentYear} 888 Intelligence Automation. All rights reserved.
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-4 text-sm">
              <span className="text-gray-500">Policy Version: 2.0</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-500">Last Updated: January 1, 2025</span>
            </div>
          </div>
        </div>

        {/* Meta Crawler Notice (Hidden but accessible) */}
        <div className="sr-only">
          Instagram Automation Platform by 888 Intelligence Automation.
          Privacy Policy: https://instagram-backend.888intelligenceautomation.in/privacy-policy
          Terms of Service: https://instagram-backend.888intelligenceautomation.in/terms-of-service
          Data Deletion: https://instagram-backend.888intelligenceautomation.in/data-deletion
        </div>
      </div>
    </footer>
  );
};

export default LegalFooter;