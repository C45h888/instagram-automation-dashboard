// Single source of truth for Instagram OAuth scopes.
// Both Login.tsx and TokenImportSection.tsx import from here.
export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_manage_messages',
  'instagram_content_publish',
  'instagram_manage_comments',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'pages_manage_metadata',
  'pages_read_user_content',
  'pages_manage_posts'
].join(',');
