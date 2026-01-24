import { Accordion, AccordionItem } from "@heroui/react";
import { useState } from "react";

interface PdfViewerProps {
	pdfPath: string;
	title: string;
	defaultExpanded?: boolean;
}

export function PdfViewer({ pdfPath, title, defaultExpanded = false }: PdfViewerProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	// PDFパスが空または無効な場合は何も表示しない
	if (!pdfPath || pdfPath.trim() === "") {
		return null;
	}

	return (
		<Accordion
			variant="bordered"
			className="mt-4"
			defaultExpandedKeys={defaultExpanded ? ["pdf-viewer"] : []}
			onExpandedChange={(keys) => {
				const expandedKeys = keys as Set<string>;
				setIsExpanded(expandedKeys.has("pdf-viewer"));
			}}
		>
			<AccordionItem
				key="pdf-viewer"
				aria-label={`${title} PDF表示`}
				title={<span className="text-sm font-medium text-[#1e3a5f]">PDFを表示</span>}
				className="border-[#c9a227]/30"
			>
				{isExpanded && (
					<div className="relative w-full" style={{ paddingBottom: "75%" }}>
						<iframe
							src={pdfPath}
							className="absolute top-0 left-0 w-full h-full border rounded-lg shadow-sm"
							title={title}
							loading="lazy"
							onError={(e) => {
								console.error(`Failed to load PDF: ${pdfPath}`, e);
							}}
						/>
					</div>
				)}
				<p className="text-xs text-gray-500 mt-2">
					PDFが表示されない場合は、
					<a
						href={pdfPath}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[#1e3a5f] hover:text-[#c9a227] underline ml-1"
					>
						こちらから直接開いてください
					</a>
				</p>
			</AccordionItem>
		</Accordion>
	);
}
