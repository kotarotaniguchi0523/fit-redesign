export type Clock = Readonly<{
	nowEpochMilliseconds: () => number;
}>;

/** 現在時刻。旧実装は dayjs だったが Date.now() と等価なため依存を減らす。 */
export const systemClock: Clock = {
	nowEpochMilliseconds: (): number => Date.now(),
};
