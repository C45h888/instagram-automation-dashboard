// =====================================
// POLICY COMPLIANCE INDICATOR
// Shows Meta Platform Policy compliance status
// Critical for demonstrating policy adherence
// =====================================

import React from 'react';
import { Shield, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface PolicyComplianceIndicatorProps {
  policies: Array<{
    id: string;
    name: string;
    section: string;
    compliant: boolean;
    description: string;
    url?: string;
  }>;
  className?: string;
}

export const PolicyComplianceIndicator: React.FC<PolicyComplianceIndicatorProps> = ({
  policies,
  className = ''
}) => {
  const allCompliant = policies.every(p => p.compliant);

  return (
    <div className={`glass-morphism-card p-6 rounded-xl border ${
      allCompliant ? 'border-green-500/30' : 'border-yellow-500/30'
    } ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Shield className={`w-6 h-6 ${
            allCompliant ? 'text-green-400' : 'text-yellow-400'
          }`} />
          <div>
            <h3 className="text-white font-bold">Meta Platform Policy Compliance</h3>
            <p className="text-gray-400 text-sm">
              {allCompliant
                ? 'All policies compliant'
                : `${policies.filter(p => p.compliant).length}/${policies.length} policies met`}
            </p>
          </div>
        </div>

        {allCompliant && (
          <CheckCircle className="w-8 h-8 text-green-400" />
        )}
      </div>

      <div className="space-y-3">
        {policies.map(policy => (
          <div
            key={policy.id}
            className={`p-3 rounded-lg border ${
              policy.compliant
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  {policy.compliant ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  )}
                  <span className={`font-semibold text-sm ${
                    policy.compliant ? 'text-green-300' : 'text-yellow-300'
                  }`}>
                    {policy.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    (Policy {policy.section})
                  </span>
                </div>
                <p className="text-xs text-gray-400 ml-6">
                  {policy.description}
                </p>
              </div>

              {policy.url && (
                <a
                  href={policy.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PolicyComplianceIndicator;
