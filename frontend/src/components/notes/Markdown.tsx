import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown seguro: sin HTML crudo (react-markdown lo escapa y no usamos rehype-raw)
 * y con los enlaces en pestaña nueva.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-zinc prose-sm max-w-none break-words prose-a:text-accent prose-headings:tracking-tight prose-pre:bg-zinc-100 prose-pre:text-zinc-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, title, children }) => <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
