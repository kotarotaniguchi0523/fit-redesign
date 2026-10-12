import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { RecordsView } from '../features/progress/ui/records-view.tsx'
import { PageHeading } from '../ui/PageHeading.tsx'
import { Document } from './document.tsx'

const mainStyle = css({ maxWidth: '52rem', margin: '0 auto', padding: '1rem 1rem 4rem' })

/** 学習記録ページ。端末内の記録と同期設定を `RecordsView`（clientEntry）が描く。 */
export function RecordsPage(handle: Handle<{ currentPath: string }>) {
	return () => (
		<Document title="学習記録 - 基本情報技術 I" noindex currentPath={handle.props.currentPath}>
			<main id="main-content" mix={mainStyle}>
				<PageHeading
					eyebrow="記録"
					title="学習記録"
					description="答えを確認した問題と小テストの結果は、この端末に保存されます。"
				/>
				<RecordsView currentPath={handle.props.currentPath} />
			</main>
		</Document>
	)
}
