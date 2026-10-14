"""Save NASA JPL's asteroid close approaches and fireballs as data/sky.json.

The dashboard reads everything else straight from each source's API, but
JPL's Solar System Dynamics API does not answer a browser on another site
(it sends no CORS headers), so a nightly workflow saves its answers instead
(.github/workflows/sky-data.yml). It commits them to the sky-data branch,
since master is protected, and the page reads them from there; data/sky.json
on master is the copy the page falls back to. Both change slowly: an approach
is known weeks ahead, and fireballs are posted days after they fall.

    python3 tools/sky_data.py               # write data/sky.json
    python3 tools/sky_data.py --out FILE    # write FILE instead
    python3 tools/sky_data.py --check       # fetch and validate, write nothing
"""
import datetime
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://ssd-api.jpl.nasa.gov"
OUT = Path(__file__).resolve().parent.parent / "data" / "sky.json"


def get(path, **params):
    url = API + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "rickseufert.com dashboard (github.com/rseufert/rseufert.github.io)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def table(answer, fields):
    """JPL answers as {fields: [...], data: [[...], ...]}; keep the named columns."""
    if "fields" not in answer:          # no rows: JPL leaves fields out too
        return []
    idx = [answer["fields"].index(f) for f in fields]
    return [[row[i] for i in idx] for row in answer.get("data", [])]


def main():
    today = datetime.datetime.now(datetime.timezone.utc).date()
    # A week back as well as two months ahead, so the page still has a "now"
    # in the middle of the data on the days before the next run.
    cad = get("/cad.api", **{"date-min": (today - datetime.timedelta(days=7)).isoformat(),
                             "date-max": (today + datetime.timedelta(days=60)).isoformat(),
                             "dist-max": "0.05", "sort": "date"})
    fireballs = get("/fireball.api", **{"date-min": (today - datetime.timedelta(days=365)).isoformat(),
                                        "req-loc": "true", "sort": "-date"})
    sky = {
        "fetched": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "source": API,
        # cd: close-approach time (TDB, as JPL gives it); dist: nominal distance, au;
        # v_rel: speed relative to Earth, km/s; h: absolute magnitude.
        "approaches": {"fields": ["des", "cd", "dist", "v_rel", "h"],
                       "data": table(cad, ["des", "cd", "dist", "v_rel", "h"])},
        # energy: radiated, 10^10 J; impact-e: estimated impact energy, kilotons.
        "fireballs": {"fields": ["date", "energy", "impact-e", "lat", "lat-dir", "lon", "lon-dir", "alt", "vel"],
                      "data": table(fireballs, ["date", "energy", "impact-e", "lat", "lat-dir", "lon", "lon-dir", "alt", "vel"])},
    }
    if not sky["approaches"]["data"]:
        sys.exit("JPL returned no close approaches at all; refusing to overwrite data/sky.json")
    text = json.dumps(sky, separators=(",", ":")) + "\n"
    print(f'{len(sky["approaches"]["data"])} approaches, {len(sky["fireballs"]["data"])} fireballs')
    if "--check" not in sys.argv:
        out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else OUT
        out.write_text(text)
        print("wrote", out)


if __name__ == "__main__":
    main()
