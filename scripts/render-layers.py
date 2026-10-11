"""Renderiza as imagens provisórias das camadas do Monte seu Bolo (public/layers/*.png).

Uso: pip install numpy scipy pillow && python scripts/render-layers.py public/layers [nome ...]
São ilustrações 3D procedurais; troque pelas fotos reais (PNG transparente, mesmo nome) quando houver.

Cada camada é desenhada com geometria (cilindro, mapas de altura), iluminação
(difusa + especular + oclusão) e texturas (ruído fractal, poros, granulado).
Coordenadas em px de tela; renderiza em 4x e salva em 2x (PNG transparente).

Geometria compartilhada com src/data/bolo-layers.ts (LAYER_STACK):
  base       h=150  topo da massa: elipse centro y=20, ry=20; fundo y=130
  recheio    h=40   (bottom 30 → cobre y 80..120 da base)
  cobertura  h=100  (bottom 60 → topo da cobertura em y=24)
  decoracao  h=120  (bottom 80 → superfície do topo em y≈64)
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

OUT = Path(sys.argv[1])
ONLY = set(sys.argv[2:])
OUT.mkdir(parents=True, exist_ok=True)

SS = 4
FINAL = 2
W = 260
CX = 130.0

LIGHT = np.array([-0.42, 0.62, 0.66])
LIGHT /= np.linalg.norm(LIGHT)
VIEW = np.array([0.0, 0.0, 1.0])
HALF = LIGHT + VIEW
HALF /= np.linalg.norm(HALF)


# ---------------------------------------------------------------- utilidades
def grid(h):
    ys, xs = np.mgrid[0 : h * SS, 0 : W * SS].astype(np.float32)
    return (xs + 0.5) / SS, (ys + 0.5) / SS


def fbm(h, seed, scale=8.0, octaves=5, persistence=0.55):
    """Ruído fractal suave em [0,1], tamanho (h*SS, W*SS); `scale` em px de tela."""
    rng = np.random.default_rng(seed)
    H, Wd = h * SS, W * SS
    out = np.zeros((H, Wd), np.float32)
    amp, total = 1.0, 0.0
    s = scale
    for _ in range(octaves):
        gh, gw = max(2, int(H / (s * SS)) + 2), max(2, int(Wd / (s * SS)) + 2)
        small = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
        big = np.asarray(small.resize((Wd, H), Image.BICUBIC), np.float32) / 255
        out += big * amp
        total += amp
        amp *= persistence
        s /= 2
    return out / total


def normalize(n):
    return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)


def shade(normal, albedo, ambient=0.38, diffuse=0.75, spec=0.0, shininess=40.0, wrap=0.35, ao=None, spec_color=(1, 1, 1)):
    ndl = (normal @ LIGHT + wrap) / (1 + wrap)
    ndl = np.clip(ndl, 0, 1)[..., None]
    light = ambient + diffuse * ndl
    if ao is not None:
        light = light * ao[..., None]
    rgb = albedo * light
    if spec > 0:
        ndh = np.clip(normal @ HALF, 0, 1)
        s = (ndh**shininess)[..., None] * spec
        if ao is not None:
            s = s * ao[..., None]
        rgb = rgb + s * np.array(spec_color, np.float32)
    return rgb


def height_normals(height, strength):
    """Normais a partir de um mapa de altura (y da imagem cresce para baixo)."""
    gy, gx = np.gradient(height * SS)
    n = np.dstack([-gx * strength, gy * strength, np.ones_like(height)])
    return normalize(n)


def col(*rgb):
    return np.array(rgb, np.float32) / 255


class Layer:
    def __init__(self, h):
        self.h = h
        self.rgb = np.zeros((h * SS, W * SS, 3), np.float32)
        self.a = np.zeros((h * SS, W * SS), np.float32)

    def over(self, rgb, alpha):
        alpha = np.clip(alpha, 0, 1)
        if rgb.ndim == 1:
            rgb = np.broadcast_to(rgb, self.rgb.shape)
        a = alpha[..., None]
        out_a = alpha + self.a * (1 - alpha)
        self.rgb = (rgb * a + self.rgb * self.a[..., None] * (1 - a)) / np.maximum(out_a[..., None], 1e-6)
        self.a = out_a

    def shadow(self, mask, blur=4.0, strength=0.35, dx=2.0, dy=3.0):
        """Sombra suave projetada (deslocada para baixo/direita, contra a luz)."""
        m = ndimage.shift(mask.astype(np.float32), (dy * SS, dx * SS), order=1)
        m = ndimage.gaussian_filter(m, blur * SS) * strength
        self.over(col(40, 20, 12), m)

    def save(self, name):
        rgb = np.clip(self.rgb, 0, 1)
        # sRGB-ish leve: dá contraste de foto
        rgb = np.clip(rgb ** 0.95, 0, 1)
        img = np.dstack([rgb * 255, self.a * 255]).astype(np.uint8)
        im = Image.fromarray(img, 'RGBA').resize((W * FINAL, self.h * FINAL), Image.LANCZOS)
        im.save(OUT / f'{name}.png', optimize=True)
        print('ok', name)


def cylinder_side_normal(u, tilt=-0.18):
    s = np.sqrt(np.clip(1 - u**2, 0, 1))
    return normalize(np.dstack([u, np.full_like(u, tilt), s]))


TOP_NORMAL = normalize(np.array([0.0, 0.94, 0.34], np.float32))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def aa_mask(signed):
    """Máscara anti-serrilhada a partir de uma distância com sinal (positiva dentro), em px de tela."""
    return np.clip(signed * SS + 0.5, 0, 1)


# ---------------------------------------------------------------- massa (base)
def sponge_albedo(h, seed, base, dark, light, pore_scale=0.9, crumbs=False):
    n1 = fbm(h, seed, 30, 4)
    n2 = fbm(h, seed + 1, 2.2, 3)
    pores = fbm(h, seed + 2, pore_scale, 2, 0.45)
    alb = base[None, None] * (0.9 + 0.18 * n1[..., None])
    alb = alb * (0.94 + 0.12 * n2[..., None])
    hole = smoothstep(0.31, 0.24, pores) * 0.55  # poros pequenos, meio escuros
    rim = (smoothstep(0.37, 0.31, pores) - smoothstep(0.31, 0.24, pores)) * 0.5
    alb = alb * (1 - hole[..., None]) + dark[None, None] * hole[..., None]
    alb = alb * (1 - rim[..., None]) + light[None, None] * rim[..., None]
    if crumbs:
        c = fbm(h, seed + 3, 1.1, 2)
        crumb = smoothstep(0.68, 0.76, c) * 0.8
        alb = alb * (1 - crumb[..., None]) + (light * 1.03)[None, None] * crumb[..., None]
    bump = n2 * 0.5 - hole * 1.2 + n1 * 0.3
    return alb, bump


def base_round(name, base, dark, light, seed, crumbs=False):
    h = 150
    L = Layer(h)
    X, Y = grid(h)
    R, ry, ytop, ybot = 110.0, 20.0, 20.0, 130.0
    u = (X - CX) / R
    s = np.sqrt(np.clip(1 - u**2, 0, 1))
    inside_x = (R - np.abs(X - CX))
    side_sd = np.minimum.reduce([inside_x, Y - (ytop + ry * s * 0) + 0, (ybot + ry * s) - Y])
    side = aa_mask(side_sd) * (np.abs(u) < 1)
    top_sd = (1 - np.sqrt(((X - CX) / R) ** 2 + ((Y - ytop) / ry) ** 2)) * ry
    top = aa_mask(top_sd)

    alb, bump = sponge_albedo(h, seed, base, dark, light, crumbs=crumbs)
    # lateral: assada mais escura embaixo e nas bordas
    vert = (Y - (ytop + ry * s)) / (ybot - ytop)
    crust = np.clip(0.9 + 0.1 * (1 - vert) - 0.18 * smoothstep(0.82, 1.0, vert), 0, 1.2)
    n_side = cylinder_side_normal(u)
    bn = height_normals(bump, 0.35)
    n = normalize(n_side + 0.35 * (bn - np.array([0, 0, 1], np.float32)))
    ao = 0.82 + 0.18 * s
    rgb_side = shade(n, alb * crust[..., None], ambient=0.42, diffuse=0.7, spec=0.05, shininess=12, ao=ao)
    L.over(rgb_side, side)

    # topo: miolo levemente mais claro e domado
    r = np.sqrt(((X - CX) / R) ** 2 + ((Y - ytop) / ry) ** 2)
    dome = (1 - r**2) * 2.0
    n_top = normalize(TOP_NORMAL + 0.6 * (height_normals(dome + bump * 0.5, 0.5) - np.array([0, 0, 1], np.float32)))
    rgb_top = shade(n_top, alb * 1.06, ambient=0.45, diffuse=0.68, spec=0.04, shininess=10, ao=0.9 + 0.1 * (1 - r))
    # leve escurecimento na borda do topo (casquinha)
    rgb_top = rgb_top * (1 - 0.18 * smoothstep(0.8, 1.0, r))[..., None]
    L.over(rgb_top, top)
    L.save(name)


def base_square(name, base, dark, light, seed):
    h = 150
    L = Layer(h)
    X, Y = grid(h)
    x0, x1, depth, ytop, ybot = 24.0, 236.0, 26.0, 30.0, 146.0
    alb, bump = sponge_albedo(h, seed, base, dark, light)
    # frente
    front = aa_mask(np.minimum.reduce([X - x0, x1 - X, Y - ytop, ybot - Y]))
    nf = normalize(np.dstack([np.zeros_like(X), np.full_like(X, -0.12), np.ones_like(X)]))
    nf = normalize(nf + 0.35 * (height_normals(bump, 0.35) - np.array([0, 0, 1], np.float32)))
    vert = (Y - ytop) / (ybot - ytop)
    edge = 1 - 0.12 * smoothstep(0.85, 1, vert) - 0.08 * smoothstep(0.9, 1, np.abs(X - CX) / ((x1 - x0) / 2))
    L.over(shade(nf, alb * edge[..., None], ambient=0.42, diffuse=0.7), front)
    # topo em perspectiva (trapézio)
    t = (ytop - Y) / depth  # 0 na frente, 1 no fundo
    inset = 22 * t
    top = aa_mask(np.minimum.reduce([X - (x0 + inset), (x1 - inset) - X, ytop - Y, Y - (ytop - depth)]))
    n_top = normalize(TOP_NORMAL + 0.5 * (height_normals(bump * 0.6, 0.4) - np.array([0, 0, 1], np.float32)))
    L.over(shade(n_top, alb * 1.08, ambient=0.46, diffuse=0.66), top)
    L.save(name)


# ---------------------------------------------------------------- recheio
def filling(name, cream, seed, inclusions=None, gloss=0.25, chunk_dark=None):
    h = 40
    L = Layer(h)
    X, Y = grid(h)
    R = 113.0
    u = (X - CX) / R
    s = np.sqrt(np.clip(1 - u**2, 0, 1))
    wave = (fbm(h, seed, 10, 3) - 0.5) * 3.0
    y0 = 2 + 16 * s + wave
    y1 = 22 + 16 * s - wave * 0.6
    band_sd = np.minimum.reduce([R - np.abs(X - CX), Y - y0, y1 - Y])
    band = aa_mask(band_sd) * (np.abs(u) < 1)
    t = np.clip((Y - y0) / np.maximum(y1 - y0, 1), 0, 1)
    bulge_tilt = (0.5 - t) * 1.8  # topo da faixa olha para cima, base para baixo
    n = cylinder_side_normal(u, 0)
    n = normalize(n + np.dstack([np.zeros_like(u), bulge_tilt, np.zeros_like(u)]))
    tex = fbm(h, seed + 1, 4, 3)
    alb = cream[None, None] * (0.92 + 0.14 * tex[..., None])
    n = normalize(n + 0.25 * (height_normals(tex, 0.6) - np.array([0, 0, 1], np.float32)))
    rgb = shade(n, alb, ambient=0.45, diffuse=0.65, spec=gloss, shininess=30, ao=0.75 + 0.25 * np.sin(t * math.pi) ** 0.5)
    L.over(rgb, band)
    if inclusions:
        rng = np.random.default_rng(seed)
        kind, color, count, size = inclusions
        for _ in range(count):
            uu = rng.uniform(-0.94, 0.94)
            ss = math.sqrt(1 - uu * uu)
            cx = CX + uu * R
            cy = (2 + 16 * ss) + rng.uniform(4, 17)
            rx, ry_ = rng.uniform(*size), rng.uniform(*size) * 0.8
            ang = rng.uniform(0, math.pi)
            dx, dy = X - cx, Y - cy
            xr = dx * math.cos(ang) + dy * math.sin(ang)
            yr = -dx * math.sin(ang) + dy * math.cos(ang)
            d = np.sqrt((xr / rx) ** 2 + (yr / ry_) ** 2)
            m = aa_mask((1 - d) * min(rx, ry_)) * band
            if m.max() == 0:
                continue
            hgt = np.sqrt(np.clip(1 - d**2, 0, 1))
            nn = height_normals(hgt * 2.2, 1.0)
            c = col(*color) * (0.85 + 0.3 * rng.random())
            spec = 0.55 if kind == 'fruit' else 0.25
            L.over(shade(nn, np.broadcast_to(c, L.rgb.shape), ambient=0.4, diffuse=0.7, spec=spec, shininess=60), m)
    L.save(name)


# ---------------------------------------------------------------- coberturas
def frosting_mask(X, Y, R, cy, ry, drips, seed, depth):
    """Cobertura = tampa elíptica + faixa lateral + escorridos (com distância com sinal)."""
    u = (X - CX) / R
    s = np.sqrt(np.clip(1 - u**2, 0, 1))
    cap = (1 - np.sqrt(((X - CX) / R) ** 2 + ((Y - cy) / ry) ** 2)) * ry
    lower = cy + ry * s + depth
    side = np.minimum(R - np.abs(X - CX), lower - Y)
    side = np.minimum(side, Y - cy)
    m = np.maximum(cap, side)
    if drips:
        rng = np.random.default_rng(seed)
        x = CX - R + 4
        while x < CX + R - 6:
            w = rng.uniform(7, 13)
            uu = (x + w / 2 - CX) / R
            ss = math.sqrt(max(0, 1 - uu * uu))
            top = cy + ry * ss + depth - 2
            length = rng.uniform(10, 34) * (0.55 + 0.45 * ss)
            # escorrido: cápsula vertical que afina e termina em gota
            dx = np.abs(X - (x + w / 2))
            yy = Y - top
            radius = w / 2 * (1 - 0.25 * np.clip(yy / max(length, 1), 0, 1))
            body = np.minimum(radius - dx, np.minimum(yy + 2, length - yy))
            tip = (w / 2 * 0.9) - np.sqrt(dx**2 + (Y - (top + length)) ** 2)
            m = np.maximum(m, np.maximum(body, tip))
            x += w + rng.uniform(3, 10)
    return m


def ganache(name, color, seed, drips=True, gloss=0.9, shininess=90, sprinkles=None, depth=8):
    h = 100
    L = Layer(h)
    X, Y = grid(h)
    R, cy, ry = 114.0, 24.0, 21.0
    sd = frosting_mask(X, Y, R, cy, ry, drips, seed, depth)
    mask = aa_mask(sd)
    inside = sd > 0
    dist = ndimage.distance_transform_edt(inside) / SS
    hgt = np.sqrt(np.clip(dist / 6.0, 0, 1)) * 3.0  # bordas arredondadas, "líquido"
    n_h = height_normals(hgt, 1.0)
    u = (X - CX) / R
    on_top = (((X - CX) / R) ** 2 + ((Y - cy) / ry) ** 2) < 1
    n_base = np.where(on_top[..., None], np.broadcast_to(TOP_NORMAL, n_h.shape), cylinder_side_normal(np.clip(u, -1, 1), -0.05))
    tex = fbm(h, seed + 7, 18, 3)
    n = normalize(n_base + (n_h - np.array([0, 0, 1], np.float32)) * 0.9 + (height_normals(tex, 0.25) - np.array([0, 0, 1], np.float32)))
    alb = col(*color)[None, None] * (0.93 + 0.12 * tex[..., None])
    L.shadow(mask, blur=2.5, strength=0.45, dx=1.0, dy=3.0)
    rgb = shade(n, alb, ambient=0.34, diffuse=0.72, spec=gloss, shininess=shininess, wrap=0.25)
    # reflexo largo e suave no topo (janela de estúdio)
    r = np.sqrt(((X - (CX - 30)) / 60) ** 2 + ((Y - (cy - 6)) / 9) ** 2)
    rgb = rgb + (gloss * 0.22 * smoothstep(1.0, 0.2, r) * on_top)[..., None]
    L.over(rgb, mask)
    if sprinkles:
        rng = np.random.default_rng(seed + 11)
        for _ in range(sprinkles):
            a = rng.uniform(0, 2 * math.pi)
            rr = math.sqrt(rng.uniform(0, 1)) * 0.92
            cx, cyy = CX + math.cos(a) * R * rr, cy + math.sin(a) * ry * rr
            ang = rng.uniform(0, math.pi)
            ln, wd = rng.uniform(2.2, 3.4), 0.9
            dx, dy = X - cx, Y - cyy
            xr = dx * math.cos(ang) + dy * math.sin(ang)
            yr = -dx * math.sin(ang) + dy * math.cos(ang)
            d = np.maximum(np.abs(xr) - ln, 0) ** 2 + yr**2
            m = aa_mask(wd - np.sqrt(d))
            c = col(*color) * rng.uniform(0.55, 0.75)
            hh = np.clip(1 - np.sqrt(d) / wd, 0, 1)
            L.over(shade(height_normals(hh, 0.8), np.broadcast_to(c, L.rgb.shape), spec=0.5, shininess=50), m)
    L.save(name)


def chantilly(name, seed):
    h = 100
    L = Layer(h)
    X, Y = grid(h)
    R, cy, ry = 114.0, 24.0, 21.0
    cream = col(252, 248, 240)
    # camada lisa de chantilly no topo e lateral curta, com textura de espátula
    sd = frosting_mask(X, Y, R, cy, ry, False, seed, 10)
    tex = fbm(h, seed, 6, 4)
    swirl = np.sin((X - CX) * 0.12 + tex * 6) * 0.5 + 0.5
    hgt = tex * 1.4 + swirl * 0.5
    u = (X - CX) / R
    on_top = (((X - CX) / R) ** 2 + ((Y - cy) / ry) ** 2) < 1
    n_base = np.where(on_top[..., None], np.broadcast_to(TOP_NORMAL, (*X.shape, 3)), cylinder_side_normal(np.clip(u, -1, 1), -0.05))
    n = normalize(n_base + (height_normals(hgt, 0.8) - np.array([0, 0, 1], np.float32)))
    L.shadow(aa_mask(sd), blur=2.5, strength=0.35, dx=1.0, dy=3.0)
    L.over(shade(n, np.broadcast_to(cream, L.rgb.shape), ambient=0.46, diffuse=0.58, spec=0.12, shininess=14), aa_mask(sd))
    # bicos de confeitar (rosetas) em volta da borda, do fundo para a frente
    pts = []
    k = 16
    for i in range(k):
        a = math.pi * 2 * i / k
        pts.append((CX + math.cos(a) * (R - 10), cy + math.sin(a) * (ry - 3)))
    pts.sort(key=lambda p: p[1])
    for px, py in pts:
        rr = 11.5
        dx, dy = X - px, (Y - (py - 4)) * 1.25
        d = np.sqrt(dx**2 + dy**2)
        ang = np.arctan2(dy, dx)
        ridges = 0.5 + 0.5 * np.cos(ang * 6 + d * 0.9)
        hgt = np.clip(1 - d / rr, 0, 1) ** 0.6 * (0.6 + 0.4 * ridges) * 9
        m = aa_mask((rr - d) * 0.8)
        L.shadow(m * (d < rr), blur=2.2, strength=0.18, dx=1.5, dy=2.5)
        n = height_normals(hgt, 0.9)
        L.over(shade(n, np.broadcast_to(cream, L.rgb.shape), ambient=0.56, diffuse=0.5, spec=0.18, shininess=16, wrap=0.45, ao=0.84 + 0.16 * np.clip(hgt / 9, 0, 1)), m)
    L.save(name)


def fondant(name, color, seed):
    h = 100
    L = Layer(h)
    X, Y = grid(h)
    R, cy, ry = 114.0, 24.0, 21.0
    sd = frosting_mask(X, Y, R, cy, ry, False, seed, 66)
    inside = sd > 0
    dist = ndimage.distance_transform_edt(inside) / SS
    edge_round = np.sqrt(np.clip(dist / 4.0, 0, 1)) * 2
    u = (X - CX) / R
    on_top = (((X - CX) / R) ** 2 + ((Y - cy) / ry) ** 2) < 1
    n_base = np.where(on_top[..., None], np.broadcast_to(TOP_NORMAL, (*X.shape, 3)), cylinder_side_normal(np.clip(u, -1, 1), -0.08))
    tex = fbm(h, seed, 30, 3)
    n = normalize(n_base + 0.5 * (height_normals(edge_round + tex * 0.3, 0.8) - np.array([0, 0, 1], np.float32)))
    alb = col(*color)[None, None] * (0.97 + 0.05 * tex[..., None])
    L.shadow(aa_mask(sd), blur=2.5, strength=0.3, dx=1.0, dy=3.0)
    alb = alb * np.where(on_top, 1.06, 0.97)[..., None]
    L.over(shade(n, alb, ambient=0.52, diffuse=0.55, spec=0.25, shininess=24, wrap=0.15), aa_mask(sd))
    # cordão de pérolas na base da pasta
    s = np.sqrt(np.clip(1 - u**2, 0, 1))
    lower = cy + ry * s + 66
    for i in range(46):
        uu = -0.98 + 1.96 * i / 45
        ss = math.sqrt(1 - uu * uu)
        px, py = CX + uu * R, cy + ry * ss + 66 - 2
        d = np.sqrt((X - px) ** 2 + (Y - py) ** 2)
        rr = 2.6
        m = aa_mask(rr - d)
        hgt = np.sqrt(np.clip(1 - (d / rr) ** 2, 0, 1)) * 3
        L.over(shade(height_normals(hgt, 1.0), np.broadcast_to(col(250, 244, 238), L.rgb.shape), spec=0.6, shininess=50), m)
    L.save(name)


# ---------------------------------------------------------------- decorações
TOP_CY, TOP_RY, RING_RX = 64.0, 15.0, 84.0


def ring_points(k, rx=RING_RX, ry=TOP_RY, cy=TOP_CY, phase=0.0):
    pts = [(CX + math.cos(phase + 2 * math.pi * i / k) * rx, cy + math.sin(phase + 2 * math.pi * i / k) * ry) for i in range(k)]
    return sorted(pts, key=lambda p: p[1])  # de trás para a frente


def strawberry(L, X, Y, px, py, size, seed):
    """Morango inteiro, deitado de leve sobre o bolo: corpo cônico, sementes e sépalas."""
    rng = np.random.default_rng(seed)
    hgt_s = size * 1.15
    top, bottom = py - hgt_s, py
    tilt = rng.uniform(-0.25, 0.25)
    cx = px
    dy = Y - top
    t = np.clip(dy / hgt_s, 0, 1)
    dx = (X - cx) - tilt * dy  # leve inclinação
    shoulder = np.sqrt(np.clip(t / 0.22, 0, 1))
    halfw = size * 0.6 * shoulder * (1 - t**2.4) ** 0.55 + 0.2
    sd = np.minimum(halfw - np.abs(dx), np.minimum(dy + 0.5, bottom - Y + 0.5))
    m = aa_mask(sd)
    if m.max() == 0:
        return
    L.shadow(m, blur=2.0, strength=0.4, dx=2.5, dy=1.5)
    nx = np.clip(dx / np.maximum(halfw, 0.5), -1, 1)
    hgt = np.sqrt(np.clip(1 - nx**2, 0, 1)) * size * 0.55 * (0.5 + 0.5 * shoulder)
    n = height_normals(hgt, 0.75)
    sx, sy = 2.3, 2.4
    gx = (dx / sx) + (np.floor(dy / sy) % 2) * 0.5
    fx = gx - np.round(gx)
    fy = dy / sy - np.round(dy / sy)
    seed_d = np.sqrt(fx**2 + (fy * 1.4) ** 2)
    on_body = (t > 0.18) & (t < 0.94) & (np.abs(nx) < 0.85)
    seed_m = smoothstep(0.2, 0.1, seed_d) * on_body
    dimple = smoothstep(0.36, 0.16, seed_d) * on_body
    n = normalize(n + (height_normals(-dimple * 0.35, 0.6) - np.array([0, 0, 1], np.float32)))
    deep, bright = col(176, 16, 32), col(232, 46, 52)
    red = bright * (1 - t[..., None]) * 0.6 + deep * (0.4 + 0.6 * t[..., None])
    red = red * (1 - 0.3 * smoothstep(0.85, 1.0, np.abs(nx))[..., None])
    alb = red * (1 - seed_m[..., None] * 0.85) + col(230, 196, 120) * seed_m[..., None] * 0.85
    rgb = shade(n, alb, ambient=0.3, diffuse=0.78, spec=1.0, shininess=90, wrap=0.3)
    L.over(rgb, m)
    # sépalas: estrela verde pequena e plana sobre o "ombro"
    sep = np.zeros_like(X)
    sc_y = top + size * 0.12
    for k in range(6):
        a = 2 * math.pi * k / 6 + rng.uniform(-0.2, 0.2)
        ddx, ddy = X - (cx + tilt * size * 0.12), (Y - sc_y) / 0.42
        xr = ddx * math.cos(a) + ddy * math.sin(a)
        yr = -ddx * math.sin(a) + ddy * math.cos(a)
        ln = size * rng.uniform(0.32, 0.44)
        d = np.sqrt((np.clip(xr, 0, None) / ln) ** 2 + (yr / (size * 0.08 * (1.2 - np.clip(xr / ln, 0, 1)))) ** 2)
        sep = np.maximum(sep, aa_mask((1 - d) * size * 0.08) * (xr > -0.5))
    hh = ndimage.gaussian_filter(sep, SS * 0.6) * 1.5
    L.over(shade(height_normals(hh, 1.0), np.broadcast_to(col(70, 126, 46), L.rgb.shape), ambient=0.4, diffuse=0.7, spec=0.35, shininess=30), sep)
    stem_m = aa_mask(0.9 - np.sqrt((X - (cx + tilt * size * 0.12)) ** 2 * 1.0 + np.clip(np.abs(Y - (sc_y - 2.2)) - 2.0, 0, None) ** 2))
    L.over(np.broadcast_to(col(96, 120, 52), L.rgb.shape), stem_m)


def deco_strawberries(name, seed):
    h = 120
    L = Layer(h)
    X, Y = grid(h)
    pts = ring_points(9, phase=0.3)
    for i, (px, py) in enumerate(pts):
        strawberry(L, X, Y, px, py, 15 + (i % 3) * 1.5, seed + i)
    # um no centro, maior
    strawberry(L, X, Y, CX + 4, TOP_CY + 5, 19, seed + 99)
    L.save(name)


def flower(L, X, Y, px, py, size, petal, center, seed, petals=5):
    rng = np.random.default_rng(seed)
    rot = rng.uniform(0, math.pi)
    # flor levemente inclinada (achatada em y, como vista de cima/frente)
    fy = 0.62
    dmask = np.zeros_like(X)
    for k in range(petals):
        a = rot + 2 * math.pi * k / petals
        ox, oy = px + math.cos(a) * size * 0.55, py + math.sin(a) * size * 0.55 * fy
        dx, dy = X - ox, (Y - oy) / fy
        xr = dx * math.cos(a) + dy * math.sin(a)
        yr = -dx * math.sin(a) + dy * math.cos(a)
        d = np.sqrt((xr / (size * 0.55)) ** 2 + (yr / (size * 0.38)) ** 2)
        pm = aa_mask((1 - d) * size * 0.38)
        dmask = np.maximum(dmask, pm)
    L.shadow(dmask, blur=1.8, strength=0.22, dx=1.5, dy=2)
    for k in range(petals):
        a = rot + 2 * math.pi * k / petals
        ox, oy = px + math.cos(a) * size * 0.55, py + math.sin(a) * size * 0.55 * fy
        dx, dy = X - ox, (Y - oy) / fy
        xr = dx * math.cos(a) + dy * math.sin(a)
        yr = -dx * math.sin(a) + dy * math.cos(a)
        d = np.sqrt((xr / (size * 0.55)) ** 2 + (yr / (size * 0.38)) ** 2)
        pm = aa_mask((1 - d) * size * 0.38)
        cup = (1 - np.clip(d, 0, 1)) ** 0.6 * 2 + np.cos(yr * 1.2) * 0.25  # nervuras
        r_from_c = np.sqrt((X - px) ** 2 + ((Y - py) / fy) ** 2) / size
        alb = col(*petal)[None, None] * (1.05 - 0.25 * np.clip(r_from_c, 0, 1))[..., None] + col(*center) * 0.08 * (r_from_c < 0.4)[..., None]
        L.over(shade(height_normals(cup, 0.7), alb, ambient=0.5, diffuse=0.6, spec=0.12, shininess=16, wrap=0.6), pm)
    d = np.sqrt((X - px) ** 2 + ((Y - py) / fy) ** 2)
    cm = aa_mask(size * 0.24 - d)
    grain = fbm(L.h, seed, 0.9, 2)
    hh = np.sqrt(np.clip(1 - (d / (size * 0.24)) ** 2, 0, 1)) * 2 + grain
    L.over(shade(height_normals(hh, 0.8), np.broadcast_to(col(*center), L.rgb.shape), spec=0.2, shininess=20), cm)


def deco_flowers(name, seed):
    h = 120
    L = Layer(h)
    X, Y = grid(h)
    palette = [((246, 170, 196), (240, 190, 70)), ((255, 250, 245), (236, 180, 60)), ((206, 178, 236), (250, 220, 120)), ((255, 205, 150), (220, 120, 60))]
    pts = ring_points(8, rx=78, phase=0.2)
    for i, (px, py) in enumerate(pts):
        petal, center = palette[i % len(palette)]
        flower(L, X, Y, px, py - 4, 11 + (i % 2) * 2, petal, center, seed + i)
    flower(L, X, Y, CX - 18, TOP_CY - 2, 15, (246, 170, 196), (240, 190, 70), seed + 50)
    flower(L, X, Y, CX + 20, TOP_CY + 3, 13, (255, 250, 245), (236, 180, 60), seed + 51, petals=6)
    L.save(name)


def deco_chocolate(name, seed):
    h = 120
    L = Layer(h)
    X, Y = grid(h)
    rng = np.random.default_rng(seed)
    items = []
    for _ in range(55):
        a = rng.uniform(0, 2 * math.pi)
        rr = math.sqrt(rng.uniform(0.0, 1)) * 0.95
        items.append((CX + math.cos(a) * 98 * rr, TOP_CY + math.sin(a) * 17 * rr))
    items.sort(key=lambda p: p[1])
    for px, py in items:
        ang = rng.uniform(0, math.pi)
        ln, wd = rng.uniform(3, 6), rng.uniform(2.4, 3.4)
        dx, dy = X - px, Y - (py - 1.5)
        xr = dx * math.cos(ang) + dy * math.sin(ang)
        yr = -dx * math.sin(ang) + dy * math.cos(ang)
        d = np.maximum(np.abs(xr) - ln, 0) ** 2 + yr**2
        m = aa_mask(wd - np.sqrt(d))
        L.shadow(m, blur=1.5, strength=0.3, dx=1.5, dy=2)
        # lasca enrolada: listras ao longo do comprimento + curvatura
        curl = np.cos(yr / wd * math.pi * 0.5)
        hh = np.clip(curl, 0, 1) ** 0.7 * 2.6
        base_c = col(*[(74, 40, 24), (96, 54, 32), (58, 30, 18), (120, 72, 44), (232, 220, 200)][rng.integers(0, 5)])
        L.over(shade(height_normals(hh, 0.9), np.broadcast_to(base_c, L.rgb.shape), ambient=0.38, diffuse=0.7, spec=0.55, shininess=45), m)
    L.save(name)


def deco_gold(name, seed):
    h = 120
    L = Layer(h)
    X, Y = grid(h)
    rng = np.random.default_rng(seed)
    gold = col(228, 186, 88)
    for px, py in ring_points(20, rx=90, ry=16, phase=0.1):
        rr = 4.4
        d = np.sqrt((X - px) ** 2 + (Y - (py - 2)) ** 2)
        m = aa_mask(rr - d)
        L.shadow(m, blur=1.2, strength=0.3, dx=1, dy=1.5)
        hh = np.sqrt(np.clip(1 - (d / rr) ** 2, 0, 1)) * 3
        n = height_normals(hh, 1.0)
        # metal: albedo escuro + reflexo dourado forte e "horizonte" do estúdio
        env = 0.55 + 0.45 * np.clip(n[..., 1], 0, 1)
        rgb = shade(n, gold * env[..., None], ambient=0.5, diffuse=0.6, spec=1.2, shininess=50, spec_color=(1, 0.93, 0.7))
        L.over(rgb, m)
    # folhas de ouro amassadas espalhadas no topo
    for _ in range(9):
        a = rng.uniform(0, 2 * math.pi)
        rr = math.sqrt(rng.uniform(0.0, 0.8))
        px, py = CX + math.cos(a) * 80 * rr, TOP_CY + math.sin(a) * 13 * rr - 2
        size = rng.uniform(5, 9)
        crinkle = fbm(h, int(rng.integers(0, 10_000)), 1.6, 3)
        dx, dy = X - px, (Y - py) * 1.6
        d = np.sqrt(dx**2 + dy**2) / size
        edge = 1 - d + (crinkle - 0.5) * 0.9
        m = aa_mask(edge * size * 0.5)
        hh = crinkle * 3
        n = height_normals(hh, 1.2)
        rgb = shade(n, gold * 1.1, ambient=0.4, diffuse=0.5, spec=1.3, shininess=35, spec_color=(1, 0.92, 0.65))
        L.over(rgb, m)
    L.save(name)


JOBS = {
    'base-redonda': lambda: base_round('base-redonda', col(232, 186, 112), col(150, 98, 44), col(250, 222, 160), 11),
    'base-quadrada': lambda: base_square('base-quadrada', col(238, 200, 132), col(160, 112, 56), col(252, 230, 176), 21),
    'base-red-velvet': lambda: base_round('base-red-velvet', col(150, 26, 38), col(80, 10, 18), col(190, 52, 62), 31, crumbs=True),
    'recheio-brigadeiro-belga': lambda: filling('recheio-brigadeiro-belga', col(92, 50, 30), 41, ('choc', (60, 30, 16), 30, (1.2, 2.2)), gloss=0.35),
    'recheio-morango-ninho': lambda: filling('recheio-morango-ninho', col(250, 240, 228), 51, ('fruit', (210, 36, 52), 26, (2.0, 3.4)), gloss=0.2),
    'recheio-doce-de-leite': lambda: filling('recheio-doce-de-leite', col(190, 118, 52), 61, None, gloss=0.6),
    'recheio-prestigio': lambda: filling('recheio-prestigio', col(248, 244, 234), 71, ('choc', (84, 46, 28), 22, (1.4, 2.6)), gloss=0.15),
    'cobertura-brigadeiro': lambda: ganache('cobertura-brigadeiro', (88, 48, 30), 81, drips=True, gloss=0.55, shininess=40, sprinkles=420),
    'cobertura-chantilly': lambda: chantilly('cobertura-chantilly', 91),
    'cobertura-ganache': lambda: ganache('cobertura-ganache', (58, 30, 18), 101, drips=True, gloss=1.0, shininess=110),
    'cobertura-pasta-americana': lambda: fondant('cobertura-pasta-americana', (250, 206, 214), 111),
    'decoracao-morangos': lambda: deco_strawberries('decoracao-morangos', 121),
    'decoracao-flores': lambda: deco_flowers('decoracao-flores', 131),
    'decoracao-lascas-chocolate': lambda: deco_chocolate('decoracao-lascas-chocolate', 141),
    'decoracao-detalhes-dourados': lambda: deco_gold('decoracao-detalhes-dourados', 151),
}

for key, job in JOBS.items():
    if not ONLY or key in ONLY:
        job()
