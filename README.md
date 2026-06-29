# 🗺️ D-H-O-R-A/pdf-to-maps — Geoprocessador SIGEF/INCRA (2D & 3D)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ESModules](https://img.shields.io/badge/js-ESM-yellow.svg)](package.json)
[![Author](https://img.shields.io/badge/author-Diego%20Oris-orange.svg)](#)

Um pipeline open-source profissional e de altíssima performance em Node.js (ESM) desenvolvido por **Diego Oris** para extrair, processar, projetar, validar e renderizar memoriais descritivos georreferenciados no padrão **INCRA/SIGEF** em mapas **2D e 3D**.

O sistema funciona de forma **100% offline, determinística e local**, eliminando qualquer dependência de ferramentas externas ou conexões de rede.

---

## 📸 Demonstração dos Mapas Gerados

Aqui estão os mapas gerados automaticamente a partir do arquivo de memorial descritivo padrão SIGEF:

### 📐 Mapa 2D de Alta Resolução (PNG & SVG)
O mapa bidimensional preserva com perfeição matemática todas as proporções e escala territorial, contendo grades de eixos métricos e rótulos de vértices.
![Mapa 2D de Exemplo](assets/mapa_exemplo_2d.png)

### ⛰️ Mapa 3D Isométrico com Extrusão Volumétrica e Shading de Luz Solar
Renderização isométrica com cálculo de projeção matemática tridimensional, sombreamento difuso automático com base na orientação das paredes (vetor normal) e contornos em estilo neon brilhante.
![Mapa 3D de Exemplo](assets/mapa_exemplo_3d.png)

---

## 🧮 Modelagem Matemática e Engenharia Cartográfica

O pipeline é puramente matemático. Abaixo estão detalhadas todas as equações que sustentam o processamento físico e visual:

### 1. Conversão DMS (Graus, Minutos e Segundos) para Graus Decimais (DD)
Cada coordenada esférica extraída em formato sexagesimal $[D^\circ\ M'\ S'']$ é convertida para decimal real através da equação de frações temporais:

$$DD = \left( |D| + \frac{M}{60} + \frac{S}{3600} \right) \cdot \text{sgn}(D)$$

Onde $\text{sgn}(D) = -1$ se a coordenada representar o hemisfério Oeste (Longitude) ou Sul (Latitude), indicado pelo sinal negativo ou letra correspondente.

### 2. Cálculo Dinâmico do Fuso (Zone) e Hemisfério UTM
A projeção para a malha cilíndrica transversal de Mercator (UTM) requer a identificação do fuso de amplitude de $6^\circ$ correspondente. Com base na longitude decimal ($\lambda$), calculamos o fuso pela fórmula:

$$\text{Zone} = \left\lfloor \frac{\lambda + 180}{6} \right\rfloor + 1$$

O hemisfério determina se a origem vertical sofrerá o deslocamento padrão de falsa coordenada Norte (Falsa Latitude) de $10.000.000\text{ m}$ (Hemisfério Sul):

$$\text{Falsa Latitude} = \begin{cases} 10.000.000 & \text{se } \phi < 0 \text{ (Sul)} \\ 0 & \text{se } \phi \geq 0 \text{ (Norte)} \end{cases}$$

*(Para a área de teste no Amazonas, com Longitude $\lambda \approx -61.3^\circ$, a equação resulta na zona **20S**, utilizando o elipsoide **GRS80/SIRGAS2000**).*

---

### 3. Projeção Bidimensional Plana no Canvas (2D)
Para desenhar o imóvel em um canvas plano de dimensão $W \times H$ (ex: $4000 \times 4000\text{ px}$) sem distorcer o relevo, computamos um fator de escala uniforme $S$ com uma margem de segurança $P$ (Padding):

$$S = \min\left( \frac{W - 2P}{X_{\max} - X_{\min}}, \frac{H - 2P}{Y_{\max} - Y_{\min}} \right)$$

As coordenadas projetadas na tela $(u, v)$ com inversão do eixo vertical do Canvas são:

$$u = P + (X - X_{\min}) \cdot S + \delta_x$$

$$v = P + (Y_{\max} - Y) \cdot S + \delta_y$$

Onde as compensações de centralização $\delta_x$ e $\delta_y$ para garantir alinhamento perfeito são dadas por:

$$\delta_x = \frac{(W - 2P) - (X_{\max} - X_{\min}) \cdot S}{2}$$

$$\delta_y = \frac{(H - 2P) - (Y_{\max} - Y_{\min}) \cdot S}{2}$$

---

### 4. Projeção Isométrica Tridimensional (3D)
Para a perspectiva isométrica tridimensional em que representamos o vetor espacial $[X, Y, Z]^T$ na tela bidimensional $[u, v]^T$, o pipeline aplica uma rotação de guinada (Yaw $\theta = -45^\circ$) sobre o eixo Z e uma inclinação de arfagem (Pitch $\phi \approx 35.264^\circ$ ou $\sin(\phi) = 1/\sqrt{3}$):

1. **Rotação do Plano (Yaw)**:
   $$X_{\text{rot}} = X' \cdot \cos(\theta) - Y' \cdot \sin(\theta)$$
   $$Y_{\text{rot}} = X' \cdot \sin(\theta) + Y' \cdot \cos(\theta)$$
   *(Onde $X'$ e $Y'$ são os metros UTM normalizados no intervalo $[-1000, 1000]$ para manter precisão de ponto flutuante).*

2. **Projeção de Tela (Pitch + Altura)**:
   $$u = u_{\text{centro}} + X_{\text{rot}} \cdot S_{3D}$$
   $$v = v_{\text{centro}} + Y_{\text{rot}} \cdot \sin(\phi) \cdot S_{3D} - z$$
   *(Onde $z$ é a cota altimétrica de extrusão: $z = 0$ para a base do bloco geográfico e $z = 350\text{ px}$ para a superfície do terreno).*

---

### 5. Sombreamento de Paredes por Vetores Normais (3D Diffuse Shading)
Para criar profundidade volumétrica e realismo nas faces laterais, calculamos a iluminação difusa baseado no produto escalar ($\cdot$) entre o vetor normal unitário da parede horizontal ($\vec{N}$) e o vetor direcional da luz solar artificial ($\vec{L} = [-0.707, 0.707]^T$ que simula o Sol vindo do canto superior esquerdo):

1. **Vetor Normal Unitário $\vec{N}$ da Parede** entre o vértice $i$ e $i+1$:
   $$\vec{N} = (N_x, N_y) = \left( \frac{-(Y_{i+1} - Y_i)}{L_{\text{seg}}}, \frac{X_{i+1} - X_i}{L_{\text{seg}}} \right)$$
   Onde $L_{\text{seg}} = \sqrt{(X_{i+1}-X_i)^2 + (Y_{i+1}-Y_i)^2}$ é a extensão da aresta.

2. **Fator de Sombreamento (Dot Product)**:
   $$\text{shading} = \vec{N} \cdot \vec{L} = N_x \cdot (-0.707) + N_y \cdot 0.707$$

3. **Mapeamento de Luminosidade HSL**:
   Convertemos o produto escalar no intervalo $[-1.0, 1.0]$ para o canal de luminosidade de cor HSL entre $35\%$ e $100\%$:
   $$\text{Luminance} = 35\% + (\text{shading} + 1.0) \cdot 32.5\%$$
   Este algoritmo faz com que as paredes voltadas para o sol fiquem brilhantes, enquanto as paredes opostas caiam em sombras realistas.

---

### 6. Cálculos Geodésicos de Precisão Real (Turf.js)
Os cálculos de área e perímetro de precisão do memorial descritivo utilizam as equações geodésicas do modelo de elipsoide **GRS80 (SIRGAS2000)** sobre a curvatura real da Terra, integrando as coordenadas por aproximação geodésica:
- **Área**: Calculada aplicando o Teorema de Green adaptado para geometria esférica terrestre.
- **Perímetro**: Soma das distâncias ortodrômicas (Great-Circle / Geodesic lines) calculadas através da equação de Haversine ou curvas geodésicas de Karney.

---

## 📁 Estrutura de Diretórios

```
maps/
├── assets/                      # Imagens de demonstração dos mapas (2D/3D)
├── create_example.js            # Criador offline do PDF de testes padrão SIGEF
├── index.js                     # Entrada principal do processador
├── package.json                 # Metadados e dependências do projeto
├── package-lock.json            # Lock de dependências
├── .gitignore                   # Arquivos ignorados (protege PDFs de contratos reais)
├── LICENSE                      # Licença MIT assignada a Diego Oris
└── src/                         # Código-fonte principal do geoprocessador
    ├── index.js                 # Coordenador principal do pipeline e filas
    ├── parser/
    │   ├── pdfReader.js         # Leitor layout-aware Y-coordinate / X-coordinate
    │   └── vertexExtractor.js   # Extrator regex DMS estrito de vértices
    ├── projection/
    │   └── utmProjector.js      # Detector de zona e projetor métrico Proj4
    ├── draw/
    │   ├── mapRenderer.js       # Renderizador de imagem de mapa 2D (Canvas)
    │   └── mapRenderer3D.js     # Renderizador de imagem de mapa 3D (Canvas)
    ├── export/
    │   ├── geojsonExporter.js   # Exportador GIS GeoJSON fechado
    │   ├── dxfExporter.js       # Exportador CAD DXF (POLYLINE R12)
    │   ├── svgExporter.js       # Exportador vetorial SVG de alta resolução
    │   └── logExporter.js       # Calculador Turf e gerador de log técnico
    └── utils/
        └── helper.js            # Utilitários cartográficos e matemáticos
```

---

## 🔒 Proteção de Dados e Arquivos Confidenciais (`.gitignore`)

Por se tratar de uma ferramenta profissional, muitos arquivos PDFs processados contêm **contratos reais confidenciais** e dados protegidos por LGPD que não devem, sob nenhuma hipótese, subir para repositórios públicos.

Para garantir isso, o arquivo [`.gitignore`](.gitignore) está pré-configurado com regras de exclusão globais:

```gitignore
# PDFs de memoriais/contratos (confidenciais)
*.pdf
```

Dessa forma, qualquer documento real que você soltar no diretório para ser processado estará **100% blindado contra commits acidentais**.

---

## 🛠️ Instalação e Execução

### Pré-requisitos
- **Node.js** v18 ou superior.

### Passo 1: Instalar as Dependências
Abra o terminal no diretório do projeto e instale os pacotes necessários:
```bash
npm install
```

As principais bibliotecas instaladas são:
- `@turf/turf`: Geoprocessamento geodésico de precisão real.
- `canvas`: Manipulação e renderização nativa de imagens de alta definição.
- `pdfjs-dist`: Parser robusto de vetores de PDF.
- `proj4`: Transformações de coordenadas espaciais geodésicas.
- `pdf-lib`: Utilitário para gerar PDFs de demonstração com fontes vetoriais.

---

### Passo 2: Criar o PDF de Demonstração (Livre de Dados Reais)
Para testar a ferramenta sem expor dados reais, execute o utilitário que gera um arquivo PDF georreferenciado fictício chamado `exemplo_sigef.pdf` com 4 vértices fechando um polígono perfeito na região Norte:
```bash
node create_example.js
```

### Passo 3: Executar a Extração e Geração de Mapas
Com os arquivos PDF de memorial presentes no diretório, execute o pipeline principal:
```bash
node index.js
```

Após o processamento concluído (geralmente levando menos de **1.5s** por arquivo), você encontrará todos os resultados gerados na pasta `./output/[NOME_DO_PDF]/`:
- `mapa.png`: Imagem 2D do mapa de alta resolução (4000x4000px).
- `mapa_3d.png`: Imagem 3D isométrica com relevo e sombreamento solar.
- `mapa.svg`: Vetor escalável de alta definição.
- `mapa.geojson`: Arquivo geográfico OGC RFC 7946 ideal para GIS.
- `mapa.dxf`: Desenho industrial AutoCAD em metros escala 1:1.
- `vertices.json`: Lista estruturada JSON dos vértices e coordenadas.
- `log.txt`: Relatório de valorações topográficas com cálculos do Turf.js.

---

## 📄 Licença e Direitos Autorais

Este projeto é disponibilizado sob a licença open-source MIT. 

Desenvolvido inteiramente por **Diego Oris**. Sinta-se livre para utilizar, customizar, integrar e distribuir!
