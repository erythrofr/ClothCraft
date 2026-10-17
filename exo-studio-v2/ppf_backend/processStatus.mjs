// Idle PPF listeners persist after disconnect in the packaged runtime. They
// are not simulation jobs; the runner's runtime flock still serializes work.
export function hasActivePpfWork(commands) {
  return commands.split(/\r?\n/).some(command =>
    /\/ppf-contact-solver(?:\s|$)/.test(command) ||
    /\/Blender\s.*(?:--python\s+\S*ppf_run_configured\.py)/.test(command))
}
