"""Import unmodified public-domain ASL diagrams and preserve their attribution."""
import concurrent.futures
import json
from pathlib import Path
import string
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
HEADERS = {"User-Agent": "Gesturingo/0.1 (educational frontend asset importer)"}

def read_url(url):
    request = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))

params = {
    "action": "query", "format": "json", "prop": "imageinfo",
    "iiprop": "url|extmetadata", "iiurlwidth": 500, "titles": "|".join(
        f"File:Sign language {letter}.svg" for letter in string.ascii_uppercase),
}
response = json.loads(read_url("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
pages = response["query"]["pages"].values()
destination = ROOT / "public" / "asl"
destination.mkdir(parents=True, exist_ok=True)

def download(page):
    letter = page["title"].removeprefix("File:Sign language ").removesuffix(".svg")
    info = page["imageinfo"][0]
    meta = info.get("extmetadata", {})
    license_name = meta.get("LicenseShortName", {}).get("value", "")
    if license_name not in ("Public domain", "CC0"):
        raise ValueError(f"Unexpected license for {letter}: {license_name}")
    target = destination / f"{letter}.png"
    if target.exists():
        data = target.read_bytes()
    else:
        time.sleep(2)
        data = read_url(info["thumburl"])
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Unexpected image format")
    target.write_bytes(data)
    return {"letter": letter, "source": info["descriptionurl"],
            "original": info["url"], "download": info["thumburl"], "license": license_name,
            "artist": meta.get("Artist", {}).get("value", ""), "bytes": len(data)}

with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    sources = sorted(pool.map(download, pages), key=lambda item: item["letter"])
if len(sources) != 26:
    raise ValueError("The alphabet must contain exactly 26 diagrams")
(ROOT / "public" / "asl" / "sources.json").write_text(
    json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Imported {len(sources)} public-domain diagrams ({sum(s['bytes'] for s in sources)} bytes)")
