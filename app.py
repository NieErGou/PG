"""Standalone local dashboard for four published result snapshots and demo inputs."""
import argparse
import json
import mimetypes
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
import torch

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DATA = ROOT / "data"
CATALOG = {
    "scenario23": ("DeepSense Scenario 23", "BEAM"),
    "multimodalnf": ("MultimodalNF", "BEAM"),
    "fengdu": ("Fengdu / 丰都", "DOA"),
    "jiangnan": ("Jiangnan / 江南", "DOA"),
}
LOCK = threading.Lock()
torch.set_num_threads(1)


def folder_for(key):
    if key not in CATALOG:
        raise ValueError("Unknown dataset")
    return DATA / key


def summary(key):
    folder = folder_for(key)
    payload = json.loads((folder / "results.json").read_text(encoding="utf-8"))
    files = sorted(p.name for p in folder.iterdir()
                   if p.is_file() and p.suffix.lower() in (".json", ".csv", ".png", ".svg"))
    return {"key": key, "title": CATALOG[key][0], "task": CATALOG[key][1],
            "directory": "data/" + key, "protocol": payload["protocol"],
            "models": payload["models"], "files": files,
            "notes": payload.get("limitations", []),
            "measurement": "汇总指标来自原项目的已报告测试；本仓库输入样例为合成数据，单次推理不能用于评价准确率。CPU 时延是原 Windows 测量，不是 Jetson 测量。"}


def input_names(key, model):
    records = summary(key)["models"]
    record = next((r for r in records if r["model"] == model), None)
    if record is None:
        raise ValueError("Unknown model")
    return record.get("input_names") or (["history", "physics", "anchor", "iq"]
                                         if CATALOG[key][1] == "DOA" else
                                         ["x", "physics" if model == "pg" else "geometry"])


def sample(key, model):
    names = input_names(key, model)
    with np.load(folder_for(key) / "demo_samples.npz", allow_pickle=False) as data:
        return {"dataset": key, "model": model, "input_space": "prepared",
                "sample_kind": "synthetic_demo_not_original_dataset",
                **{name: data[name][:1].tolist() for name in names}}


def predict(payload):
    key, model = payload["dataset"], payload["model"]
    names = input_names(key, model)
    contract = sample(key, model)
    if payload.get("input_space") != "prepared":
        raise ValueError("Requires prepared features")
    arrays = []
    for name in names:
        value = np.asarray(payload[name], dtype=np.float32)
        expected = np.asarray(contract[name]).shape
        if (value.ndim != len(expected) or value.shape[1:] != expected[1:]
                or not 1 <= len(value) <= 64 or not np.isfinite(value).all()):
            raise ValueError("%s: expected [1..64, %s] finite numbers" % (name, expected[1:]))
        arrays.append(torch.from_numpy(value))
    if len({len(value) for value in arrays}) != 1:
        raise ValueError("Input batch sizes must match")
    frozen = folder_for(key) / (model + "_cpu_frozen.ts")
    with LOCK, torch.inference_mode():
        net = torch.jit.load(str(frozen), map_location="cpu").eval()
        output = net(*arrays)
    if not torch.isfinite(output).all():
        raise ValueError("Nonfinite model output")
    if CATALOG[key][1] == "DOA":
        return {"angles_deg": output.tolist(), "columns": ["azimuth", "elevation"],
                "input_note": "Prediction on a synthetic demo input; no accuracy claim"}
    return {"top5_beams_zero_based": output.argsort(1, descending=True)[:, :5].tolist(),
            "input_note": "Prediction on a synthetic demo input; no accuracy claim"}


class Handler(BaseHTTPRequestHandler):
    def reply(self, body, status=200, mime="application/json; charset=utf-8"):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            url = urlparse(self.path)
            query = {key: values[0] for key, values in parse_qs(url.query).items()}
            if url.path == "/api/datasets":
                return self.reply([{"key": key, "title": value[0], "task": value[1]}
                                   for key, value in CATALOG.items()])
            if url.path == "/api/summary":
                return self.reply(summary(query["dataset"]))
            if url.path == "/api/sample":
                return self.reply(sample(query["dataset"], query.get("model", "pg")))
            if url.path == "/api/asset":
                key, name = query["dataset"], query["name"]
                if name not in summary(key)["files"]:
                    raise ValueError("Asset not published")
                path = folder_for(key) / name
            else:
                leaf = url.path.lstrip("/")
                path = (WEB / ("dashboard.html" if leaf in ("", "index.html") else leaf)).resolve()
                if not path.is_relative_to(WEB.resolve()):
                    raise ValueError("Invalid path")
            if not path.is_file():
                return self.reply({"error": "Not found"}, 404)
            self.reply(path.read_bytes(), mime=mimetypes.guess_type(path.name)[0]
                       or "application/octet-stream")
        except (ValueError, KeyError) as exc:
            self.reply({"error": str(exc)}, 400)
        except Exception as exc:
            self.reply({"error": str(exc)}, 500)

    def do_POST(self):
        try:
            if self.path != "/api/predict":
                return self.reply({"error": "Not found"}, 404)
            length = int(self.headers.get("Content-Length", 0))
            if not 0 < length <= 2 * 1024 * 1024:
                raise ValueError("JSON input must be 1 byte to 2 MiB")
            if self.headers.get("Origin") and self.headers["Origin"] != "http://%s" % self.headers.get("Host"):
                raise ValueError("Cross-origin request denied")
            return self.reply(predict(json.loads(self.rfile.read(length))))
        except (ValueError, KeyError) as exc:
            self.reply({"error": str(exc)}, 400)
        except Exception as exc:
            self.reply({"error": str(exc)}, 500)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print("PG dashboard: http://127.0.0.1:%d" % args.port, flush=True)
    if not args.no_browser:
        threading.Timer(.5, lambda: webbrowser.open("http://127.0.0.1:%d" % args.port)).start()
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
