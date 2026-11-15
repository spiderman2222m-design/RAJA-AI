import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-sm sm:prose-base max-w-none prose-headings:text-[#F4F1EA] prose-headings:font-semibold prose-p:text-[#E5E0EC] prose-p:leading-relaxed prose-strong:text-[#F3D578] prose-a:text-[#A78BFA] prose-li:text-[#E5E0EC] prose-table:border-white/10 prose-th:text-[#D4AF37] prose-td:border-white/10">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const raw = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || raw.includes('\n');

            if (!isBlock) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-[#1F1A2E] text-[#F3D578] font-mono-tabular text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match?.[1] || 'code'} code={raw} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0B0912]">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#14111F] border-b border-white/10 text-xs text-[#9E97AD]">
        <span className="font-mono-tabular lowercase">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F3D578] transition-colors py-0.5 px-2 rounded"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs sm:text-sm font-mono-tabular text-[#EAE6F3] leading-relaxed m-0">
        <code>{code}</code>
      </pre>
    </div>
  );
}
