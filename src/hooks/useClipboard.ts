import { useCallback, useEffect, useRef, useState } from "react";

interface UseClipboardReturn {
	copy: (text: string) => Promise<boolean>;
	isCopied: boolean;
	error: boolean;
}

/**
 * クリップボードへのコピー処理とコピー状態を管理するフック
 * コピー成功後、2秒間 isCopied が true になる
 * コピー失敗時、2秒間 error が true になる
 */
export function useClipboard(): UseClipboardReturn {
	const [isCopied, setIsCopied] = useState(false);
	const [error, setError] = useState(false);
	const timeoutRef = useRef<number | null>(null);

	// クリーンアップ: アンマウント時にタイマーをキャンセル
	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const copy = useCallback(async (text: string): Promise<boolean> => {
		// 既存のタイマーをキャンセル
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		// 状態をリセット
		setIsCopied(false);
		setError(false);

		// Clipboard API が存在しない場合
		if (!navigator.clipboard) {
			setError(true);
			timeoutRef.current = window.setTimeout(() => {
				setError(false);
				timeoutRef.current = null;
			}, 2000);
			return false;
		}

		try {
			await navigator.clipboard.writeText(text);
			setIsCopied(true);

			timeoutRef.current = window.setTimeout(() => {
				setIsCopied(false);
				timeoutRef.current = null;
			}, 2000);

			return true;
		} catch {
			setError(true);

			timeoutRef.current = window.setTimeout(() => {
				setError(false);
				timeoutRef.current = null;
			}, 2000);

			return false;
		}
	}, []);

	return { copy, isCopied, error };
}
