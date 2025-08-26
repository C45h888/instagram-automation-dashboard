// src/pages/DataDeletion.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Trash2, Shield, Clock, Download, Mail, CheckCircle, AlertTriangle, 
  ArrowLeft, FileText, Info, Settings, ChevronRight, Scale 
} from 'lucide-react';

interface DeletionStep {
  number: number;
  title: string;
  description: string;
  action?: string;
  timeframe?: string;
}

const DataDeletion: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'instructions' | 'policy' | 'request'>('instructions');
  
  const deletionSteps: DeletionStep[] = [
    {
      number: 1,
      title: 'Submit Deletion Request',
      description: 'You can request data deletion through your account settings or by contacting our support team.',
      action: 'Go to Settings → Privacy → Delete My Data',
      timeframe: 'Immediate'
    },
    {
      number: 2,
      title: 'Identity Verification',
      description: 'We will verify your identity to ensure the security of your data. You may need to confirm via email.',
      action: 'Check your registered email for verification',
      timeframe: '1-2 business days'
    },
    {
      number: 3,
      title: 'Processing Period',
      description: 'Your deletion request will be processed. Some data may be retained for legal compliance.',
      action: 'We will email you when processing begins',
      timeframe: '30 days'
    },
    {
      number: 4,
      title: 'Confirmation',
      description: 'You will receive confirmation when your data has been deleted from our systems.',
      action: 'Confirmation email sent',
      timeframe: 'Upon completion'
    }
  ];

  const dataCategories = [
    {
      category: 'Account Information',
      items: ['Email address', 'Username', 'Profile information', 'Account settings'],
      retention: 'Deleted immediately',
      exceptions: 'None'
    },
    {
      category: 'Instagram Data',
      items: ['Access tokens', 'Media metadata', 'Engagement metrics', 'Follower information'],
      retention: 'Deleted within 30 days',
      exceptions: 'Aggregated analytics (anonymized)'
    },
    {
      category: 'Usage Data',
      items: ['Login history', 'Feature usage', 'App interactions', 'Performance data'],
      retention: 'Deleted within 30 days',
      exceptions: 'Required for security logs (90 days)'
    },
    {
      category: 'Payment Information',
      items: ['Billing history', 'Transaction records', 'Payment methods (tokenized)'],
      retention: 'Retained as required by law',
      exceptions: 'Financial records (7 years for tax compliance)'
    },
    {
      category: 'Communications',
      items: ['Support tickets', 'Email communications', 'Feedback', 'Chat history'],
      retention: 'Deleted within 30 days',
      exceptions: 'Legal correspondence'
    }
  ];

  const faqs = [
    {
      question: 'How long does the deletion process take?',
      answer: 'The complete deletion process typically takes 30 days. Some data may be retained longer if required by law or for legitimate business purposes such as fraud prevention.'
    },
    {
      question: 'Can I recover my data after deletion?',
      answer: 'No, once the deletion process is complete, your data cannot be recovered. We recommend downloading your data before requesting deletion.'
    },
    {
      question: 'What happens to my Instagram connection?',
      answer: 'When you delete your data, we revoke our access to your Instagram account. You may also want to remove our app from your Instagram connected apps settings.'
    },
    {
      question: 'Will deletion affect my Instagram account?',
      answer: 'No, deleting your data from InstaAutomation does not affect your Instagram account. We only delete the data we have collected through our service.'
    },
    {
      question: 'What data is retained after deletion?',
      answer: 'We may retain certain data as required by law, such as financial records for tax purposes, or anonymized data for analytics that cannot be traced back to you.'
    }
  ];

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
              <Trash2 className="w-6 h-6 text-red-400" />
              <span className="text-white font-semibold">Data Deletion</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Data Deletion & Privacy</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            We respect your right to privacy and data control. Learn how to delete your data and understand our deletion policies.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-1 flex space-x-1">
            <button
              onClick={() => setActiveTab('instructions')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'instructions'
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Instructions
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'policy'
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Policy Details
            </button>
            <button
              onClick={() => setActiveTab('request')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'request'
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Request Form
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'instructions' && (
          <div className="space-y-8">
            {/* Deletion Steps */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Shield className="w-6 h-6 text-yellow-400 mr-3" />
                How to Delete Your Data
              </h2>
              
              <div className="space-y-6">
                {deletionSteps.map((step) => (
                  <div key={step.number} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-black font-bold">{step.number}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
                      <p className="text-gray-300 mb-2">{step.description}</p>
                      {step.action && (
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-yellow-400">→ {step.action}</span>
                          {step.timeframe && (
                            <span className="text-gray-400 flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {step.timeframe}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link
                to="/dashboard/privacy-controls"
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-yellow-500/50 transition-all group"
              >
                <Settings className="w-8 h-8 text-yellow-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold text-white mb-2">Privacy Dashboard</h3>
                <p className="text-gray-400 text-sm">Manage your data and privacy settings</p>
              </Link>

              
                href="mailto:privacy@888intelligenceautomation.in"
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-yellow-500/50 transition-all group"
    
                <Mail className="w-8 h-8 text-yellow-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold text-white mb-2">Email Support</h3>
                <p className="text-gray-400 text-sm">Contact our privacy team directly</p>
        

              <button className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-yellow-500/50 transition-all group">
                <Download className="w-8 h-8 text-yellow-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold text-white mb-2">Download Your Data</h3>
                <p className="text-gray-400 text-sm">Export all your data before deletion</p>
              </button>
            </div>

            {/* FAQs */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Info className="w-6 h-6 text-yellow-400 mr-3" />
                Frequently Asked Questions
              </h2>
              
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <details key={index} className="group">
                    <summary className="cursor-pointer text-white font-medium hover:text-yellow-400 transition-colors flex items-center justify-between">
                      {faq.question}
                      <ChevronRight className="w-5 h-5 transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-3 text-gray-300 pl-4 border-l-2 border-gray-700">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'policy' && (
          <div className="space-y-8">
            {/* Data Categories */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <FileText className="w-6 h-6 text-yellow-400 mr-3" />
                Data Categories and Retention
              </h2>
              
              <div className="space-y-6">
                {dataCategories.map((category, index) => (
                  <div key={index} className="border-l-4 border-yellow-500 pl-6">
                    <h3 className="text-lg font-semibold text-white mb-2">{category.category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Data Included:</p>
                        <ul className="space-y-1">
                          {category.items.map((item, idx) => (
                            <li key={idx} className="text-gray-300 text-sm flex items-center">
                              <CheckCircle className="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Retention Policy:</p>
                        <p className="text-gray-300 text-sm mb-2">{category.retention}</p>
                        {category.exceptions && (
                          <>
                            <p className="text-sm text-gray-400 mb-1">Exceptions:</p>
                            <p className="text-yellow-400 text-sm">{category.exceptions}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Compliance */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Shield className="w-6 h-6 text-yellow-400 mr-3" />
                Legal Compliance
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Scale className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">GDPR Compliant</h3>
                  <p className="text-gray-400 text-sm">Article 17 - Right to Erasure</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">CCPA Compliant</h3>
                  <p className="text-gray-400 text-sm">Section 1798.105 - Right to Delete</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Meta Compliant</h3>
                  <p className="text-gray-400 text-sm">Platform Terms Feb 3, 2025</p>
                </div>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-red-400 font-semibold mb-2">Important Information About Data Deletion</h3>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li>• Data deletion is permanent and cannot be reversed</li>
                    <li>• Some data may be retained for legal compliance (financial records, audit logs)</li>
                    <li>• Deletion process typically completes within 30 days</li>
                    <li>• Third-party services will be notified to delete your data</li>
                    <li>• We recommend downloading your data before requesting deletion</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'request' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Trash2 className="w-6 h-6 text-red-400 mr-3" />
                Request Data Deletion
              </h2>
              
              <form className="space-y-6">
                <div>
                  <label className="block text-white font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 bg-gray-900/50 text-white border border-gray-600 rounded-lg focus:border-yellow-500/50 outline-none"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Account Username</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-900/50 text-white border border-gray-600 rounded-lg focus:border-yellow-500/50 outline-none"
                    placeholder="@yourusername"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Deletion Scope</label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-3" />
                      <span className="text-gray-300">Instagram Data (posts, analytics, engagement)</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-3" />
                      <span className="text-gray-300">Automation Workflows (N8N configurations)</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-3" />
                      <span className="text-gray-300">Account Information (profile, settings)</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-3" />
                      <span className="text-gray-300">All Data (complete account deletion)</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Reason for Deletion (Optional)</label>
                  <textarea
                    className="w-full px-4 py-2 bg-gray-900/50 text-white border border-gray-600 rounded-lg focus:border-yellow-500/50 outline-none resize-none"
                    rows={4}
                    placeholder="Please share why you're deleting your data..."
                  />
                </div>
                
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <label className="flex items-start">
                    <input type="checkbox" className="mr-3 mt-1" required />
                    <span className="text-gray-300 text-sm">
                      I understand that data deletion is permanent and irreversible. I have exported any data 
                      I wish to keep, and I accept that some data may be retained for legal compliance purposes 
                      as outlined in the Data Deletion Policy.
                    </span>
                  </label>
                </div>
                
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Submit Deletion Request
                  </button>
                  <Link
                    to="/dashboard/privacy-controls"
                    className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-center"
                  >
                    Use Dashboard Instead
                  </Link>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataDeletion;