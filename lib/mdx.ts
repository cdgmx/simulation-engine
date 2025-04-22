import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface GuideResource {
	title: string;
	url: string;
}

export interface GuideFrontmatter {
	id: string;
	title: string;
	tagline: string;
	tooltipBlurb: string;
	category: string;
	resources: GuideResource[];
}

export interface GuideEntry {
	slug: string;
	frontmatter: GuideFrontmatter;
}

export interface GuideContent extends GuideEntry {
	content: string;
}

function getContentPath(collection: string): string {
	return path.join(CONTENT_DIR, collection);
}

export function listGuides(collection: string): GuideEntry[] {
	const contentPath = getContentPath(collection);

	if (!fs.existsSync(contentPath)) {
		return [];
	}

	const files = fs.readdirSync(contentPath).filter((file) => {
		return file.endsWith(".mdx") || file.endsWith(".md");
	});

	const guides: GuideEntry[] = [];

	for (const file of files) {
		const filePath = path.join(contentPath, file);
		const fileContent = fs.readFileSync(filePath, "utf-8");
		const { data } = matter(fileContent);
		const slug = file.replace(/\.mdx?$/, "");

		guides.push({
			slug,
			frontmatter: data as GuideFrontmatter,
		});
	}

	return guides;
}

export function getGuideBySlug(
	collection: string,
	slug: string,
): GuideContent | null {
	const contentPath = getContentPath(collection);

	const mdxPath = path.join(contentPath, `${slug}.mdx`);
	const mdPath = path.join(contentPath, `${slug}.md`);

	let filePath: string | null = null;

	if (fs.existsSync(mdxPath)) {
		filePath = mdxPath;
	} else if (fs.existsSync(mdPath)) {
		filePath = mdPath;
	}

	if (!filePath) {
		return null;
	}

	const fileContent = fs.readFileSync(filePath, "utf-8");
	const { data, content } = matter(fileContent);

	return {
		slug,
		frontmatter: data as GuideFrontmatter,
		content,
	};
}

export function guideExists(collection: string, slug: string): boolean {
	const contentPath = getContentPath(collection);
	const mdxPath = path.join(contentPath, `${slug}.mdx`);
	const mdPath = path.join(contentPath, `${slug}.md`);

	return fs.existsSync(mdxPath) || fs.existsSync(mdPath);
}
