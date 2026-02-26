/**
 * AgentTerminal.tsx
 *
 * Lazy-loaded page wrapper for the Agent Terminal Dashboard.
 * Imports terminal-scoped CSS (JetBrains Mono, cursor, scrollbar)
 * only when this page is mounted — keeps main bundle clean.
 */

import '../styles/terminal.css'
import AgentTerminalDashboard from '../components/agent-terminal/AgentTerminalDashboard'

export default function AgentTerminal() {
  return <AgentTerminalDashboard />
}
