import type { MDXComponents } from "mdx/types";
import type {
	AnchorHTMLAttributes,
	HTMLAttributes,
	ReactElement,
	ReactNode,
} from "react";
import { Mermaid } from "./mermaid";

interface CodeProps {
	children?: ReactNode;
	className?: string;
}

function getCodeString(children: ReactNode): string | null {
	if (!children) {
		return null;
	}

	if (typeof children === "string") {
		return children;
	}

	if (Array.isArray(children)) {
		return children.map((child) => getCodeString(child) ?? "").join("");
	}

	if (typeof children === "object") {
		const element = children as ReactElement<{ children?: ReactNode }>;
		return getCodeString(element.props?.children);
	}

	return null;
}

function Code({ children, className }: CodeProps) {
	// If it has a language class, it's likely a code block inside a pre,
	// so we let the Pre component handle the container styling.
	// We only style inline code (which usually doesn't have a language class).
	const isBlock = className?.includes("language-");

	if (isBlock) {
		return <code className={className}>{children}</code>;
	}

	return (
		<code
			className={`${className ?? ""} rounded bg-slate-800/80 px-1.5 py-0.5 text-sm text-sky-300`}
		>
			{children}
		</code>
	);
}

interface PreProps {
	children?: ReactNode;
}

interface CodeProps {
	children?: ReactNode;
	className?: string;
}

function Pre({ children }: PreProps) {
	const childArray = Array.isArray(children) ? children : [children];

	const mermaidChild = childArray.find((child) => {
		if (!child || typeof child !== "object" || !("props" in child)) {
			return false;
		}
		const props = (child as ReactElement<CodeProps>).props;
		return props?.className?.includes("language-mermaid");
	});

	if (mermaidChild) {
		const codeString = getCodeString(
			(mermaidChild as ReactElement<CodeProps>).props.children,
		)?.trim();
		if (codeString) {
			return (
				<div className="my-6 overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 p-4">
					<Mermaid chart={codeString} className="flex justify-center" />
				</div>
			);
		}
	}

	return (
		<pre className="my-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 p-4 text-sm leading-relaxed text-slate-200">
			{children}
		</pre>
	);
}

type ElementProps = HTMLAttributes<HTMLElement>;
type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export const mdxComponents: MDXComponents = {
	h1: ({ children }: ElementProps) => (
		<h1 className="mb-6 text-3xl font-semibold tracking-tight text-white md:text-4xl">
			{children}
		</h1>
	),
	h2: ({ children }: ElementProps) => (
		<h2 className="mb-4 mt-10 text-xl font-semibold tracking-tight text-slate-50 first:mt-0">
			{children}
		</h2>
	),
	h3: ({ children }: ElementProps) => (
		<h3 className="mb-3 mt-8 text-lg font-semibold text-slate-100">
			{children}
		</h3>
	),
	p: ({ children }: ElementProps) => (
		<p className="mb-4 text-base leading-7 text-slate-200">{children}</p>
	),
	ul: ({ children }: ElementProps) => (
		<ul className="mb-4 list-disc space-y-2 pl-5 text-slate-300">{children}</ul>
	),
	ol: ({ children }: ElementProps) => (
		<ol className="mb-4 list-decimal space-y-2 pl-5 text-slate-300">
			{children}
		</ol>
	),
	li: ({ children }: ElementProps) => (
		<li className="text-base leading-7">{children}</li>
	),
	strong: ({ children }: ElementProps) => (
		<strong className="font-semibold text-slate-100">{children}</strong>
	),
	em: ({ children }: ElementProps) => (
		<em className="italic text-slate-300">{children}</em>
	),
	a: ({ href, children }: AnchorProps) => (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="text-sky-300 underline underline-offset-2 transition hover:text-sky-200"
		>
			{children}
		</a>
	),
	blockquote: ({ children }: ElementProps) => (
		<blockquote className="my-4 border-l-4 border-sky-500/50 pl-4 italic text-slate-300">
			{children}
		</blockquote>
	),
	hr: () => <hr className="my-8 border-white/10" />,
	code: Code,
	pre: Pre,
};
