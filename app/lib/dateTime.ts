import dayjs from "dayjs";

export type Clock = Readonly<{
	nowEpochMilliseconds: () => number;
}>;

export const systemClock: Clock = {
	nowEpochMilliseconds: (): number => dayjs().valueOf(),
};

export function formatLocalDateTime(epochMilliseconds: number): string {
	return dayjs(epochMilliseconds).format("YYYY/MM/DD HH:mm");
}
