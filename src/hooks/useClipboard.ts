import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_DISPLAY_DURATION = 2000;

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
	const isMountedRef = useRef(true);

	// クリーンアップ: アンマウント時にタイマーをキャンセル
	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	/**
	 * テキストをクリップボードにコピーします。
	 * useCallbackを使用して参照を安定させているため、依存配列に含まれても不要な再レンダリングを防ぎます。
	 */
	const copy = useCallback(async (text: string): Promise<boolean> => {
		// 既存のタイマーをキャンセル
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		// 状態をリセット
		if (isMountedRef.current) {
			setIsCopied(false);
			setError(false);
		}

		// Clipboard API が存在しない場合
		if (!navigator.clipboard) {
			if (isMountedRef.current) {
				setError(true);
			}
			timeoutRef.current = window.setTimeout(() => {
				if (isMountedRef.current) {
					setError(false);
					timeoutRef.current = null;
				}
			}, FEEDBACK_DISPLAY_DURATION);
			return false;
		}

		try {
			await navigator.clipboard.writeText(text);
			if (isMountedRef.current) {
				setIsCopied(true);
			}

			timeoutRef.current = window.setTimeout(() => {
				if (isMountedRef.current) {
					setIsCopied(false);
					timeoutRef.current = null;
				}
			}, FEEDBACK_DISPLAY_DURATION);

			return true;
		} catch {
			if (isMountedRef.current) {
				setError(true);
			}

			timeoutRef.current = window.setTimeout(() => {
				if (isMountedRef.current) {
					setError(false);
					timeoutRef.current = null;
				}
			}, FEEDBACK_DISPLAY_DURATION);

			return false;
		}
	}, []);

	return { copy, isCopied, error };
}
