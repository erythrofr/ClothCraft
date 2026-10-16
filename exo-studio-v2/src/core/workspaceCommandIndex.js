// Search only implemented actions. These call the same existing action
// dispatcher as the genuine macOS menubar, never placeholders or demo stubs.
export const EXTRA_WORKSPACE_COMMANDS = Object.freeze([
  { label: 'Show both 3D and 2D windows', group: 'Workspace', action: 'workspace.view.split', keywords: 'side by side divide panels' },
  { label: 'Maximize 3D garment window', group: 'Workspace', action: 'workspace.view.3d', keywords: 'focus show 3d only' },
  { label: 'Maximize 2D pattern window', group: 'Workspace', action: 'workspace.view.2d', keywords: 'focus show 2d only' },
  { label: 'Reset 3D and 2D divider', group: 'Workspace', action: 'workspace.view.reset', keywords: 'equal fifty fifty split resize' },
  { label: 'Show or hide Object Browser', group: 'Workspace', action: 'workspace.panel.objects', keywords: 'inspector scene tree' },
  { label: 'Show or hide asset Library', group: 'Workspace', action: 'workspace.panel.toggle-library', keywords: 'sidebar expand collapse dock' },
  { label: 'Show or hide Property Editor', group: 'Workspace', action: 'workspace.panel.toggle-inspector', keywords: 'inspector dock sidebar properties' },
  { label: 'Open Library panel', group: 'Workspace', action: 'workspace.panel.library', keywords: 'browse asset sidebar' },
  { label: 'Open History panel', group: 'Workspace', action: 'workspace.panel.history', keywords: 'undo redo history sidebar' },
])

export function indexWorkspaceCommands(menus) {
  const commands = []
  const seen = new Set()
  for (const menu of menus) {
    for (const [label, action] of menu.commands || []) {
      if (typeof action !== 'string' || !action || seen.has(action)) continue
      seen.add(action)
      commands.push({ label, group: menu.title, action, keywords: '' })
    }
  }
  for (const command of EXTRA_WORKSPACE_COMMANDS) {
    if (!seen.has(command.action)) commands.push(command)
  }
  return commands
}

export function searchWorkspaceCommands(commands, query, maxResults = 30) {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  const candidates = commands.map((command, position) => {
    const label = command.label.toLowerCase()
    const searchable = `${label} ${command.group.toLowerCase()} ${command.keywords || ''}`
    if (!terms.every(term => searchable.includes(term))) return null
    const relevance = terms.length === 0 ? 0 : terms.reduce((score, term) =>
      score + (label.startsWith(term) ? 10 : label.includes(term) ? 5 : 1), 0)
    return { ...command, position, relevance }
  }).filter(Boolean)
  return candidates.sort((a, b) => b.relevance - a.relevance || a.position - b.position).slice(0, maxResults)
}
