// Apple HealthKit auto-verify (Phase 2).
//
// This is a thin, dependency-optional wrapper. `react-native-health` requires a
// custom dev client / standalone build (it does NOT run in Expo Go), so we load
// it lazily and no-op gracefully when it's unavailable. Wire it up when you move
// from Expo Go to an EAS dev build.
//
// Supported v1 metrics: "miles" (DistanceWalkingRunning), "steps" (StepCount),
// "minutes" (AppleExerciseTime).

export type HealthMetric = "miles" | "steps" | "minutes";

let AppleHealthKit: any = null;
try {
  // @ts-ignore — optional native module, only present in an EAS dev/standalone build
  AppleHealthKit = require("react-native-health").default;
} catch {
  AppleHealthKit = null;
}

const PERMS = () =>
  AppleHealthKit && {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
        AppleHealthKit.Constants.Permissions.StepCount,
        AppleHealthKit.Constants.Permissions.AppleExerciseTime,
      ],
      write: [],
    },
  };

export function isHealthAvailable(): boolean {
  return !!AppleHealthKit;
}

export function initHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!AppleHealthKit) return resolve(false);
    AppleHealthKit.initHealthKit(PERMS(), (err: string) => resolve(!err));
  });
}

/** Total for `metric` between start/end (ISO). Returns 0 if unavailable. */
export function readMetricTotal(
  metric: HealthMetric,
  startISO: string,
  endISO: string,
): Promise<number> {
  return new Promise((resolve) => {
    if (!AppleHealthKit) return resolve(0);
    const opts = { startDate: startISO, endDate: endISO };

    if (metric === "steps") {
      AppleHealthKit.getStepCount(opts, (_e: any, r: any) => resolve(r?.value ?? 0));
    } else if (metric === "minutes") {
      AppleHealthKit.getAppleExerciseTime(opts, (_e: any, rows: any[]) =>
        resolve((rows ?? []).reduce((s, x) => s + (x.value ?? 0), 0)),
      );
    } else {
      // miles — HealthKit returns meters; convert.
      AppleHealthKit.getDistanceWalkingRunning(opts, (_e: any, r: any) =>
        resolve((r?.value ?? 0) / 1609.34),
      );
    }
  });
}
