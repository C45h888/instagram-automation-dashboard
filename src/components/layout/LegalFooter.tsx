// src/components/layout/LegalFooter.tsx
// OPTIMIZED VERSION - 40% smaller visual weight, main content takes center stage
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Lock, Mail, ExternalLink } from 'lucide-react';

const LegalFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    // CONDENSED: Reduced padding from py-12 to py-6 (50% reduction)
    // Keeps footer compact so main content dominates the viewport
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Main Grid - Reduced gap from gap-8 to gap-6 (25% reduction) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Company Info Column - Condensed spacing */}
          <div>
            {/* Brand Section - Reduced mb-4 to mb-2.5 */}
            <div className="flex items-center space-x-2.5 mb-2.5">
              <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold text-sm">888 Intelligence</span>
            </div>
            
            {/* Description - Smaller text, reduced line height */}
            <p className="text-gray-400 text-xs leading-relaxed">
              Instagram Business Automation Platform with Meta API compliance and enterprise-grade security.
            </p>
            
            {/* Compliance Badges - Reduced spacing from mt-4 to mt-2.5 */}
            <div className="mt-2.5 flex space-x-2">
              <div className="px-2 py-0.5 bg-green-900/50 border border-green-700 rounded text-[10px] text-green-400">
                Meta Compliant
              </div>
              <div className="px-2 py-0.5 bg-blue-900/50 border border-blue-700 rounded text-[10px] text-blue-400">
                GDPR Ready
              </div>
            </div>
          </div>

          {/* Legal Links Column */}
          <div>
            {/* Section Title - Reduced mb-4 to mb-2.5, smaller font */}
            <h3 className="text-white font-semibold text-sm mb-2.5">Legal</h3>
            
            {/* Links List - Reduced space-y-2 to space-y-1.5 */}
            <ul className="space-y-1.5">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <FileText className="w-3 h-3 mr-1.5" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <FileText className="w-3 h-3 mr-1.5" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/data-deletion"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <Lock className="w-3 h-3 mr-1.5" />
                  Data Deletion Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/privacy-controls"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <Shield className="w-3 h-3 mr-1.5" />
                  Privacy Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-2.5">Support</h3>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="mailto:support@888intelligenceautomation.in"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <Mail className="w-3 h-3 mr-1.5" />
                  General Support
                </a>
              </li>
              <li>
                <a
                  href="mailto:privacy@888intelligenceautomation.in"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <Shield className="w-3 h-3 mr-1.5" />
                  Privacy Inquiries
                </a>
              </li>
              <li>
                <a
                  href="mailto:legal@888intelligenceautomation.in"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <FileText className="w-3 h-3 mr-1.5" />
                  Legal Department
                </a>
              </li>
              <li>
                <a
                  href="https://888intelligenceautomation.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  Main Website
                </a>
              </li>
            </ul>
          </div>

          {/* Compliance Column - More compact */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-2.5">Compliance</h3>
            
            {/* Compliance Items - Reduced space-y-3 to space-y-2 */}
            <div className="space-y-2">
              <div className="text-xs">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Meta Platform</p>
                <p className="text-gray-400 text-xs leading-tight">Terms Compliant</p>
                <p className="text-gray-500 text-[10px]">Effective: Feb 3, 2025</p>
              </div>
              <div className="text-xs">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Data Protection</p>
                <p className="text-gray-400 text-xs leading-tight">GDPR & CCPA</p>
                <p className="text-gray-500 text-[10px]">Full Compliance</p>
              </div>
              <div className="text-xs">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Security</p>
                <p className="text-gray-400 text-xs leading-tight">Cloudflare Protected</p>
                <p className="text-gray-500 text-[10px]">Zero-Trust Architecture</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar - HEAVILY CONDENSED from mt-8 pt-8 to mt-4 pt-4 */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            {/* Copyright - Smaller text */}
            <div className="text-gray-400 text-xs">
              © {currentYear} 888 Intelligence Automation. All rights reserved.
            </div>
            
            {/* Policy Info - Condensed spacing and size */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-gray-500">Policy Version: 2.0</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-500">Last Updated: January 1, 2025</span>
            </div>
          </div>
        </div>

        {/* Meta Crawler Notice - Hidden but accessible for SEO */}
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

/* 
 * OPTIMIZATION SUMMARY - 40% SIZE REDUCTION
 * 
 * Before → After:
 * - Main padding: py-12 (48px) → py-6 (24px) = 50% reduction
 * - Grid gap: gap-8 (32px) → gap-6 (24px) = 25% reduction
 * - Section margins: mb-4 (16px) → mb-2.5 (10px) = 37.5% reduction
 * - Bottom bar: mt-8 pt-8 (64px) → mt-4 pt-4 (32px) = 50% reduction
 * - List spacing: space-y-2 (8px) → space-y-1.5 (6px) = 25% reduction
 * - Font sizes: text-sm → text-xs (smaller across the board)
 * - Icon sizes: w-4 h-4 → w-3 h-3 (25% smaller)
 * - Badge sizes: text-xs → text-[10px] (micro text)
 * 
 * Result: Footer maintains all functionality and information
 * but takes up ~40% less vertical space, allowing main content
 * to dominate the viewport while keeping the bug-free height cascade.
 */