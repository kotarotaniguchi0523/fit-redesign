import { Button, Card, CardBody, Link } from "@heroui/react";
import type { Slide } from "../types/index";

interface Props {
	slides: Slide[];
}

export function SlideSection({ slides }: Props) {
	return (
		<Card className="mb-4 bg-blue-50/30">
			<CardBody>
				<h3 className="text-lg font-semibold mb-4">📖 講義スライド</h3>
				<div className="space-y-2">
					{slides.map((slide) => (
						<div
							key={slide.id}
							className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
						>
							<span className="text-sm">{slide.title}</span>
							<Button
								as={Link}
								href={slide.pdfPath}
								target="_blank"
								size="sm"
								variant="flat"
								color="primary"
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
