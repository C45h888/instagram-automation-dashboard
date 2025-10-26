// =====================================
// USER CONSENT TRACKING SERVICE
// =====================================
// File: src/services/consentService.ts
// Version: 1.0.0
// Purpose: Complete GDPR/CCPA compliant consent management
//
// Features:
//   - Record user consent with full audit trail
//   - Check active consents
//   - Revoke consents with reason tracking
//   - View consent history
//   - Validate required consents
//   - Bulk consent recording
//
// IMPORTANT: After running migration 002_add_user_consents_table.sql,
// regenerate types with: npm run db:types
// =====================================

import { supabase } from '../lib/supabase';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Valid consent types as defined in database schema
 */
export type ConsentType =
  | 'instagram_oauth'
  | 'instagram_data_access'
  | 'marketing_emails'
  | 'analytics_tracking'
  | 'third_party_sharing'
  | 'terms_acceptance'
  | 'privacy_policy'
  | 'cookies'
  | 'automation_features';

/**
 * Valid consent methods
 */
export type ConsentMethod = 'web' | 'mobile_app' | 'api' | 'admin_portal';

/**
 * Service response wrapper for consistent error handling
 */
export interface ServiceResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Complete user consent record (matches database schema after migration)
 */
export interface UserConsent {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  consent_given: boolean;
  privacy_policy_version: string | null;
  terms_version: string | null;
  consent_text: string | null;
  ip_address: string;
  user_agent: string | null;
  browser_language: string | null;
  consent_method: ConsentMethod;
  consented_at: string;
  revoked: boolean;
  revoked_at: string | null;
  revocation_reason: string | null;
  revoked_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Request structure for recording a new consent
 */
export interface ConsentRequest {
  userId: string;
  consentType: ConsentType;
  consentGiven: boolean;
  privacyPolicyVersion?: string;
  termsVersion?: string;
  consentText?: string;
  ipAddress: string;
  userAgent?: string;
  browserLanguage?: string;
  consentMethod?: ConsentMethod;
}

/**
 * Response from checking required consents
 */
export interface RequiredConsentsCheck {
  hasAll: boolean;
  missing: string[];
}

// =====================================
// CONSENT SERVICE CLASS
// =====================================

export class ConsentService {

  /**
   * Records a new user consent with full audit trail
   *
   * @param request - Consent details including user ID, type, and metadata
   * @returns Service response with the created consent ID
   *
   * @example
   * ```typescript
   * const result = await ConsentService.recordConsent({
   *   userId: 'user-uuid-here',
   *   consentType: 'instagram_oauth',
   *   consentGiven: true,
   *   privacyPolicyVersion: '2.0',
   *   termsVersion: '3.1',
   *   consentText: 'I agree to allow Instagram OAuth access...',
   *   ipAddress: '192.168.1.1',
   *   userAgent: 'Mozilla/5.0...',
   *   browserLanguage: 'en-US',
   *   consentMethod: 'web'
   * });
   *
   * if (result.success) {
   *   console.log('Consent recorded:', result.data.id);
   * }
   * ```
   */
  static async recordConsent(
    request: ConsentRequest
  ): Promise<ServiceResponse<{ id: string }>> {
    try {
      // Call the PostgreSQL function created in migration
      // Note: Parameter order matches SQL function (required params first, optional params after)
      const { data, error } = await supabase.rpc('record_consent', {
        p_user_id: request.userId,
        p_consent_type: request.consentType,
        p_consent_given: request.consentGiven,
        p_ip_address: request.ipAddress,              // Required param (moved up)
        p_privacy_policy_version: request.privacyPolicyVersion,
        p_terms_version: request.termsVersion,
        p_consent_text: request.consentText,
        p_user_agent: request.userAgent,
        p_browser_language: request.browserLanguage,
        p_consent_method: request.consentMethod ?? 'web'
      });

      if (error) {
        console.error('Record consent error:', error);
        throw error;
      }

      return {
        success: true,
        data: { id: data }
      };
    } catch (error: any) {
      console.error('ConsentService.recordConsent failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to record consent'
      };
    }
  }

