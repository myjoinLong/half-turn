type Ad = {
  onClose(f: (v: { isEnded?: boolean }) => void): void;
  onError(f: () => void): void;
  load(): Promise<void>;
  show(): Promise<void>;
  destroy(): void;
};
declare global {
  interface Window {
    tap?: { createRewardedVideoAd(v: { adUnitId: string }): Ad };
  }
}
let busy = false;
const presentationTimeout = 6000;
const playbackTimeout = 150000;
export function watch(kind: "tickets" | "aurora", shown: () => void) {
  const id =
    kind === "tickets"
      ? import.meta.env.VITE_HALF_TURN_TICKETS_AD
      : import.meta.env.VITE_HALF_TURN_AURORA_AD;
  return playRewarded(id, window.tap, shown);
}
export async function playRewarded(
  id: string | undefined,
  host: Window["tap"],
  shown: () => void,
): Promise<"done" | "cancel" | "empty"> {
  if (busy || !id || !host?.createRewardedVideoAd) return "empty";
  busy = true;
  let ad: Ad | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    active = true;
  let opening = false;
  try {
    ad = host.createRewardedVideoAd({ adUnitId: id });
    const instance = ad;
    return await new Promise((resolve) => {
      const settle = (result: "done" | "cancel" | "empty") => {
        if (!active) return;
        active = false;
        resolve(result);
      };
      timer = setTimeout(() => settle("empty"), presentationTimeout);
      instance.onError(() => settle("empty"));
      instance.onClose((v) => {
        if (opening) settle(v?.isEnded === true ? "done" : "cancel");
      });
      instance
        .load()
        .then(async () => {
          if (active) {
            opening = true;
            await instance.show();
            if (active) {
              clearTimeout(timer);
              timer = setTimeout(() => settle("empty"), playbackTimeout);
              shown();
            }
          }
        })
        .catch(() => settle("empty"));
    });
  } catch {
    return "empty";
  } finally {
    active = false;
    clearTimeout(timer);
    busy = false;
    try {
      ad?.destroy();
    } catch {
      /* Host released the singleton. */
    }
  }
}
