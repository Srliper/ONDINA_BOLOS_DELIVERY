# Animação de rolagem (sequência de frames)

Página independente em HTML, CSS e JavaScript puros: `index.html`, `styles.css`, `script.js`.
No app, a mesma intro é o componente `src/components/ScrollIntro.tsx`.

## Onde ficam os frames

Os frames são os mesmos da intro do app: `public/intro/frames/frame-0001.webp` … `frame-0240.webp`
(240 frames, 18 MB). A sequência original tinha 300 arquivos, mas 60 eram cópias idênticas do frame
anterior (conversão de 24 para 30 quadros por segundo); elas foram removidas e os demais renumerados.
Para mudar a pasta ou a quantidade de frames, edite `CONFIG` no início do `script.js`.

## Testar

Abra por um servidor a partir da raiz do repositório (a página lê `../public/intro/frames/`):

```
python3 -m http.server 8000
# abra http://localhost:8000/scroll-animation/
```

## Comportamento

- A seção tem 5 telas de altura (`--scroll-length` no `styles.css`); o palco fica preso enquanto ela rola.
- Celular ou aparelho com pouca memória usa 1 frame a cada 2 (120 imagens).
- Tela larga com frame vertical: a imagem aparece inteira, com o mesmo frame desfocado de fundo.
- `prefers-reduced-motion: reduce`: mostra só o frame 96 parado (bolo inteiro), sem baixar a sequência.
