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
            assert page["models"]
            for model in page["models"]:
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
