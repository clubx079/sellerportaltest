// /components/forms/TextEditor.js
'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Bold, Italic, List } from 'lucide-react';

const HEADING_STYLES = {
  H1: 'font-size:32px; font-weight:700; line-height:1.25; margin:16px 0 8px;',
  H2: 'font-size:26px; font-weight:600; line-height:1.3; margin:14px 0 7px;',
  H3: 'font-size:22px; font-weight:600; line-height:1.35; margin:12px 0 6px;',
  H4: 'font-size:18px; font-weight:600; line-height:1.4; margin:10px 0 5px;',
};
const UL_STYLE = 'list-style:disc; padding-left:24px; margin:10px 0;';

/* ---------- CLEAN HTML EXPORT ---------- */
function getCleanHTMLFrom(root) {
  if (!root) return '';
  const doc = root.cloneNode(true);

  // Normalize <b>/<i>
  doc.querySelectorAll('b').forEach(b => {
    const s = document.createElement('strong');
    s.innerHTML = b.innerHTML;
    b.replaceWith(s);
  });
  doc.querySelectorAll('i').forEach(i => {
    const e = document.createElement('em');
    e.innerHTML = i.innerHTML;
    i.replaceWith(e);
  });

  // Remove editor-only attributes
  doc.querySelectorAll('[contenteditable],[data-placeholder]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-placeholder');
  });

  // Strip inline styles/classes
  doc.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
  doc.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

  // Remove empty <p> (just whitespace or <br>)
  const isEmptyPara = (p) => {
    const text = (p.textContent || '').replace(/\u00A0|\s/g, '');
    const onlyBr = p.childNodes.length === 1 &&
                   p.firstChild.nodeType === 1 &&
                   p.firstChild.tagName === 'BR';
    return !text || onlyBr;
  };
  doc.querySelectorAll('p').forEach(p => {
    if (isEmptyPara(p)) p.remove();
  });

  // Trim <br> at block boundaries
  const trimBr = (el) => {
    while (el.firstChild && el.firstChild.tagName === 'BR') el.removeChild(el.firstChild);
    while (el.lastChild && el.lastChild.tagName === 'BR') el.removeChild(el.lastChild);
  };
  trimBr(doc);
  doc.querySelectorAll('p,ul,ol,li').forEach(trimBr);

  // Ensure <ul> only has <li>
  doc.querySelectorAll('ul').forEach(ul => {
    [...ul.childNodes].forEach(n => {
      if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
        const li = document.createElement('li');
        li.textContent = n.textContent.trim();
        ul.insertBefore(li, n);
        n.remove();
      } else if (n.nodeType === 1 && n.tagName !== 'LI') {
        const li = document.createElement('li');
        li.innerHTML = n.innerHTML;
        ul.insertBefore(li, n);
        n.remove();
      }
    });
  });

  // Collapse accidental duplicate blanks
  const walker = document.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
  let prevBlock = null;
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (['P', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4'].includes(el.tagName)) {
      if (prevBlock && el.previousElementSibling === prevBlock && !el.textContent.trim()) {
        el.remove();
      } else {
        prevBlock = el;
      }
    }
  }

  trimBr(doc);
  return doc.innerHTML.trim();
}

/* ---------- MAIN EDITOR ---------- */
const TextEditor = forwardRef(function TextEditor(
  { content = '', placeholder = 'Start typing...', id },
  ref
) {
  const editorRef = useRef(null);

  const styleNode = (node) => {
    if (!node || node.nodeType !== 1) return;
    const tag = node.tagName;
    if (HEADING_STYLES[tag]) node.setAttribute('style', HEADING_STYLES[tag]);
    if (tag === 'UL') node.setAttribute('style', UL_STYLE);
  };
  const applyVisualStyles = (root) => {
    root.querySelectorAll('h1,h2,h3,h4,ul').forEach(styleNode);
  };

  // Mount initial content
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = content || '<p><br></p>';
    applyVisualStyles(el);
  }, [content]);

  // Expose clean/get/set APIs
  useImperativeHandle(ref, () => ({
    getHTML: () => editorRef.current?.innerHTML || '',
    getCleanHTML: () =>
      editorRef.current ? getCleanHTMLFrom(editorRef.current) : '',
    setHTML: (html) => {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = html || '<p><br></p>';
      applyVisualStyles(el);
    },
  }));

  // Commands
  const run = (cmd, val = null) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(cmd, false, val);
    applyVisualStyles(el);
  };

  // Paste plain text
  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain') || '';
    const frag = document.createDocumentFragment();
    text.split(/\r?\n/).forEach((line) => {
      const p = document.createElement('p');
      if (line) p.textContent = line;
      else p.appendChild(document.createElement('br'));
      frag.appendChild(p);
    });
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      r.deleteContents();
      r.insertNode(frag);
      sel.collapseToEnd();
    }
    applyVisualStyles(editorRef.current);
  };

  // Shortcuts
  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      run('bold');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      run('italic');
    }
  };

  return (
    <div className="border-2 border-neutral-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-neutral-200 bg-neutral-50">
        <button
          type="button"
          title="Bold"
          onClick={() => run('bold')}
          className="p-2 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <Bold size={16} className="text-neutral-700" />
        </button>
        <button
          type="button"
          title="Italic"
          onClick={() => run('italic')}
          className="p-2 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <Italic size={16} className="text-neutral-700" />
        </button>
        <button
          type="button"
          title="Bullets"
          onClick={() => run('insertUnorderedList')}
          className="p-2 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <List size={16} className="text-neutral-700" />
        </button>
        <select
          aria-label="Heading"
          defaultValue="<p>"
          onChange={(e) => run('formatBlock', e.target.value)}
          className="ml-2 px-2 py-1 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#472F97]"
        >
          <option value="<p>">Normal</option>
          <option value="<h1>">H1</option>
          <option value="<h2>">H2</option>
          <option value="<h3>">H3</option>
          <option value="<h4>">H4</option>
        </select>
      </div>

      {/* Editor */}
      <div
        id={id}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        dir="ltr"
        style={{
          direction: 'ltr',
          textAlign: 'left',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
        className="min-h-[200px] p-4 text-neutral-900 focus:outline-none"
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        spellCheck={true}
      />

      {/* Placeholder */}
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          font-style: italic;
        }
      `}</style>
    </div>
  );
});

export default TextEditor;
