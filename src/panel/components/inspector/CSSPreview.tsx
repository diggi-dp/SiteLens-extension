import { useState } from 'react';
import { exportElementCSS } from '../../../shared/utils/exportUtils';

interface CSSPreviewProps {
  styles: Record<string, string>;
  selector: string;
}

export default function CSSPreview({ styles, selector }: CSSPreviewProps) {
  const [copied, setCopied] = useState(false);

  const code = exportElementCSS(styles, selector, 'css');

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const highlightCSS = (css: string) =>
    css.split('\n').map((line, i) => {
      if (line.includes('{') || line.includes('}')) {
        const parts = line.split(/([{}])/);
        return (
          <div key={i}>
            {parts.map((part, j) => {
              if (part === '{' || part === '}') return <span key={j} className="code-brace">{part}</span>;
              if (part.trim()) return <span key={j} className="code-selector">{part}</span>;
              return part;
            })}
          </div>
        );
      }
      const propMatch = line.match(/^(\s*)([\w-]+)(\s*:\s*)(.+)(;)$/);
      if (propMatch) {
        return (
          <div key={i}>
            {propMatch[1]}
            <span className="code-prop">{propMatch[2]}</span>
            {propMatch[3]}
            <span className={propMatch[4].startsWith('var(') ? 'code-var' : 'code-value'}>{propMatch[4]}</span>
            {propMatch[5]}
          </div>
        );
      }
      return <div key={i}>{line}</div>;
    });

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="code-block-header" style={{ paddingLeft: 2 }}>
        <span>CSS Preview</span>
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={copy}>
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>
      <div className="code-block">
        {highlightCSS(code)}
      </div>
    </div>
  );
}
