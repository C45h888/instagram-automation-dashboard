# Supabase MCP Server Setup Guide for Claude Code

**Project**: Instagram Automation Dashboard
**Created**: 2025-12-23
**Last Updated**: 2025-12-23
**Claude Code Version**: 2.0.x

---

## Table of Contents

1. [Overview](#overview)
2. [Understanding the Problem](#understanding-the-problem)
3. [Transport Protocols Explained](#transport-protocols-explained)
4. [Configuration Options](#configuration-options)
5. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
6. [Project-Specific Configuration](#project-specific-configuration)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [References](#references)

---

## Overview

This guide provides comprehensive instructions for setting up Supabase MCP (Model Context Protocol) server with Claude Code for the Instagram Automation Dashboard project. It includes lessons learned from initial setup failures and best practices for 2025.

### What is Supabase MCP?

Supabase MCP allows Claude Code to directly interact with your Supabase database, enabling:
- Direct SQL query execution
- Table schema inspection
- CRUD operations on database tables
- Edge Function management
- Real-time database insights

### Why This Guide Exists

Our initial setup using **SSE transport failed** with connection errors. This guide documents:
- ❌ What went wrong (deprecated SSE, security issues)
- ✅ What works (modern HTTP/stdio transports)
- 🔒 Security best practices
- 🛠️ Troubleshooting common issues

---

## Understanding the Problem

### Initial Configuration (FAILED ❌)

```bash
# What we tried initially (via claude mcp add)
Transport: SSE (Server-Sent Events)
URL: https://mcp.supabase.com/sse?project_ref=uromexjprcrjfmhkmgxa
Status: ✗ Failed to connect
Authentication: Manual JWT service_role token in headers
```

### Why It Failed

1. **SSE is Deprecated** (as of 2025)
   - SSE required maintaining two separate endpoints (HTTP POST + SSE stream)
   - Replaced by Streamable HTTP (single-endpoint architecture)
   - No longer recommended by Supabase or MCP specification

2. **Security Issue: Service Role Token Exposure**
   - Service role keys should NEVER be in MCP configurations
   - Modern approach uses OAuth 2.0 browser authentication
   - Service role = full admin access (major security risk)

3. **Wrong Authentication Flow**
   - Old method: Manual token in headers
   - New method: Dynamic OAuth with browser-based login
   - OAuth provides scoped access and automatic token refresh

---

## Transport Protocols Explained

### Available Transport Options

| Transport | Type | Use Case | Performance | Security | Status |
|-----------|------|----------|-------------|----------|---------|
| **stdio** | Local | CLI tools, local development | ⚡ 10,000+ ops/sec | 🔒 Isolated | ✅ Recommended |
| **Streamable HTTP** | Remote | Cloud deployments, browsers | 🚀 100-1,000 ops/sec | 🔐 OAuth | ✅ Modern Standard |
| **SSE** | Remote (Legacy) | Older implementations | 🐌 Variable | ⚠️ Manual tokens | ❌ Deprecated |

### stdio vs Streamable HTTP

#### **stdio Transport** (Recommended for Local Development)

```bash
claude mcp add --transport stdio supabase \
  --env SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
  --env SUPABASE_ANON_KEY=your_anon_key_here \
  -s user \
  -- npx -y @supabase/mcp@latest
```

**Advantages:**
- ✅ Sub-millisecond latency
- ✅ No network overhead
- ✅ Works offline
- ✅ Simpler debugging
- ✅ Better for development

**Disadvantages:**
- ❌ Local only (no remote access)
- ❌ Requires npx/Node.js

#### **Streamable HTTP Transport** (For Remote/Production)

```bash
claude mcp add --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=uromexjprcrjfmhkmgxa" \
  -s user
```

**Advantages:**
- ✅ Remote access possible
- ✅ Browser-based OAuth
- ✅ Automatic token refresh
- ✅ Enterprise-ready

**Disadvantages:**
- ❌ Network latency (10-50ms)
- ❌ Requires internet connection
- ❌ More complex auth flow

### Decision Matrix

```
Local Development → Use stdio
Remote/Cloud/Team → Use Streamable HTTP
Enterprise/Multi-user → Use Streamable HTTP with OAuth
Self-hosted Supabase → Use stdio with custom env vars
```

---

## Configuration Options

### Option 1: stdio Transport (RECOMMENDED for This Project)

**Command:**
```bash
claude mcp add --transport stdio supabase \
  --env SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
  --env SUPABASE_ANON_KEY=your_anon_key_from_env \
  --scope user \
  -- npx -y @supabase/mcp@latest
```

**Where to Get Values:**
- `SUPABASE_URL`: From `.env` file → `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY`: From `.env` file → `VITE_SUPABASE_ANON_KEY`
- Project ref: `uromexjprcrjfmhkmgxa` (already in URL)

**Scope Options:**
- `--scope user` → Available in all projects (~/.claude.json)
- `--scope project` → Only this project (.mcp.json in project root)
- `--scope local` → Session-specific

### Option 2: Streamable HTTP Transport (Alternative)

**Command:**
```bash
claude mcp add --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=uromexjprcrjfmhkmgxa" \
  --scope user
```

**Authentication:**
- Requires OAuth flow via `/mcp` command in Claude Code
- Opens browser for Supabase login
- Grants organization access automatically
- No manual token configuration needed

### Option 3: add-json Method (Advanced)

**Command:**
```bash
claude mcp add-json "supabase" '{
  "command": "npx",
  "args": ["-y", "@supabase/mcp@latest"],
  "env": {
    "SUPABASE_URL": "https://uromexjprcrjfmhkmgxa.supabase.co",
    "SUPABASE_ANON_KEY": "your_anon_key_here"
  }
}'
```

---

## Step-by-Step Setup Guide

### Prerequisites

- ✅ Claude Code installed and authenticated
- ✅ Node.js v20.x or v18.x (LTS) installed
- ✅ Supabase project credentials (URL + anon key)
- ✅ Access to `.env` file with Supabase credentials

### Step 1: Remove Old Failed Configuration

```bash
# List all MCP servers to confirm current state
claude mcp list

# Remove the failed SSE-based configuration
claude mcp remove supabase-api -s user

# Verify removal
claude mcp list
```

**Expected Output:**
```
✓ supabase-api has been removed
```

### Step 2: Verify Node.js Version

```bash
# Check current Node version
node --version

# If using Node 22, switch to Node 20 (recommended)
nvm install 20
nvm use 20
node --version  # Should show v20.x.x
```

**Why Node 20?**
- Supabase MCP has better compatibility with LTS versions
- libpg-query binaries are prebuilt for Node 18/20
- Node 22 can cause native module compilation issues

### Step 3: Get Your Supabase Credentials

**From your `.env` file:**
```bash
# Navigate to project directory
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"

# View Supabase credentials (DO NOT share these!)
grep VITE_SUPABASE .env
```

**You should see:**
```bash
VITE_SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Add Supabase MCP with stdio Transport

**Full Command (replace with your actual anon key):**
```bash
claude mcp add --transport stdio supabase \
  --env SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
  --env SUPABASE_ANON_KEY="your_actual_anon_key_here" \
  --scope user \
  -- npx -y @supabase/mcp@latest
```

**Command Breakdown:**
- `--transport stdio` → Use local stdio transport (fast, reliable)
- `supabase` → Server name (can be customized)
- `--env SUPABASE_URL=...` → Your Supabase project URL
- `--env SUPABASE_ANON_KEY=...` → Public anon key (safe to use)
- `--scope user` → Available across all your projects
- `--` → Separator between Claude flags and MCP server command
- `npx -y @supabase/mcp@latest` → Run latest Supabase MCP via npx

### Step 5: Verify Installation

```bash
# List all MCP servers with health check
claude mcp list
```

**Expected Output:**
```
Checking MCP server health...

supabase: ✓ Connected (stdio)
  Scope: User config (available in all your projects)
  Command: npx -y @supabase/mcp@latest
  Environment:
    SUPABASE_URL: https://uromexjprcrjfmhkmgxa.supabase.co
    SUPABASE_ANON_KEY: eyJ... (hidden)
```

### Step 6: Test in Claude Code

**Open Claude Code and run:**
```bash
/mcp
```

**You should see:**
- ✅ supabase (Connected)
- Available tools: execute_sql, list_tables, describe_table, etc.

**Test a simple query:**
```
Ask Claude: "Show me all tables in my Supabase database"
```

Claude should use the MCP server to execute the query and return results.

---

## Project-Specific Configuration

### Current Project Details

**Project**: Instagram Automation Dashboard
**Supabase Project Reference**: `uromexjprcrjfmhkmgxa`
**Supabase URL**: `https://uromexjprcrjfmhkmgxa.supabase.co`
**Environment File**: `.env` (gitignored)
**Example File**: `.env.example` (lines 50-54)

### Key Tables in Database

Based on project architecture:
- `user_profiles` → Instagram user data
- `admin_users` → Admin management
- `automation_workflows` → N8N workflow configs
- `instagram_accounts` → Connected accounts
- `engagement_data` → Comments/DMs tracking
- `analytics_reports` → Performance metrics
- `deletion_requests` → GDPR compliance

### MCP Server Capabilities for This Project

**What You Can Do with Supabase MCP:**

1. **Query User Data**
   ```sql
   SELECT * FROM user_profiles WHERE user_status = 'active';
   ```

2. **Check Workflow Status**
   ```sql
   SELECT workflow_name, status, last_run_at
   FROM automation_workflows
   WHERE user_id = 'xxx';
   ```

3. **Analytics Queries**
   ```sql
   SELECT DATE(created_at), COUNT(*) as daily_signups
   FROM user_profiles
   GROUP BY DATE(created_at)
   ORDER BY DATE(created_at) DESC;
   ```

4. **Schema Inspection**
   - List all tables
   - Describe table structure
   - View indexes and relationships

5. **Development Helpers**
   - Test RLS policies
   - Verify data integrity
   - Debug authentication flows

---

## Security Best Practices

### 🔴 CRITICAL: Never Commit These

```bash
# NEVER commit to git:
.env                    # Contains real credentials
~/.claude.json          # Contains MCP server configs with tokens
.mcp.json               # Project MCP configs (if contains secrets)
```

### ✅ What's Safe to Use

**Anon Key (Public)**
- ✅ Safe to use in MCP configuration
- ✅ Safe to expose in frontend code
- ✅ Protected by Row Level Security (RLS)
- ✅ Cannot bypass RLS policies

**Service Role Key (Private)**
- ❌ NEVER use in MCP server
- ❌ NEVER commit to git
- ❌ Backend-only (has full admin access)
- ❌ Bypasses all RLS policies

### Development vs Production

**Development (This Setup)**
```bash
Environment: Development database
Database: Non-production data
Access: Anon key (RLS-protected)
Scope: User-level (local machine only)
Risk Level: Low
```

**Production (NOT RECOMMENDED)**
```bash
⚠️ DO NOT connect MCP to production database
⚠️ Use development/staging environment only
⚠️ LLMs can make mistakes - never risk real user data
```

### Read-Only Mode (Optional)

If you must use real data:

```bash
# Add read-only configuration
claude mcp add --transport stdio supabase-readonly \
  --env SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
  --env SUPABASE_ANON_KEY="your_anon_key" \
  --env READ_ONLY=true \
  --scope user \
  -- npx -y @supabase/mcp@latest
```

**Note**: Check Supabase MCP documentation for read-only support.

### Project Scoping

**Limit to Specific Project:**
```bash
# Add project_ref to limit scope
claude mcp add --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=uromexjprcrjfmhkmgxa" \
  --scope user
```

This ensures the MCP server only has access to this specific Supabase project, not all projects in your organization.

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Failed to connect" Error

**Symptoms:**
```
supabase: ✗ Failed to connect
```

**Possible Causes & Solutions:**

1. **Wrong Node Version**
   ```bash
   # Check version
   node --version

   # If v22.x, switch to v20
   nvm use 20

   # Remove and re-add MCP server
   claude mcp remove supabase -s user
   claude mcp add --transport stdio supabase ...
   ```

2. **Invalid Credentials**
   ```bash
   # Verify your .env file has correct values
   grep VITE_SUPABASE .env

   # Test credentials manually
   curl https://uromexjprcrjfmhkmgxa.supabase.co/rest/v1/ \
     -H "apikey: your_anon_key"
   ```

3. **Network Issues**
   ```bash
   # Test connectivity
   ping uromexjprcrjfmhkmgxa.supabase.co

   # Check if Supabase is down
   curl https://status.supabase.com
   ```

#### Issue 2: "Tenant or user not found"

**This means wrong region configuration.**

**Solution:**
```bash
# Find your project region in Supabase Dashboard
# Settings → General → Region

# Add region to configuration
claude mcp add --transport stdio supabase \
  --env SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
  --env SUPABASE_ANON_KEY="your_key" \
  --env SUPABASE_REGION="us-west-1" \
  --scope user \
  -- npx -y @supabase/mcp@latest
```

**Common Regions:**
- `us-east-1` (US East)
- `us-west-1` (US West)
- `eu-west-1` (Europe)
- `ap-southeast-1` (Asia Pacific)

#### Issue 3: "@supabase/mcp@latest" Installation Fails

**Symptoms:**
```
Error: Package not found or version mismatch
```

**Solution:**
```bash
# Remove 'latest' tag (known workaround)
claude mcp add --transport stdio supabase \
  --env SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
  --env SUPABASE_ANON_KEY="your_key" \
  --scope user \
  -- npx -y @supabase/mcp@
  # Notice: no 'latest' after @
```

#### Issue 4: OAuth Authentication Loop (HTTP Transport)

**Symptoms:**
```
Authentication successful, but server reconnection failed.
You may need to manually restart Claude Code.
```

**Solution:**
1. Completely close VS Code (not just window)
2. Reopen VS Code
3. Run `/mcp` in Claude Code
4. If still failing, remove and re-add with stdio transport instead

#### Issue 5: Permission Denied Errors

**Symptoms:**
```
Error -32600: You do not have permission to perform this action
```

**Solutions:**

1. **Check RLS Policies**
   - Ensure your Supabase tables have proper RLS policies
   - Anon key respects RLS, service role bypasses it

2. **Verify Anon Key**
   ```bash
   # Wrong key (service_role instead of anon)
   ❌ Uses service_role JWT

   # Correct key (anon key from dashboard)
   ✅ Uses anon key from Settings → API
   ```

3. **Check Table Permissions**
   - Go to Supabase Dashboard → Authentication → Policies
   - Ensure policies allow SELECT/INSERT/UPDATE for anon role

#### Issue 6: MCP Tools Not Showing in `/mcp`

**Symptoms:**
```
/mcp shows server as connected but no tools listed
```

**Solution:**
```bash
# Restart Claude Code completely
# Close all VS Code windows
code --quit

# Reopen and test
/mcp
```

### Debug Commands

**View MCP Server Details:**
```bash
claude mcp get supabase
```

**View MCP Server Logs:**
```bash
# Check Claude Code debug logs
tail -f ~/.claude/debug/*.log
```

**Test npx Command Manually:**
```bash
# Test if npx can run the MCP server
SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
SUPABASE_ANON_KEY="your_key" \
npx -y @supabase/mcp@latest
```

---

## References

### Official Documentation

1. **Supabase MCP Official Docs**
   - [Model Context Protocol (MCP) | Supabase Docs](https://supabase.com/docs/guides/getting-started/mcp)
   - [MCP Server | Supabase Features](https://supabase.com/features/mcp-server)
   - [Enabling MCP Server Access](https://supabase.com/docs/guides/self-hosting/enable-mcp)

2. **Claude Code MCP Documentation**
   - [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
   - [Claude Code MCP CLI Commands](https://docs.claude.com/en/docs/claude-code/mcp)

3. **Model Context Protocol Specification**
   - [MCP Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
   - [stdio vs SSE vs StreamableHTTP](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/)

### Community Guides

4. **Setup Tutorials**
   - [How to use Supabase MCP with Claude Code - Composio](https://composio.dev/blog/supabase-mcp-with-claude-code)
   - [Claude Code + Supabase Integration Guide (Medium)](https://medium.com/@dan.avila7/claude-code-supabase-integration-complete-guide-with-agents-commands-and-mcp-427613d9051e)
   - [Claude Code MCP Workflow 2025](https://vladimirsiedykh.com/blog/claude-code-mcp-workflow-playwright-supabase-figma-linear-integration-2025)
   - [How to Add Supabase MCP to Claude Code](https://awatere.substack.com/p/how-to-add-supabase-mcp-to-claude)

5. **Troubleshooting Resources**
   - [VSCode Supabase MCP error · Issue #159](https://github.com/supabase-community/supabase-mcp/issues/159)
   - [BUG: MCP servers fail to connect · Issue #1611](https://github.com/anthropics/claude-code/issues/1611)
   - [Error -32600 Discussion](https://github.com/orgs/supabase/discussions/39362)
   - [MCP Server exits after startup · Issue #38](https://github.com/supabase-community/supabase-mcp/issues/38)

6. **Transport Protocol Comparisons**
   - [MCP Transport Protocols Comparison](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/)
   - [MCP Server Transports: STDIO, HTTP & SSE](https://docs.roocode.com/features/mcp/server-transports)
   - [One MCP Server, Two Transports](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/one-mcp-server-two-transports-stdio-and-http/4443915)

### GitHub Repositories

7. **Official & Community MCP Servers**
   - [supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)
   - [alexander-zuev/supabase-mcp-server](https://github.com/alexander-zuev/supabase-mcp-server)
   - [HenkDz/selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp)

---

## Quick Reference Card

### ✅ Recommended Setup (Copy-Paste Ready)

```bash
# 1. Switch to Node 20 LTS
nvm use 20

# 2. Remove old configuration (if exists)
claude mcp remove supabase-api -s user

# 3. Add Supabase MCP with stdio transport
claude mcp add --transport stdio supabase \
  --env SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co \
  --env SUPABASE_ANON_KEY="paste_your_anon_key_from_env_file" \
  --scope user \
  -- npx -y @supabase/mcp@latest

# 4. Verify installation
claude mcp list

# 5. Test in Claude Code
/mcp
```

### 🔍 Essential Commands

```bash
# List all MCP servers
claude mcp list

# Get server details
claude mcp get supabase

# Remove a server
claude mcp remove supabase -s user

# Check server health in Claude Code
/mcp
```

### 📋 Checklist

Before adding MCP server:
- [ ] Node.js v20.x or v18.x installed
- [ ] Supabase URL from `.env` file
- [ ] Supabase anon key from `.env` file
- [ ] Removed old failed configuration
- [ ] Verified project reference: `uromexjprcrjfmhkmgxa`

After adding MCP server:
- [ ] `claude mcp list` shows ✓ Connected
- [ ] `/mcp` in Claude Code shows available tools
- [ ] Test query works successfully
- [ ] No error messages in logs

---

## Appendix: Configuration Files

### A. Current MCP Configuration Locations

**User-level (Recommended for this project):**
```
~/.claude.json
  └─ Contains MCP server configurations
  └─ Available across all projects
  └─ Where our stdio config lives
```

**Project-level (Alternative):**
```
/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard/.mcp.json
  └─ Project-specific MCP servers
  └─ Can be version controlled (without secrets)
  └─ Currently not used
```

**VSCode Extension (Currently has Playwright only):**
```
.vscode/mcp-servers.json
  └─ VSCode extension MCP config
  └─ Only contains Playwright MCP
  └─ Separate from Claude Code CLI
```

### B. Environment Variables Reference

**From `.env.example` (lines 50-54):**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Actual values location:**
```bash
# In .env file (gitignored)
VITE_SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find in Supabase Dashboard:**
```
Supabase Dashboard → Settings → API
  └─ URL: Project URL (https://[project-ref].supabase.co)
  └─ anon public: API Key labeled "anon" or "public"
```

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-23 | Initial guide created after troubleshooting SSE failure | Claude + User |

---

## Feedback & Updates

This guide is a living document. If you encounter issues not covered here or find better solutions, please update this file to help future developers.

**Last tested configuration:**
- Date: 2025-12-23
- Claude Code Version: 2.0.x
- Node.js Version: v20.x / v22.x
- Supabase MCP Package: @supabase/mcp@latest
- Transport: stdio (recommended)
- Status: Pending verification

---

**End of Guide**