  /**
   * Checks if user has an active (non-revoked) consent for a specific type
   *
   * @param userId - The user's UUID
   * @param consentType - The consent type to check
   * @returns Boolean indicating if active consent exists
   *
   * @example
   * ```typescript
   * const hasOAuthConsent = await ConsentService.hasConsent(
   *   'user-uuid',
   *   'instagram_oauth'
   * );
   *
   * if (hasOAuthConsent) {
   *   // Proceed with Instagram operations
   * } else {
   *   // Redirect to consent page
   * }
   * ```
   */
  static async hasConsent(
    userId: string,
    consentType: ConsentType
  ): Promise<boolean> {
    try {
      // Call the PostgreSQL function created in migration
      const { data, error } = await supabase.rpc('get_active_consent', {
        p_user_id: userId,
        p_consent_type: consentType
      });

      if (error) {
        console.error('Check consent error:', error);
        return false;
      }

      return data === true;
    } catch (error: any) {
      console.error('ConsentService.hasConsent failed:', error);
      return false;
    }
  }

  /**
   * Revokes an existing consent with optional reason
   *
   * @param userId - The user's UUID
   * @param consentType - The consent type to revoke
   * @param reason - Optional reason for revocation
   * @returns Service response indicating success/failure
   *
   * @example
   * ```typescript
   * const result = await ConsentService.revokeConsent(
   *   'user-uuid',
   *   'marketing_emails',
   *   'User opted out via settings page'
   * );
   *
   * if (result.success) {
   *   console.log('Consent revoked successfully');
   * }
   * ```
   */
  static async revokeConsent(
    userId: string,
    consentType: ConsentType,
    reason?: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      // Call the PostgreSQL function created in migration
      const { data, error } = await supabase.rpc('revoke_consent', {
        p_user_id: userId,
        p_consent_type: consentType,
        p_reason: reason
      });

      if (error) {
        console.error('Revoke consent error:', error);
        throw error;
      }

      return {
        success: true,
        data: data === true
      };
    } catch (error: any) {
      console.error('ConsentService.revokeConsent failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to revoke consent'
      };
    }
  }

  /**
   * Retrieves complete consent history for a user
   *
   * @param userId - The user's UUID
   * @param consentType - Optional filter for specific consent type
   * @returns Service response with array of consent records
   *
   * @example
   * ```typescript
   * // Get all consents for user
   * const allConsents = await ConsentService.getConsentHistory('user-uuid');
   *
   * // Get only OAuth consent history
   * const oauthHistory = await ConsentService.getConsentHistory(
   *   'user-uuid',
   *   'instagram_oauth'
   * );
   *
   * if (allConsents.success) {
   *   console.log(`Found ${allConsents.data.length} consent records`);
   * }
   * ```
   */
  static async getConsentHistory(
    userId: string,
    consentType?: ConsentType
  ): Promise<ServiceResponse<UserConsent[]>> {
    try {
      // Call the PostgreSQL function created in migration
      const { data, error } = await supabase.rpc('get_consent_history', {
        p_user_id: userId,
        p_consent_type: consentType
      });

      if (error) {
        console.error('Get consent history error:', error);
        throw error;
      }

      return {
        success: true,
        data: (data || []) as UserConsent[]
      };
    } catch (error: any) {
      console.error('ConsentService.getConsentHistory failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to get consent history'
      };
    }
  }

  /**
   * Checks if user has all required consents
   *
   * Required consents are:
   * - instagram_oauth
   * - instagram_data_access
   * - terms_acceptance
   * - privacy_policy
   *
   * @param userId - The user's UUID
   * @returns Service response with check results and missing consents
   *
   * @example
   * ```typescript
   * const check = await ConsentService.checkRequiredConsents('user-uuid');
   *
   * if (check.success && !check.data.hasAll) {
   *   console.log('Missing consents:', check.data.missing);
   *   // Redirect to consent page with missing items
   * }
   * ```
   */
  static async checkRequiredConsents(
    userId: string
  ): Promise<ServiceResponse<RequiredConsentsCheck>> {
    try {
      // Call the PostgreSQL function created in migration
      const { data, error } = await supabase.rpc('has_required_consents', {
        p_user_id: userId
      });

      if (error) {
        console.error('Check required consents error:', error);
        throw error;
      }

      // Function returns array with single row: {has_all_required, missing_consents}
      const result = data?.[0];

      return {
        success: true,
        data: {
          hasAll: result?.has_all_required || false,
          missing: result?.missing_consents || []
        }
      };
    } catch (error: any) {
      console.error('ConsentService.checkRequiredConsents failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to check required consents'
      };
    }
  }

