"""Regenerate deterministic synthetic prepared-input examples only."""
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parent / "data"


def main():
    for index, key in enumerate(("scenario23", "multimodalnf", "fengdu", "jiangnan")):
        rng = np.random.default_rng(20261108 + index)
        target = ROOT / key / "demo_samples.npz"
        target.parent.mkdir(parents=True, exist_ok=True)
        if key in ("scenario23", "multimodalnf"):
            x = rng.normal(0.0, 0.04, (16, 8, 82)).astype(np.float32)
            x[:, :, :64] = rng.uniform(0.0, 1.0, (16, 8, 64)).astype(np.float32)
            geometry = rng.normal(0.0, 0.1, (16, 11)).astype(np.float32)
            physics = rng.normal(0.0, 0.1, (16, 6)).astype(np.float32)
            np.savez_compressed(target, x=x, geometry=geometry, physics=physics)
        else:
            history = rng.normal(0.0, 0.1, (16, 5, 24)).astype(np.float32)
            history[:, :, 5] = 1.0
            physics = rng.normal(0.0, 0.1, (16, 6)).astype(np.float32)
            anchor = rng.normal(0.0, 0.1, (16, 2)).astype(np.float32)
            iq = rng.normal(0.0, 0.05, (16, 5, 4, 64, 2)).astype(np.float32)
            np.savez_compressed(target, history=history, physics=physics,
                                anchor=anchor, iq=iq)
        print(target)


if __name__ == "__main__":
    main()
