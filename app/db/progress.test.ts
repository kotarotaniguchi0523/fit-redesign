import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { ChallengeConflictError, SyncLinkNotFoundError } from './progress.ts'
import {
	createSyncLink,
	deleteSyncLink,
	findSyncLink,
	syncChallenges,
	syncProgress,
} from './progress.ts'
import { createTestDatabase } from './test-support.ts'
import { syncLinkIdFromSyncKey } from '../lib/syncLinkId.ts'
import type { SyncKey } from '../types/index.ts'

/** 43 文字の URL-safe Base64（SyncKeySchema を満たす固定値）。 */
function fixedSyncKey(seed: string): SyncKey {
	const base = seed.repeat(64).slice(0, 43)
	return base as SyncKey
}

async function setupLink(seed = 'A') {
	const db = createTestDatabase()
	const key = fixedSyncKey(seed)
	const id = await syncLinkIdFromSyncKey(key)
	await createSyncLink(db, id, 1000)
	return { db, id }
}

describe('progress repository (data-table + D1 driver)', () => {
	it('createSyncLink then findSyncLink', async () => {
		const { db, id } = await setupLink()
		assert.equal(await findSyncLink(db, id), true)
	})

	it('syncProgress merges latest updated_at and earliest created_at', async () => {
		const { db, id } = await setupLink()

		await syncProgress(db, id, [
			{ questionId: 'exam1-2013-q1', unitId: 'unit-base-conversion', createdAt: 100, updatedAt: 200 },
		])
		const merged = await syncProgress(db, id, [
			{ questionId: 'exam1-2013-q1', unitId: 'unit-base-conversion', createdAt: 50, updatedAt: 300 },
		])

		assert.equal(merged.length, 1)
		assert.equal(merged[0]?.createdAt, 50)
		assert.equal(merged[0]?.updatedAt, 300)
	})

	it('syncProgress rejects an unknown sync link', async () => {
		const db = createTestDatabase()
		const id = await syncLinkIdFromSyncKey(fixedSyncKey('Z'))

		await assert.rejects(() =>
			syncProgress(db, id, [
				{ questionId: 'exam1-2013-q1', unitId: 'unit-base-conversion', createdAt: 1, updatedAt: 2 },
			]),
		)
	})

	it('deleteSyncLink removes the link', async () => {
		const { db, id } = await setupLink()
		await deleteSyncLink(db, id)
		assert.equal(await findSyncLink(db, id), false)
	})

	it('syncChallenges stores a challenge with answers and is idempotent', async () => {
		const { db, id } = await setupLink('B')
		const payload = {
			challengeId: '3f1a2b4c-1111-4111-8111-111111111111',
			examId: 'exam1-2013',
			createdAt: 1000,
			updatedAt: 2000,
			answers: [
				{
					questionId: 'exam1-2013-q1',
					elapsedMs: 5000,
					judgment: 'correct' as const,
					createdAt: 1500,
					updatedAt: 2000,
				},
			],
		}

		const first = await syncChallenges(db, id, [payload])
		assert.equal(first.length, 1)
		assert.equal(first[0]?.answers.length, 1)

		// 同じ payload の再送は変化なし
		const second = await syncChallenges(db, id, [payload])
		assert.equal(second.length, 1)
	})

	it('syncChallenges rejects the same id with different data (409 semantics)', async () => {
		const { db, id } = await setupLink('C')
		const base = {
			challengeId: '3f1a2b4c-2222-4222-8222-222222222222',
			examId: 'exam1-2013',
			createdAt: 1000,
			updatedAt: 2000,
			answers: [
				{
					questionId: 'exam1-2013-q1',
					elapsedMs: 5000,
					judgment: 'correct' as const,
					createdAt: 1500,
					updatedAt: 2000,
				},
			],
		}
		await syncChallenges(db, id, [base])

		await assert.rejects(
			() =>
				syncChallenges(db, id, [
					{ ...base, answers: [{ ...base.answers[0], judgment: 'incorrect' as const }] },
				]),
			(error: unknown) => error instanceof ChallengeConflictError,
		)
	})

	it('syncChallenges rejects an unknown link', async () => {
		const db = createTestDatabase()
		const id = await syncLinkIdFromSyncKey(fixedSyncKey('Y'))
		await assert.rejects(
			() => syncChallenges(db, id, []),
			(error: unknown) => error instanceof SyncLinkNotFoundError,
		)
	})
})
