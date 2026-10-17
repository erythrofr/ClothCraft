"""Local-only EXO Community concept server.

The browser requests many CSS modules and project images concurrently; the
default Python listen backlog can reset parallel connections during reloads.
This accepts concurrent requests with a larger bounded socket backlog.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f'EXO Community: {self.address_string()} — {fmt % args}', flush=True)


class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


if __name__ == '__main__':
    print(f'EXO Community: http://127.0.0.1:5499/ serving {ROOT}', flush=True)
    with Server(('127.0.0.1', 5499), Handler) as server:
        server.serve_forever()
