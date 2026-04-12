#!/usr/bin/env python3
"""
Serve the web/ folder for local development.

The BookStack proxy remains available under /bookstack-proxy/ for legacy flows,
but the current OIM upload UI talks directly to the backend API configured in
web/config.local.json.

From repo root:
  python3 web/server.py

Then open http://127.0.0.1:8080.
"""
from __future__ import annotations

import os
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

WEB_ROOT = Path(__file__).resolve().parent
UPSTREAM = os.environ.get("BOOKSTACK_URL", "http://127.0.0.1:6875").rstrip("/")
PROXY_PREFIX = "/bookstack-proxy"
SKIP_RESPONSE_HEADERS = frozenset(
    {
        "transfer-encoding",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "upgrade",
    }
)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _upstream_target(self) -> str | None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith(PROXY_PREFIX):
            return None
        suffix = parsed.path[len(PROXY_PREFIX) :] or "/"
        if not suffix.startswith("/"):
            suffix = "/" + suffix
        target = UPSTREAM + suffix
        if parsed.query:
            target += "?" + parsed.query
        return target

    def _read_body(self) -> bytes | None:
        if self.command not in ("POST", "PUT", "PATCH"):
            return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return b""
        return self.rfile.read(length)

    def _proxy(self) -> None:
        target = self._upstream_target()
        if target is None:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        body = self._read_body()
        req = Request(target, data=body, method=self.command)
        for h in ("Content-Type", "Authorization", "Accept"):
            v = self.headers.get(h)
            if v:
                req.add_header(h, v)

        timeout = 300 if self.command == "POST" else 60
        try:
            with urlopen(req, timeout=timeout) as resp:
                data = resp.read()
                self.send_response(resp.status)
                for hk, hv in resp.headers.items():
                    if hk.lower() in SKIP_RESPONSE_HEADERS:
                        continue
                    self.send_header(hk, hv)
                self.end_headers()
                self.wfile.write(data)
        except HTTPError as e:
            try:
                err_body = e.read()
            except Exception:
                err_body = str(e).encode()
            self.send_response(e.code)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(err_body)
        except URLError as e:
            self.send_error(HTTPStatus.BAD_GATEWAY, str(e.reason))

    def do_GET(self) -> None:
        if urlparse(self.path).path.startswith(PROXY_PREFIX):
            self._proxy()
        else:
            super().do_GET()

    def do_HEAD(self) -> None:
        if urlparse(self.path).path.startswith(PROXY_PREFIX):
            target = self._upstream_target()
            if not target:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            req = Request(target, method="HEAD")
            for h in ("Authorization", "Accept"):
                v = self.headers.get(h)
                if v:
                    req.add_header(h, v)
            try:
                with urlopen(req, timeout=60) as resp:
                    self.send_response(resp.status)
                    for hk, hv in resp.headers.items():
                        if hk.lower() in SKIP_RESPONSE_HEADERS:
                            continue
                        self.send_header(hk, hv)
                    self.end_headers()
            except HTTPError as e:
                self.send_response(e.code)
                self.end_headers()
            except URLError as e:
                self.send_error(HTTPStatus.BAD_GATEWAY, str(e.reason))
        else:
            super().do_HEAD()

    def do_POST(self) -> None:
        if urlparse(self.path).path.startswith(PROXY_PREFIX):
            self._proxy()
        else:
            self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def do_PUT(self) -> None:
        if urlparse(self.path).path.startswith(PROXY_PREFIX):
            self._proxy()
        else:
            self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def do_DELETE(self) -> None:
        if urlparse(self.path).path.startswith(PROXY_PREFIX):
            self._proxy()
        else:
            self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def do_OPTIONS(self) -> None:
        if urlparse(self.path).path.startswith(PROXY_PREFIX):
            self.send_response(204)
            self.end_headers()
        else:
            super().do_OPTIONS()


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    host = os.environ.get("HOST", "127.0.0.1")
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Serving {WEB_ROOT} at http://{host}:{port}/")
    print(f"Proxy: http://{host}:{port}{PROXY_PREFIX}/... -> {UPSTREAM}/...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
