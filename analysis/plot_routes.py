import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser(description="Plot GPS tracks by trial.")
    parser.add_argument("bundle_dir", type=Path, help="Path to unzipped export bundle")
    parser.add_argument("--trial-id", type=str, help="Filter to a specific trial id")
    parser.add_argument("--output", type=Path, help="Save plot to file instead of showing")
    args = parser.parse_args()

    trials = pd.read_csv(args.bundle_dir / "trials.csv")
    points = pd.read_csv(args.bundle_dir / "trackpoints.csv")

    if args.trial_id:
        points = points[points["trial_id"] == args.trial_id]
        trials = trials[trials["trial_id"] == args.trial_id]

    if points.empty:
        raise SystemExit("No trackpoints found for selection.")

    trial_meta = trials.set_index("trial_id")[["actual", "place_name"]].to_dict("index")

    plt.figure(figsize=(8, 8))
    for trial_id, group in points.groupby("trial_id"):
        label = trial_meta.get(trial_id, {})
        route = label.get("actual") or "unknown"
        place = label.get("place_name") or "place"
        plt.plot(group["lon"], group["lat"], linewidth=2, label=f"{place} / {route}")

    plt.title("Commute Tracks")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.legend()
    plt.axis("equal")

    if args.output:
        plt.savefig(args.output, dpi=150)
    else:
        plt.show()


if __name__ == "__main__":
    main()