  /**
   * Records multiple consents at once (e.g., during onboarding)
   *
   * @param userId - The user's UUID
   * @param consents - Array of consent requests (userId will be overridden)
   * @param metadata - Shared metadata for all consents
   * @returns Service response with count of successfully recorded consents
   *
   * @example
   * ```typescript
   * const result = await ConsentService.recordBulkConsents(
   *   'user-uuid',
   *   [
   *     {
   *       userId: '', // Will be overridden
   *       consentType: 'instagram_oauth',
   *       consentGiven: true,
   *       consentText: 'I agree to OAuth access...'
   *     },
   *     {
   *       userId: '',
   *       consentType: 'terms_acceptance',
   *       consentGiven: true,
   *       consentText: 'I accept the terms...'
   *     }
   *   ],
   *   {
   *     ipAddress: '192.168.1.1',
   *     userAgent: 'Mozilla/5.0...',
   *     privacyPolicyVersion: '2.0',
   *     termsVersion: '3.1'
   *   }
   * );
   *
   * if (result.success) {
   *   console.log(`Recorded ${result.data.recorded} consents`);
   * }
   * ```
   */
  static async recordBulkConsents(
    userId: string,
    consents: Omit<ConsentRequest, 'userId' | 'ipAddress' | 'userAgent'>[],
    metadata: {
      ipAddress: string;
      userAgent?: string;
      browserLanguage?: string;
      privacyPolicyVersion?: string;
      termsVersion?: string;
      consentMethod?: ConsentMethod;
    }
  ): Promise<ServiceResponse<{ recorded: number }>> {
    try {
      let successCount = 0;
      const errors: string[] = [];

      // Process each consent sequentially to maintain transaction integrity
      for (const consent of consents) {
        const result = await this.recordConsent({
          userId,
          consentType: consent.consentType,
          consentGiven: consent.consentGiven,
          privacyPolicyVersion: metadata.privacyPolicyVersion || consent.privacyPolicyVersion,
          termsVersion: metadata.termsVersion || consent.termsVersion,
          consentText: consent.consentText,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          browserLanguage: metadata.browserLanguage,
          consentMethod: metadata.consentMethod || consent.consentMethod || 'web'
        });

        if (result.success) {
          successCount++;
        } else {
          errors.push(`${consent.consentType}: ${result.error}`);
        }
      }

      // Return success if at least one consent was recorded
      if (successCount > 0) {
        return {
          success: true,
          data: { recorded: successCount },
          error: errors.length > 0 ? `Partial success. Errors: ${errors.join('; ')}` : undefined
        };
      } else {
        return {
          success: false,
          data: null,
          error: `Failed to record any consents. Errors: ${errors.join('; ')}`
        };
      }
    } catch (error: any) {
      console.error('ConsentService.recordBulkConsents failed:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to record bulk consents'
      };
    }
  }

  /**
   * Gets the user's IP address from the browser
   * Helper utility for consent recording
   *
   * @returns IP address string or 'unknown' if unavailable
   *
   * @example
   * ```typescript
   * const ipAddress = await ConsentService.getClientIpAddress();
   * ```
   */
  static async getClientIpAddress(): Promise<string> {
    try {
      // In production, you might want to use a service like ipify or get it from your backend
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      console.error('Failed to get client IP address:', error);
      return 'unknown';
    }
  }

  /**
   * Gets browser metadata for consent recording
   * Helper utility for consent recording
   *
   * @returns Object with userAgent and browserLanguage
   *
   * @example
   * ```typescript
   * const metadata = ConsentService.getBrowserMetadata();
   * // { userAgent: 'Mozilla/5.0...', browserLanguage: 'en-US' }
   * ```
   */
  static getBrowserMetadata(): { userAgent: string; browserLanguage: string } {
    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      browserLanguage: typeof navigator !== 'undefined' ? navigator.language : 'en'
    };
  }

  /**
   * Validates if a consent type is valid
   *
   * @param consentType - The consent type to validate
   * @returns Boolean indicating if valid
   */
  static isValidConsentType(consentType: string): consentType is ConsentType {
    const validTypes: ConsentType[] = [
      'instagram_oauth',
      'instagram_data_access',
      'marketing_emails',
      'analytics_tracking',
      'third_party_sharing',
      'terms_acceptance',
      'privacy_policy',
      'cookies',
      'automation_features'
    ];
    return validTypes.includes(consentType as ConsentType);
  }
}

// =====================================
// EXPORTS
// =====================================

export default ConsentService;
