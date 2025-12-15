# Administrator Account Approach (2025)

## Overview
This project uses an **administrator account** for Instagram API testing due to Meta's suspension of Instagram Test Users.

## Setup
1. Admin account added to Meta App Dashboard (App ID: YOUR_APP_ID)
2. Admin role: Administrator
3. Instagram Business Account linked: @kamii
4. Development Mode: Enabled

## API Access
- **Graph API Version**: v23.0 (latest as of 2025)
- **Access Level**: Full API access (all Golden Scope permissions)
- **Token Type**: Page Access Token (mapped to Instagram Business Account)
- **Token Expiration**: 60 days (requires refresh)

## Permissions (Golden Scope)
The admin account has access to:
- `instagram_basic` - Profile data, media
- `instagram_content_publish` - Post creation
- `instagram_manage_comments` - Comment management
- `instagram_manage_messages` - DM inbox access
- `pages_read_engagement` - Linked Facebook Page engagement metrics

## Differences from Test Users
| Feature | Test Users (Deprecated) | Admin Account (2025) |
|---------|-------------------------|----------------------|
| API Access | Limited sandbox data | Real production data |
| Account Type | Fake/test accounts | Real Instagram account |
| Setup | Automated via API | Manual via App Dashboard |
| Availability | ❌ Suspended by Meta | ✅ Available |

## Moving to Production
When ready for App Review:
1. Submit screencast demonstrating all features (see Task 4.5)
2. Provide test credentials for Meta reviewers (see Task 4.6)
3. Document human oversight features (draft approval, UGC permissions)
4. Upon approval, app moves to Live Mode for production users

## References
- [Meta App Dashboard](https://developers.facebook.com/apps/)
- [Graph API v23.0 Docs](https://developers.facebook.com/docs/graph-api/changelog/version23.0)
- [Instagram Business API Overview](https://developers.facebook.com/docs/instagram-api)
