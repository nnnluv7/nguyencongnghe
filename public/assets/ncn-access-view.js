export function setAccessView({root, gate, content}, phase) {
  root.dataset.ncnAccessPhase = phase;
  root.setAttribute('aria-busy', String(phase === 'pending'));
  const visible = phase === 'pending' || phase === 'ready';
  gate.hidden = visible;
  content.hidden = !visible;
  content.inert = phase === 'pending';
}
