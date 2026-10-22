import os
import sys
import socket
import threading
from fastapi import FastAPI, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="Zuno AI Web Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response: Response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.get("/")
async def read_root():
    return FileResponse(os.path.join(BASE_DIR, "index.html"), media_type="text/html")

@app.get("/home")
async def read_home():
    return FileResponse(os.path.join(BASE_DIR, "index.html"), media_type="text/html")

# Mount all other static files (zuno-logo.png, zuno-logo-dark.png, css, js, etc.)
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

def forward_stream(src, dst):
    try:
        while True:
            data = src.recv(8192)
            if not data:
                break
            dst.sendall(data)
    except:
        pass
    finally:
        try: src.close()
        except: pass
        try: dst.close()
        except: pass

def start_ipv6_bridge(port):
    """Listens on IPv6 [::1]:port and forwards to IPv4 127.0.0.1:port so 'localhost' never fails on Windows."""
    try:
        server = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(('::1', port))
        server.listen(128)
        print(f"[Bridge] IPv6 [::1]:{port} -> IPv4 127.0.0.1:{port} active")
        sys.stdout.flush()
        while True:
            client_sock, _ = server.accept()
            target_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                target_sock.connect(('127.0.0.1', port))
                threading.Thread(target=forward_stream, args=(client_sock, target_sock), daemon=True).start()
                threading.Thread(target=forward_stream, args=(target_sock, client_sock), daemon=True).start()
            except:
                client_sock.close()
    except Exception as e:
        print(f"[Bridge] IPv6 bridge notice: {e}")
        sys.stdout.flush()

if __name__ == "__main__":
    port = 8080
    # Start the IPv6 localhost bridge in background
    bridge_thread = threading.Thread(target=start_ipv6_bridge, args=(port,), daemon=True)
    bridge_thread.start()

    # Start Uvicorn on IPv4 127.0.0.1
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
