import { QuestionTimer } from "../components/QuestionTimer";

export function VerificationPage() {
	return (
		<div className="p-10 flex flex-col gap-10 bg-white min-h-screen">
			<h1 className="text-2xl font-bold">Verification Page</h1>
			<div className="border p-4 w-[400px]">
				<h2 className="mb-4 font-semibold">Question Timer</h2>
				{/* Use a valid ID from the type definition to satisfy TypeScript */}
				<QuestionTimer questionId="exam1-2013-q1" />
			</div>
		</div>
	);
}
