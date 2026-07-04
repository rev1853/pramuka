// Tiny DOM helpers. No framework, just clean element construction.

/** Create an element with attributes + children. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function button(label, opts = {}, onClick) {
  const node = el('button', {
    class: [
      'px-5 py-2.5 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
      opts.variant === 'secondary'
        ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
        : opts.variant === 'ghost'
          ? 'bg-transparent text-slate-600 hover:bg-slate-100'
          : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
      opts.class,
    ]
      .filter(Boolean)
      .join(' '),
    disabled: opts.disabled || false,
  }, label);
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

export function input(opts = {}) {
  return el('input', {
    type: opts.type || 'text',
    placeholder: opts.placeholder || '',
    value: opts.value ?? '',
    class:
      'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
    ...(opts.dataset ? { dataset: opts.dataset } : {}),
  });
}

export function card(...children) {
  return el('div', { class: 'bg-white rounded-2xl shadow-sm border border-slate-100 p-6' }, ...children);
}

export function heading(text, sub) {
  return el(
    'div',
    { class: 'text-center mb-8' },
    el('h1', { class: 'text-3xl font-extrabold text-slate-900' }, text),
    sub ? el('p', { class: 'text-slate-500 mt-2' }, sub) : null
  );
}

/** Mount a node into #app and clear previous content. */
export function mount(node) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.append(node);
}

export function toast(message, kind = 'error') {
  const colors = {
    error: 'bg-red-600',
    info: 'bg-slate-700',
    success: 'bg-emerald-600',
  };
  const t = el(
    'div',
    { class: `fixed top-5 left-1/2 -translate-x-1/2 ${colors[kind]} text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50` },
    message
  );
  document.body.append(t);
  setTimeout(() => t.remove(), 3000);
}