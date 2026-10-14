import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/**
 * Renders plan markdown. Output is sanitized (SPEC.md section 11), so text that came
 * from the model or was pasted into the editor cannot inject HTML or scripts.
 */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose-plan ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
