import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/*
  Raw HTML is deliberately not enabled (no rehype-raw), so announcement text
  cannot inject markup. Styling is done with an explicit component map rather
  than a typography plugin, to stay on the app's own tokens.
*/
const components: Components = {
  h1: ({ children }) => (
    <h3 className="mt-5 mb-2 font-heading text-base font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-5 mb-2 font-heading text-[15px] font-semibold tracking-tight first:mt-0">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="mt-4 mb-1.5 font-heading text-sm font-semibold first:mt-0">
      {children}
    </h5>
  ),
  h4: ({ children }) => (
    <h6 className="mt-4 mb-1.5 font-heading text-sm font-medium first:mt-0">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="my-2 text-pretty first:mt-0 last:mb-0">{children}</p>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  // remark-gfm marks checklists with `contains-task-list`; those get no bullets.
  ul: ({ children, className }) => {
    const isTaskList = (className ?? "").includes("contains-task-list");
    return (
      <ul
        className={cn(
          "my-2 space-y-1 first:mt-0 last:mb-0 [&_ul]:my-1",
          isTaskList ? "ml-0.5 list-none" : "ml-5 list-disc"
        )}
      >
        {children}
      </ul>
    );
  },
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-pretty marker:text-muted-foreground">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-xs">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-border" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg ring-1 ring-border">
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-muted/50 px-3 py-2 font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 last:border-0">
      {children}
    </td>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      className="my-3 max-w-full rounded-lg"
    />
  ),
  input: ({ checked, type }) =>
    type === "checkbox" ? (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-1.5 -mb-px size-3.5 accent-primary"
      />
    ) : null,
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[15px]/relaxed break-words text-foreground/90",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
