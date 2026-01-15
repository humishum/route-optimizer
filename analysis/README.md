# Commute Analysis (Python)

This folder contains Python scripts for analyzing exports from the iOS app.

## Setup (uv)

```bash
cd analysis
uv venv
uv sync
```

## Scripts

- `export_summary.py` - summary stats by place and route
- `plot_routes.py` - plot GPS tracks per trial

## Usage

1. Export a bundle from the app and unzip it.
2. Run:

```bash
python export_summary.py /path/to/unzipped
python plot_routes.py /path/to/unzipped --trial-id <trial_id>
```
