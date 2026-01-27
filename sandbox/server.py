"""
Sandbox Server - Python + Bash Execution
Executes Python code and bash commands in an isolated environment with timeout protection
"""

import http.server
import json
import sys
import io
import os
import subprocess
import traceback
import signal
from http.server import HTTPServer, BaseHTTPRequestHandler
from contextlib import redirect_stdout, redirect_stderr
from typing import Any
from pathlib import Path

# Working directory for file operations
WORKSPACE = Path("/home/sandbox/workspace")
WORKSPACE.mkdir(parents=True, exist_ok=True)

# Timeout handler
class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("Execution timed out")

class SandboxHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/execute":
            self.handle_execute()
        elif self.path == "/bash":
            self.handle_bash()
        elif self.path == "/read-file":
            self.handle_read_file()
        elif self.path == "/write-file":
            self.handle_write_file()
        elif self.path == "/health":
            self.handle_health()
        else:
            self.send_error(404, "Not Found")

    def do_GET(self):
        if self.path == "/health":
            self.handle_health()
        else:
            self.send_error(404, "Not Found")

    def handle_health(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok"}).encode())

    def _get_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        return json.loads(body.decode())

    def _send_json(self, data: dict, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    # ========== BASH EXECUTION ==========
    def handle_bash(self):
        try:
            data = self._get_body()
            command = data.get("command", "")
            timeout = min(data.get("timeout", 30), 120)  # Max 120 seconds
            
            result = self.execute_bash(command, timeout)
            self._send_json(result)
            
        except Exception as e:
            self._send_json({
                "success": False,
                "error": str(e),
                "stdout": "",
                "stderr": "",
                "exitCode": -1
            }, 500)

    def execute_bash(self, command: str, timeout: int) -> dict:
        """Execute bash command with timeout"""
        try:
            # Run in workspace directory
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(WORKSPACE),
                capture_output=True,
                text=True,
                timeout=timeout,
                env={
                    **os.environ,
                    "HOME": str(WORKSPACE),
                    "PATH": "/usr/local/bin:/usr/bin:/bin"
                }
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exitCode": result.returncode,
                "error": None
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "exitCode": -1,
                "error": f"Command timed out after {timeout} seconds"
            }
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "exitCode": -1,
                "error": str(e)
            }

    # ========== FILE OPERATIONS ==========
    def handle_read_file(self):
        try:
            data = self._get_body()
            path = data.get("path", "")
            
            result = self.read_file(path)
            self._send_json(result)
            
        except Exception as e:
            self._send_json({
                "success": False,
                "error": str(e),
                "content": None
            }, 500)

    def read_file(self, path: str) -> dict:
        """Read file from workspace"""
        try:
            # Resolve path relative to workspace
            file_path = (WORKSPACE / path).resolve()
            
            # Security: ensure path is within workspace
            if not str(file_path).startswith(str(WORKSPACE)):
                return {
                    "success": False,
                    "error": "Access denied: path outside workspace",
                    "content": None
                }
            
            if not file_path.exists():
                return {
                    "success": False,
                    "error": f"File not found: {path}",
                    "content": None
                }
            
            content = file_path.read_text(encoding="utf-8")
            
            return {
                "success": True,
                "content": content,
                "error": None
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "content": None
            }

    def handle_write_file(self):
        try:
            data = self._get_body()
            path = data.get("path", "")
            content = data.get("content", "")
            
            result = self.write_file(path, content)
            self._send_json(result)
            
        except Exception as e:
            self._send_json({
                "success": False,
                "error": str(e)
            }, 500)

    def write_file(self, path: str, content: str) -> dict:
        """Write file to workspace"""
        try:
            # Resolve path relative to workspace
            file_path = (WORKSPACE / path).resolve()
            
            # Security: ensure path is within workspace
            if not str(file_path).startswith(str(WORKSPACE)):
                return {
                    "success": False,
                    "error": "Access denied: path outside workspace"
                }
            
            # Create parent directories
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            file_path.write_text(content, encoding="utf-8")
            
            return {
                "success": True,
                "error": None,
                "path": str(file_path.relative_to(WORKSPACE))
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    # ========== PYTHON EXECUTION ==========
    def handle_execute(self):
        try:
            data = self._get_body()
            code = data.get("code", "")
            timeout = min(data.get("timeout", 30), 60)  # Max 60 seconds
            
            result = self.execute_code(code, timeout)
            self._send_json(result)
            
        except Exception as e:
            self._send_json({
                "success": False,
                "error": str(e),
                "output": "",
                "result": None
            }, 500)

    def execute_code(self, code: str, timeout: int) -> dict:
        """Execute Python code with timeout and capture output"""
        stdout_buffer = io.StringIO()
        stderr_buffer = io.StringIO()
        result = None
        error = None
        
        # Set up timeout
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout)
        
        try:
            # Create a restricted globals dict
            safe_globals = {
                "__builtins__": __builtins__,
                "__name__": "__main__",
            }
            
            # Import allowed modules
            import numpy as np
            import pandas as pd
            import math
            import json as json_module
            import re
            import datetime
            import collections
            import itertools
            import functools
            
            safe_globals.update({
                "np": np,
                "numpy": np,
                "pd": pd,
                "pandas": pd,
                "math": math,
                "json": json_module,
                "re": re,
                "datetime": datetime,
                "collections": collections,
                "itertools": itertools,
                "functools": functools,
                "WORKSPACE": WORKSPACE,
            })
            
            local_vars: dict[str, Any] = {}
            
            # Change to workspace directory
            original_cwd = os.getcwd()
            os.chdir(WORKSPACE)
            
            try:
                with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
                    # Execute the code
                    exec(code, safe_globals, local_vars)
                    
                    # Try to get a result variable if defined
                    if "result" in local_vars:
                        result = local_vars["result"]
                    elif "_" in local_vars:
                        result = local_vars["_"]
            finally:
                os.chdir(original_cwd)
                    
        except TimeoutError:
            error = "Code execution timed out"
        except Exception as e:
            error = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        finally:
            # Cancel the alarm
            signal.alarm(0)
        
        output = stdout_buffer.getvalue()
        stderr_output = stderr_buffer.getvalue()
        
        if stderr_output:
            output += f"\n[stderr]\n{stderr_output}"
        
        # Convert result to serializable format
        if result is not None:
            try:
                json.dumps(result)  # Test if serializable
            except (TypeError, ValueError):
                result = str(result)
        
        return {
            "success": error is None,
            "output": output.strip(),
            "result": result,
            "error": error
        }

    def log_message(self, format, *args):
        # Suppress default logging
        pass


def main():
    port = 8000
    server = HTTPServer(("0.0.0.0", port), SandboxHandler)
    print(f"Sandbox Server (Python + Bash) running on port {port}")
    print(f"Workspace: {WORKSPACE}")
    server.serve_forever()


if __name__ == "__main__":
    main()

