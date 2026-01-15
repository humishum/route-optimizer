import argparse
from pathlib import Path

import pandas as pd


def load_data(bundle_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    trials = pd.read_csv(bundle_dir / "trials.csv")
    events = pd.read_csv(bundle_dir / "events.csv")
    return trials, events


def summarize(trials: pd.DataFrame) -> pd.DataFrame:
    trials = trials.copy()
    trials["total_time_sec"] = pd.to_numeric(trials["total_time_sec"], errors="coerce")
    grouped = (
        trials.groupby(["place_name", "actual"], dropna=False)["total_time_sec"]
        .agg(["count", "mean", "median", "std", "min", "max"])
        .reset_index()
    )
    return grouped.sort_values(["place_name", "median"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize commute trial exports.")
    parser.add_argument("bundle_dir", type=Path, help="Path to unzipped export bundle")
    args = parser.parse_args()

    trials, _ = load_data(args.bundle_dir)
    summary = summarize(trials)
    print(summary.to_string(index=False))


if __name__ == "__main__":
    main()
