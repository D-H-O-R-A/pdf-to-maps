# pdf-to-maps — Geoprocessador de Memorial Descritivo SIGEF/INCRA (2D & 3D)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ESModules](https://img.shields.io/badge/js-ESM-yellow.svg)](package.json)
[![Author](https://img.shields.io/badge/author-Diego%20Oris-orange.svg)](#)

Biblioteca e pipeline em Node.js (ESM) desenvolvida por **Diego Oris** para extração, validação, projeção geodésica e renderização gráfica bidimensional (2D) e tridimensional isométrica (3D) de polígonos territoriais a partir de memoriais descritivos georreferenciados no padrão **SIGEF/INCRA**.

A ferramenta opera de forma **100% offline e determinística**. Não utiliza APIs externas, inteligência artificial ou processamento em nuvem, garantindo segurança jurídica absoluta sobre dados de propriedades e contratos confidenciais.

---

## 📸 Demonstração Gráfica de Saída

Abaixo estão os mapas gerados de forma puramente matemática a partir do arquivo de memorial descritivo padrão:

### 📐 Mapa 2D com Grade de Coordenadas e Escala Plana
Projeção cartográfica plana com cálculo de padding, escala uniforme para preservar proporção territorial, grade de eixos métricos (UTM) e identificadores de cada vértice.
![Mapa 2D de Exemplo](assets/mapa_exemplo_2d.png)

### ⛰️ Mapa 3D Isométrico com Extrusão Volumétrica e Sombreamento Realista
Bloco tridimensional calculado por rotação matricial trigonométrica, com sombreamento lateral difuso baseado no produto escalar entre a normal da face e o vetor solar, com contornos realçados.
![Mapa 3D de Exemplo](assets/mapa_exemplo_3d.png)

---

## 🧮 Fundamentação Matemática e Cartográfica

Toda a precisão do pipeline é garantida por modelagem matemática explícita descrita abaixo:

### 1. Conversão DMS para Graus Decimais (DD)
As coordenadas de latitude e longitude extraídas dos arquivos PDF no formato sexagesimal (Graus, Minutos e Segundos - DMS) são convertidas para decimais reais através da fórmula:

$$DD = \text{sgn}(D) \cdot \left( |D| + \frac{M}{60} + \frac{S}{3600} \right)$$

Onde:
- $D$: Graus inteiros extraídos.
- $M$: Minutos inteiros.
- $S$: Segundos decimais (precisão flutuante).
- $\text{sgn}(D)$: Função sinal. Se o caractere de direção for `S` (Sul) ou `W`/`O` (Oeste), ou se houver um caractere `-` explícito, $\text{sgn}(D) = -1$, caso contrário $+1$.

O analisador regex faz a higienização de separadores como `°`, `'`, `"`, `”`, `,` ou `.`, unificando a leitura de strings complexas como `-04° 44' 00,00"` ou `04 44 00.00`.

### 2. Determinação Dinâmica do Fuso e Hemisfério UTM
A projeção para a grade de coordenadas planas (metros) exige determinar em qual fuso da projeção Transversa de Mercator a coordenada de longitude ($\lambda$) reside:

$$\text{Fuso} = \left\lfloor \frac{\lambda + 180}{6} \right\rfloor + 1$$

O hemisfério rege o deslocamento da coordenada vertical para evitar valores negativos de latitude (Falsa Latitude) no Hemisfério Sul ($\phi < 0$):

$$\text{Norte}_{\text{falso}} = \begin{cases} 10.000.000\text{ m} & \text{se } \phi < 0 \\ 0\text{ m} & \text{se } \phi \geq 0 \end{cases}$$

O sistema projeta os pontos utilizando as equações do elipsoide **GRS80/SIRGAS2000** (parâmetros idênticos ao WGS84, padrão legal de cartografia brasileira) via biblioteca `proj4`.

### 3. Ajuste de Escala e Aspecto Plano (Canvas 2D)
Para desenhar o polígono geográfico em um canvas plano quadrado de largura $W$ e altura $H$ (ex: $4000 \times 4000\text{ px}$) sem distorcer o relevo do imóvel (aspecto 1:1 real), calculamos um fator de escala uniforme $S$ considerando uma margem de segurança (padding $P$):

$$S = \min\left( \frac{W - 2P}{X_{\max} - X_{\min}}, \frac{H - 2P}{Y_{\max} - Y_{\min}} \right)$$

As posições finais na tela $(u, v)$ são transladadas e espelhadas verticalmente (devido à origem do sistema de coordenadas do canvas computacional estar no canto superior esquerdo):

$$u = P + (X - X_{\min}) \cdot S + \frac{(W - 2P) - (X_{\max} - X_{\min}) \cdot S}{2}$$

$$v = P + (Y_{\max} - Y) \cdot S + \frac{(H - 2P) - (Y_{\max} - Y_{\min}) \cdot S}{2}$$

### 4. Rotação e Projeção Isométrica Tridimensional (3D)
Para gerar a volumetria 3D, transladamos o polígono métrico UTM para uma origem local $[-1000, 1000]$ eliminando ruídos numéricos. Em seguida, aplicamos uma rotação tridimensional de guinada (yaw $\theta = -45^\circ$) sobre o eixo $Z$ e inclinação de arfagem (pitch $\phi = 35.264^\circ$, onde $\sin(\phi) = 1/\sqrt{3}$) para gerar a projeção isométrica padrão:

1. **Rotação Trigonométrica**:
   $$x_{\text{rot}} = x' \cdot \cos(-45^\circ) - y' \cdot \sin(-45^\circ) = \frac{\sqrt{2}}{2} \cdot (x' + y')$$
   $$y_{\text{rot}} = x' \cdot \sin(-45^\circ) + y' \cdot \cos(-45^\circ) = \frac{\sqrt{2}}{2} \cdot (-x' + y')$$

2. **Projeção Isométrica com Cota Altimétrica ($z$)**:
   $$u_{3D} = u_{\text{centro}} + x_{\text{rot}} \cdot S_{3D}$$
   $$v_{3D} = v_{\text{centro}} + y_{\text{rot}} \cdot \sin(35.264^\circ) \cdot S_{3D} - z$$

Onde:
- $x', y'$ são as coordenadas UTM locais transladadas.
- $S_{3D}$ é o fator de escala calculado para o encaixe tridimensional.
- $z$ é a altura física da extrusão (base do terreno $z = 0$ ou topo do terreno $z = 350\text{ px}$).

### 5. Sombreamento de Faces por Produto Escalar Vetorial (Diffuse Shading)
Para renderizar profundidade volumétrica nas paredes laterais da extrusão geográfica, calculamos a incidência de luz solar artificial utilizando o produto escalar ($\cdot$) de vetores:

1. **Vetor Normal à Parede ($\vec{N}$)** para um segmento entre o vértice $i$ e $i+1$:
   $$\vec{N} = \left[ -\frac{Y_{i+1} - Y_i}{d}, \frac{X_{i+1} - X_i}{d} \right]^T$$
   Onde $d = \sqrt{(X_{i+1} - X_i)^2 + (Y_{i+1} - Y_i)^2}$ é a distância em metros da aresta plana.

2. **Produto Escalar com o Vetor de Luz ($\vec{L}$)**:
   Definimos o vetor de luz solar vindo do quadrante superior esquerdo como $\vec{L} = [-0.707, 0.707]^T$. O fator de iluminação $k_d$ é calculado por:
   $$k_d = \vec{N} \cdot \vec{L} = N_x \cdot (-0.707) + N_y \cdot 0.707$$

3. **Mapeamento para Luminosidade HSL**:
   Mapeamos $k_d \in [-1.0, 1.0]$ linearmente para a luminosidade real do canal HSL entre $35\%$ (sombra total) e $100\%$ (iluminação perpendicular total):
   $$\text{Luminosity} = 35\% + (k_d + 1.0) \cdot 32.5\%$$

---

## 📁 Estrutura do Repositório

```
pdf-to-maps/
├── assets/                      # Renders públicos de mapas para demonstração
├── create_example.js            # Script offline para gerar PDF SIGEF de teste
├── index.js                     # Ponto de entrada / importação ESModules
├── package.json                 # Metadados, dependências e autoria de Diego Oris
├── package-lock.json            # Travamento de versões npm
├── .gitignore                   # Blindagem de PDFs confidenciais e exceções de testes
├── LICENSE                      # Licença open-source MIT
└── src/                         # Código-fonte principal da aplicação
    ├── index.js                 # Coordenador principal de arquivos e concorrência
    ├── parser/
    │   ├── pdfReader.js         # Leitor espacial de posições geométricas de texto PDF
    │   └── vertexExtractor.js   # Extrator regex estrito de strings de vértice DMS
    ├── projection/
    │   └── utmProjector.js      # Projetor de coordenadas geodésicas para metros UTM
    ├── draw/
    │   ├── mapRenderer.js       # Renderizador de imagem de mapa 2D plana (Canvas)
    │   └── mapRenderer3D.js     # Renderizador de imagem de mapa 3D isométrico (Canvas)
    ├── export/
    │   ├── geojsonExporter.js   # Exportador de arquivo vetorial GIS padrão OGC GeoJSON
    │   ├── dxfExporter.js       # Exportador CAD padrão AutoCAD DXF POLYLINE (R12)
    │   ├── svgExporter.js       # Exportador vetorial puro de alta definição SVG
    │   └── logExporter.js       # Calculador Turf e gerador de relatório técnico (TXT)
    └── utils/
        └── helper.js            # Conversor DMS e gerenciador de diretórios
```

---

## 🔒 Proteção Contra Vazamento de Dados

Os memoriais descritivos reais e contratos de imóveis rurais contém dados confidenciais e proprietários de alta criticidade protegidos por termos de sigilo e LGPD. 

Para eliminar qualquer chance de commits acidentais de arquivos privados para repositórios públicos no GitHub, o arquivo [`.gitignore`](.gitignore) vem configurado de fábrica bloqueando de forma absoluta qualquer arquivo PDF na pasta de processamento, abrindo uma exceção estrita apenas para o PDF público gerado para testes:

```gitignore
# PDFs de memoriais/contratos (confidenciais)
*.pdf
!exemplo_sigef.pdf
```

Você pode processar centenas de PDFs confidenciais localmente com segurança absoluta: apenas o arquivo `exemplo_sigef.pdf` poderá ser comitado.

---

## 🛠️ Instalação e Requisitos

### Pré-requisitos
- **Node.js** v18 ou superior.

### Instalação de Dependências
Navegue até a pasta do projeto e instale as dependências nativas utilizando:
```bash
npm install
```

As principais bibliotecas integradas ao geoprocessador são:
- `canvas`: Biblioteca nativa C++ integrada para renderização bitmap 2D/3D ultrarápida.
- `@turf/turf`: Motor matemático de geoprocessamento espacial geodésico sobre o elipsoide terrestre.
- `pdfjs-dist`: Analisador de vetores gráficos e metadados de texto para mapeamento de layout.
- `proj4`: Transformador de grades espaciais geodésicas e de cartografia.
- `pdf-lib`: Criador vetorial de documentos PDF de demonstração.

---

## 🚀 Como Executar

### Passo 1: Criar o PDF de Testes Padrão
Gere o arquivo `exemplo_sigef.pdf` contendo 4 vértices fechando um imóvel na região Norte (Coari - Amazonas) sem expor dados confidenciais:
```bash
node create_example.js
```

### Passo 2: Executar o Processador Principal
Para ler todos os memoriais descritivos presentes na pasta de mapas, execute:
```bash
node index.js
```

Se desejar ler uma pasta externa específica, basta passá-la como argumento:
```bash
node index.js /caminho/da/sua/pasta/com/pdfs
```

### Passo 3: Analisar os Resultados
O sistema gerará instantaneamente uma subpasta para cada PDF processado dentro do diretório `./output/[NOME_DO_PDF]/`:
- **`vertices.json`**: Os pontos geométricos indexados.
- **`mapa.png`**: Mapa 2D em alta resolução ($4000 \times 4000\text{ px}$).
- **`mapa_3d.png`**: Bloco isométrico volumétrico 3D.
- **`mapa.svg`**: Geometria vetorial escalável para web.
- **`mapa.geojson`**: Feição geográfica fechada para importar no QGIS ou Google Earth.
- **`mapa.dxf`**: Arquivo CAD estruturado em escala 1:1 métrica para agrimensores.
- **`log.txt`**: Relatório técnico com cálculo geodésico da área (hectares e $m^2$) e perímetro via Turf.js.

---

## 💻 Integração Programática (API de Exemplo)

Se você estiver desenvolvendo um sistema integrador, pode carregar os submódulos da biblioteca individualmente em qualquer arquivo JavaScript (ESM):

```javascript
import { readPDFAndReconstructLines } from "./src/parser/pdfReader.js";
import { extractVerticesFromReconstructedLines } from "./src/parser/vertexExtractor.js";
import { projectVerticesToUTM } from "./src/projection/utmProjector.js";
import { validateAndClosePolygon } from "./src/index.js";

async function extrairDados(pdfPath) {
    // 1. Extrai o texto organizando-o por coordenadas Y e X
    const lines = await readPDFAndReconstructLines(pdfPath);
    
    // 2. Extrai os vértices através de regex decimal e DMS
    const rawVertices = extractVerticesFromReconstructedLines(lines);
    
    // 3. Valida a topologia geométrica e garante fechamento de anel
    const validVertices = validateAndClosePolygon(rawVertices);
    
    // 4. Projeta para metros UTM SIRGAS2000
    const { projectedVertices, zone, isSouth } = projectVerticesToUTM(validVertices);
    
    console.log(`Vértices Georreferenciados na Zona ${zone}${isSouth ? "S" : "N"}:`, projectedVertices);
}
```

---

## 📄 Termos de Licença e Créditos

Este projeto é um software livre de distribuição pública licenciado sob os termos da **Licença MIT**.

Desenvolvido inteiramente por **Diego Oris**. Todos os direitos autorais reservados. Sinta-se livre para integrar em ferramentas comerciais, customizar e estender!
