"""Black-box HTTP smoke check for a cloned copy of this package."""
import json
import threading
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen

import app


def main():
    class QuietHandler(app.Handler):
        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = "http://127.0.0.1:%d" % server.server_port

    def get(path):
        with urlopen(base + path, timeout=15) as response:
            return json.load(response)

    try:
        assert urlopen(base + "/", timeout=15).status == 200
        assert urlopen(base + "/runtime.html", timeout=15).status == 200
        catalog = get("/api/datasets")
        assert len(catalog) == 4
        count = 0
        for item in catalog:
            key = item["key"]
            page = get("/api/summary?dataset=" + key)
            assert page["directory"] == "data/" + key
            assert page["protocol"]["source"] == "PG-MinGRU manuscript version7"
            assert len(page["models"]) == (8 if item["task"] == "BEAM" else 6)
            assert page["models"][0]["model"] == "pg"
            assert "comparison.csv" in page["files"] and any(f.endswith(".png") for f in page["files"])
            with urlopen(base + "/api/asset?dataset=" + key + "&name=comparison.csv", timeout=15) as response:
                assert response.read().startswith(b"method,")
            for model in page["inference_models"]:
                sample = get("/api/sample?dataset=%s&model=%s" % (key, model["model"]))
                request = Request(base + "/api/predict",
                                  data=json.dumps(sample).encode("utf-8"),
                                  headers={"Content-Type": "application/json"})
                with urlopen(request, timeout=30) as response:
                    prediction = json.load(response)
                if item["task"] == "BEAM":
                    assert len(prediction["top5_beams_zero_based"][0]) == 5
                else:
                    assert len(prediction["angles_deg"][0]) == 2
                count += 1
        assert count == 18
        print("PACKAGE_OK: 4 tasks, 18 frozen-model HTTP predictions")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
