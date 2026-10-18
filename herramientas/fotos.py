"""
MAISON NOIR · Descarga las fotos de los perfumes y les quita el fondo.
Lo corre GitHub solito (Actions > "Fotos de perfumes" > Run workflow).
Lee herramientas/fotos.csv  ->  guarda fotos/<slug>.png sin fondo.
Si una foto ya existe la salta (para rehacerlas todas, correr con FORZAR=1).
"""
import csv, io, os, sys, time
import requests
from PIL import Image
from rembg import new_session, remove

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTOS = os.path.join(RAIZ, "fotos")
FORZAR = os.environ.get("FORZAR") == "1"
ALTO = 640  # alto máximo de la foto final en px
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Referer": "https://www.fragrantica.com/"}


def bajar(origen):
    if origen.startswith("originales/"):
        with open(os.path.join(FOTOS, origen), "rb") as f:
            return f.read()
    for intento in range(3):
        r = requests.get(origen, headers=UA, timeout=30)
        if r.ok and r.content:
            return r.content
        time.sleep(2)
    raise RuntimeError(f"HTTP {r.status_code}")


def procesar(datos, sesion):
    im = Image.open(io.BytesIO(datos)).convert("RGBA")
    sin_fondo = remove(im, session=sesion)
    caja = sin_fondo.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox()
    if caja:
        sin_fondo = sin_fondo.crop(caja)
    if sin_fondo.height > ALTO:
        sin_fondo = sin_fondo.resize((round(sin_fondo.width * ALTO / sin_fondo.height), ALTO), Image.LANCZOS)
    return sin_fondo


def main():
    sesion = new_session("isnet-general-use")
    ok, saltadas, fallas = 0, 0, []
    with open(os.path.join(RAIZ, "herramientas", "fotos.csv"), encoding="utf-8") as f:
        filas = [r for r in csv.DictReader(f) if r["origen"].strip()]
    for r in filas:
        destino = os.path.join(FOTOS, r["slug"] + ".png")
        if os.path.exists(destino) and not FORZAR:
            saltadas += 1
            continue
        try:
            procesar(bajar(r["origen"].strip()), sesion).save(destino, optimize=True)
            ok += 1
            print("OK   ", r["slug"])
        except Exception as e:
            fallas.append(r["slug"])
            print("FALLA", r["slug"], "->", e)
    print(f"\nListas: {ok} · Ya existían: {saltadas} · Fallaron: {len(fallas)}")
    if fallas:
        print("Estas toca subirlas a mano desde el panel:", ", ".join(fallas))


if __name__ == "__main__":
    sys.exit(main())
