"""Статика из ROOT + приём снимков: POST /save?name=X (тело — data:image/png;base64,...) → OUT/X.png."""
import base64, http.server, os, sys, urllib.parse

ROOT, OUT, PORT = sys.argv[1], sys.argv[2], int(sys.argv[3])
os.makedirs(OUT, exist_ok=True)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_GET(self):
        # /slow?ms=N — держит ответ N мс: так страница-обёртка откладывает load и скриншот
        if self.path.startswith("/slow"):
            import time
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            time.sleep(int(q.get("ms", ["3000"])[0]) / 1000)
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = os.path.basename(q.get("name", ["x"])[0])
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        if body.startswith("data:"):
            with open(os.path.join(OUT, name + ".png"), "wb") as f:
                f.write(base64.b64decode(body.split(",", 1)[1]))
        else:
            with open(os.path.join(OUT, name + ".txt"), "w") as f:
                f.write(body)
        print("saved", name, flush=True)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
