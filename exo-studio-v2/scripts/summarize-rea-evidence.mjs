#!/usr/bin/env node
// Summarize a potentially enormous, immutable REA analysis Evidence record.
// Only metadata and counts are saved in the Garment Studio repository.
// Keep the upstream full record only in /tmp or compressed in Git-ignored
// replica/evidence/raw; never add private projects or vendor avatar assets
// to a public/committable reverse-engineering evidence bundle.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const input = process.argv[2]
const output = process.argv[3] || 'replica/evidence/rea-own-garment-js-2026-10-14.json'
if (!input) {
  console.error('Usage: node scripts/summarize-rea-evidence.mjs <rea-full-json> [summary-out.json]')
  process.exit(2)
}
const evidence = JSON.parse(readFileSync(input, 'utf8'))
assert.equal(evidence.operation, 'analyze_javascript_application')
assert.equal(evidence.provider?.id, 'rea-javascript-application')
const result = evidence.normalized_result
assert.ok(result?.graph && result?.statistics, 'REA must provide a validated application graph')
const counts = arr => Array.isArray(arr) ? arr.length : 0
const byKind = (arr, property) => Object.fromEntries(
  Object.entries((arr || []).reduce((totals, item) => {
    const kind = item?.[property] || item?.relation || item?.type || 'unclassified'
    totals[kind] = (totals[kind] || 0) + 1
    return totals
  }, {})).sort(([a], [b]) => a.localeCompare(b)),
)
const summary = {
  source: 'https://github.com/morluto/rea',
  upstreamVersion: '6.5.0',
  upstreamCommitReviewed: '9a44fea3479a2ad463fdad2b14e86b412717f771',
  target: 'Garment Studio built JavaScript and HTML only (no avatars or user projects)',
  evidenceId: evidence.evidence_id,
  artifactHashSha256: evidence.subject?.digest?.sha256 || result.root_artifact_sha256,
  mode: 'read-only shipped-artifact static reconstruction',
  authority: evidence.authority,
  summary: result.summary,
  statistics: result.statistics,
  graph: {
    id: result.graph.graph_id,
    coverage: result.graph.coverage,
    nodes: counts(result.graph.nodes),
    edges: counts(result.graph.edges),
    rootNodes: counts(result.graph.root_node_ids),
    nodeKinds: byKind(result.graph.nodes, 'kind'),
    edgeKinds: byKind(result.graph.edges, 'kind'),
  },
  limitations: result.limitations || [],
  conclusions: [
    'REA successfully parsed the shipped Garment Studio JavaScript without executing it.',
    'The shipped JS contains no inferred Electron BrowserWindow/IPC interfaces; this is expected for the Swift/WebKit shell, not evidence of absent macOS integration.',
    'Static module and boundary findings do not prove that CAD tools work, that the original source is complete, or that native garment physics is correct.',
    'The report contains no runtime trace, no inspected CLO3D source, and no visual CLO comparison score.',
  ],
}
mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify({
  success: true, evidenceId: summary.evidenceId,
  filesParsed: result.statistics.parsed_javascript_files,
  findings: result.statistics.findings,
  graphNodes: summary.graph.nodes,
  graphEdges: summary.graph.edges,
  parseFailures: result.statistics.parse_failures,
  coverage: summary.graph.coverage,
  output,
}, null, 2))
