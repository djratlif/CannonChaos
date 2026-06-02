import os
from flask import Flask, render_template

app = Flask(__name__)

def get_version():
    if os.path.exists("version.txt"):
        with open("version.txt", "r") as f:
            return f.read().strip()
    try:
        import subprocess
        commit_count = int(subprocess.check_output(["git", "rev-list", "--count", "HEAD"]).decode().strip())
        return f"1.{commit_count:03d}"
    except Exception:
        return "1.000"

@app.route("/")
def index():
    return render_template("index.html", build_version=get_version())

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
