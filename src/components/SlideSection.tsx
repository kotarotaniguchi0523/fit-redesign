import { Button, Card, CardBody, Link } from "@heroui/react";
import type { Slide } from "../types/index";

interface Props {
	slides: Slide[];
}

export function SlideSection({ slides }: Props) {
	return (
		<Card className="mb-4 bg-linear-to-br from-blue-50/50 to-indigo-50/30 border border-blue-100">
			<CardBody className="p-5">
				<h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#1e3a5f]">
					<span className="w-8 h-8 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
						📖
					</span>
					講義スライド
				</h3>
				<div className="space-y-2">
					{slides.map((slide) => (
						<div
							key={slide.id}
							className="flex flex-col gap-2 p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100 sm:flex-row sm:items-center sm:justify-between"
						>
							<span className="text-sm text-gray-700 break-words">{slide.title}</span>
							<Button
								as={Link}
								href={slide.pdfPath}
								target="_blank"
								rel="noopener noreferrer"
								size="sm"
								variant="flat"
								className="w-full bg-[#1e3a5f] text-white hover:bg-[#2d4a6f] sm:w-auto"
							>
								開く ↗
							</Button>
						</div>
					))}
				</div>
			</CardBody>
		</Card>
	);
}
