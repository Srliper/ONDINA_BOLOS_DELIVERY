# Animação de rolagem (sequência de frames)

Página independente em HTML, CSS e JavaScript puros: `index.html`, `styles.css`, `script.js`.

## Onde colocar os frames

```
scroll-animation/
├── index.html
├── styles.css
├── script.js
└── frames/
    ├── frame-0001.jpg
    ├── ...
    └── frame-0300.jpg
```

A pasta `frames/` fica ao lado do `index.html` e não vai para o git (22 MB, está no `.gitignore`).
Para mudar o nome da pasta ou a quantidade de frames, edite `CONFIG` no início do `script.js`.

## Testar

Abra por um servidor (não pelo `file://`):

```
cd scroll-animation
python3 -m http.server 8000
# abra http://localhost:8000
```

## Comportamento

- A seção tem 5 telas de altura (`--scroll-length` no `styles.css`); o palco fica preso enquanto ela rola.
- Celular ou aparelho com pouca memória usa 1 frame a cada 2 (150 imagens).
- Tela larga com frame vertical: a imagem aparece inteira, com o mesmo frame desfocado de fundo.
- `prefers-reduced-motion: reduce`: mostra só o frame 120 parado, sem baixar a sequência.
