# PG-MinGRU four-task dashboard demo

This repository is a self-contained, local CPU demo of the PG-MinGRU front end. The comparison tables and charts follow manuscript version7 for DeepSense 6G Scenario 23, MultimodalNF, and the Fengdu and Jiangnan direction-regression scenes. The package includes the dashboard source, 18 frozen TorchScript demos, and 16 deterministic **synthetic prepared-input examples per task**.

The beam comparison includes PG-MinGRU and seven baselines, with overall, NLoS, and LoS views for MultimodalNF. LoS scores are derived from the overall and NLoS scores and their group sizes. For direction regression, the tables compare PG-MinGRU with EKF, GPR, Temporal-EKF, UFIR, and WTFTP using joint angular MAE, RMSE, and frames within both pointing tolerances. Results are aggregates from previously reported fixed test windows.

The inference selector lists the bundled demos and labels models from earlier comparisons as archived. New baselines are shown in the comparison tables; executable demos are listed separately. Synthetic inputs have no ground-truth labels and are for checking the local inference interface.

## Versions

- [Current dashboard (`main`)](https://github.com/NieErGou/PG/tree/main) shows the version7 manuscript's baseline comparisons.
- [Legacy dashboard (`dashboard-legacy`)](https://github.com/NieErGou/PG/tree/dashboard-legacy) preserves the original standalone demo and its earlier comparison tables, charts, and model selection. Use this snapshot to reproduce the earlier dashboard display.

## Run locally

Use Python 3.10 or newer. CPU is sufficient. From this directory:

**Windows PowerShell**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

**Linux / macOS**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Open <http://127.0.0.1:8765/> for comparison tables, figures, downloads, and model inference. Open <http://127.0.0.1:8765/runtime.html> for the one-click model view. The server binds only to `127.0.0.1`.

To check all four task pages and all 18 model endpoints:

```bash
python verify_package.py
```

The package can be moved or cloned to any directory. It has no absolute paths to the original workspace. It was verified with Python 3.13, NumPy 2.4.3 and PyTorch 2.10.0 CPU; other combinations require a local check. `requirements.txt` contains only NumPy and PyTorch; use the [official PyTorch installer](https://pytorch.org/get-started/locally/) if your platform needs a specific wheel. A [Chinese guide](README_中文.md) is also included.

## Included data and provenance

| Folder | Task | Included | Excluded |
|---|---|---|---|
| `data/scenario23/` | 64-class beam prediction | Aggregate metrics, one figure, frozen models, 16 synthetic inputs | Original DeepSense measurements and labels |
| `data/multimodalnf/` | 64-class beam prediction, LoS/NLoS groups | Aggregate metrics and charts by subset, frozen models, 16 synthetic inputs | Original CSI, images, positions, labels |
| `data/fengdu/` | Azimuth/elevation prediction | Aggregate metrics, one comparison figure, frozen models, 16 synthetic inputs | Private recordings, test windows and labels |
| `data/jiangnan/` | Azimuth/elevation prediction | Aggregate metrics, one comparison figure, frozen models, 16 synthetic inputs | Private recordings, test windows and labels |

`data/*/demo_samples.npz` is generated entirely by `generate_demo_data.py`; it does not copy source records. `data/*/results.json` and `comparison.csv` contain selected aggregate fields only. The trained TorchScript files are provided for functional local inference. No full checkpoints, raw data archives, per-sample predictions, private paths, or test labels are included.

Original dataset sources: [DeepSense 6G](https://deepsense6g.net/) and [MultimodalNF](https://huggingface.co/datasets/lmyxxn/MultimodalNF). Obtain original datasets from their owners under their terms. The MultimodalNF download checked during project work did not declare an explicit redistribution license, which is why this repository does not contain its data. Fengdu and Jiangnan source captures are private.

## API

- `GET /api/datasets`: four task names.
- `GET /api/summary?dataset=scenario23`: version7 comparison rows in `models`, executable demo records in `inference_models`, figure list, and protocol notes.
- `GET /api/sample?dataset=scenario23&model=pg`: one synthetic prepared-input example.
- `POST /api/predict`: frozen-model CPU inference for the matching prepared-input JSON.
- `GET /api/asset?dataset=scenario23&name=comparison.csv`: published aggregate files.

The application is a local research demo. It has no sensor acquisition, feature extraction from raw data, online beam execution, training, or Jetson measurement pipeline.
