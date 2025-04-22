import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { GuideArticle, mdxComponents } from "@/components/content";
import { getGuideBySlug, guideExists } from "@/lib/mdx";

interface PageProps {
	params: Promise<{ pattern: string }>;
}

export default async function PatternGuidePage({ params }: PageProps) {
	const resolvedParams = await params;
	const { pattern } = resolvedParams;

	if (!guideExists("guides", pattern)) {
		notFound();
	}

	const guide = getGuideBySlug("guides", pattern);

	if (!guide) {
		notFound();
	}

	const breadcrumbs = [
		{ label: "Simulator", href: "/" },
		{ label: "Patterns", href: "/learn/patterns" },
		{ label: guide.frontmatter.title },
	];

	return (
		<GuideArticle frontmatter={guide.frontmatter} breadcrumbs={breadcrumbs}>
			<MDXRemote
				source={guide.content}
				components={mdxComponents}
				options={{
					mdxOptions: {
						remarkPlugins: [remarkGfm],
					},
				}}
			/>
		</GuideArticle>
	);
}
