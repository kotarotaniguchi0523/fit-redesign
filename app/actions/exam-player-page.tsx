import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { ExamPlayer } from '../features/challenge/player/exam-player.tsx'
import type { ExamPlayerProps, PlayerQuestion } from '../features/challenge/player/types.ts'
import { PageHeading } from '../ui/PageHeading.tsx'
import { Document } from './document.tsx'

const mainStyle = css({
	maxWidth: '52rem',
	margin: '0 auto',
	padding: '1rem 1rem 4rem',
})

/**
 * 小テスト / タイムアタックのプレイヤーページ。
 * サーバーは静的な問題プレビューを描き、クライアントで `ExamPlayer`（clientEntry）が
 * localStorage からセッションを復元して操作可能になる。
 */
export function ExamPlayerPage(
	handle: Handle<{
		playerTitle: string
		heading: string
		description?: string
		player: ExamPlayerProps
		currentPath: string
	}>,
) {
	return () => {
		const { playerTitle, heading, description, player, currentPath } = handle.props

		return (
			<Document title={`${heading} - 基本情報技術 I`} noindex currentPath={currentPath}>
				<main id="main-content" mix={mainStyle}>
					<PageHeading eyebrow="小テスト" title={heading} description={description} />
					<ExamPlayer {...player} />
				</main>
			</Document>
		)
	}
}

export type { PlayerQuestion }
