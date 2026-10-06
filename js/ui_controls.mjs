// Use the same monochrome, accessible settings control in every RuYi panel.
export function settingsIcon(button, label) {
    button.dataset.action = 'settings';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.2 3-.6 2.4-2 .9-2.2-.7-2 3.4 1.7 1.7-.2 2.3-1.5 1.7 2 3.4 2.3-.6 1.9 1.1.6 2.4h4l.6-2.4 2-1 2.3.5 2-3.4-1.7-1.7.1-2.3 1.6-1.7-2-3.4-2.3.6-1.9-1.1-.6-2.4z"/><circle cx="12" cy="12" r="3.2"/></svg>';
    Object.assign(button.style, {width:'28px', minWidth:'28px', height:'28px', padding:'4px', display:'inline-flex', alignItems:'center', justifyContent:'center', flex:'0 0 28px'});
    return button;
}

// These combinations are ComfyUI queue/front-of-queue/interrupt shortcuts.
// Editing shortcuts stay inside text fields; do not forward arbitrary keys.
export const isWorkflowShortcut = event => event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing;
