import { QuestionTimer } from "../components/QuestionTimer";

export default function StartButtonCheck() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
			<div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
				<h1 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">Button Verification</h1>
				<div className="flex justify-center py-8">
					<QuestionTimer questionId="exam1-2013-q1" />
				</div>
				<p className="mt-4 text-sm text-gray-500">
					This component isolates the QuestionTimer for visual verification.
				</p>
			</div>
		</div>
	);
}
