export const TASK_STEP_TYPES = [
  'research',
  'review',
  'prepare_message',
  'send_email',
  'handle_responses',
  'action',
  'verify',
] as const;

export function looksLikeComplexChain(value: unknown) {
  const text = String(value || '').toLowerCase();
  const verbs = ['find', 'research', 'compare', 'review', 'analyze', 'rank', 'recommend', 'draft', 'write', 'send', 'email', 'message', 'check replies', 'handle responses', 'respond', 'follow up', 'verify'];
  const count = verbs.filter((v) => text.includes(v)).length;
  return count >= 3 || /\b(first|then|after that|next|based on (?:that|the review)|another task|another one|one task).*(then|after|another|send|review|respond)/i.test(text);
}

export function normalizeTaskSteps(raw: unknown) {
  const list = Array.isArray(raw) ? raw : [];
  const steps = list.slice(0, 5).map((step: any, index) => {
    const type = TASK_STEP_TYPES.includes(step?.type) ? step.type : 'review';
    const id = String(step?.id || `step-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || `step-${index + 1}`;
    return {
      id,
      label: String(step?.label || step?.instruction || `Step ${index + 1}`).trim().slice(0, 100),
      type,
      instruction: String(step?.instruction || '').trim().slice(0, 1200),
      depends_on: index === 0 ? [] : [String(step?.depends_on?.[0] || list[index - 1]?.id || `step-${index}`).slice(0, 40)],
      approval_required: step?.approval_required === true || type === 'send_email',
      status: 'pending',
    };
  }).filter((step) => step.instruction);
  return steps.length > 1 ? steps : [];
}

export function taskStepsToOrchestration(steps: any[]) {
  const mapKind = (type: string) => {
    if (type === 'research') return 'web_research';
    if (type === 'review' || type === 'prepare_message') return 'reasoning';
    if (type === 'verify') return 'verify';
    if (type === 'send_email' || type === 'handle_responses' || type === 'action') return 'connected_action';
    return 'reasoning';
  };
  return (Array.isArray(steps) ? steps : []).slice(0, 5).map((step, index) => ({
    id: String(step?.id || `step-${index + 1}`).slice(0, 40),
    label: String(step?.label || `Step ${index + 1}`).slice(0, 100),
    kind: mapKind(String(step?.type || 'review')),
    instruction: String(step?.instruction || step?.label || '').slice(0, 1200),
    depends_on: Array.isArray(step?.depends_on) ? step.depends_on.filter(Boolean).slice(0, 4) : [],
    approval_required: step?.approval_required === true || step?.type === 'send_email',
    task_type: String(step?.type || 'review'),
  })).filter((step) => step.instruction);
}

export function taskStepPromptLines(steps: any[]) {
  const clean = Array.isArray(steps) ? steps.filter(Boolean).slice(0, 5) : [];
  if (!clean.length) return [];
  return [
    'This request is a multi-step handoff. Complete steps in order and pass the output of each completed step into the next step:',
    ...clean.map((s, index) => `${index + 1}. ${String(s.label || s.instruction || '').slice(0, 120)} — ${String(s.instruction || '').slice(0, 500)}${s.approval_required ? ' [requires user approval before any outside change]' : ''}`),
    'Do not skip a dependency. Do not claim a send, booking, post, payment, deletion, or outside change happened unless the connected action actually completed after approval.',
  ];
}
