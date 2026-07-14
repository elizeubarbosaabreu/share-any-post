# Share Any Post

Extensão para Chrome que permite compartilhar qualquer postagem da internet como story 9:16 com QR code.

## Funcionalidades

- Extrai título, imagem e link de qualquer página
- Gera story 9:16 com gradient roxo
- Inclui QR code para acessar o link original
- Espaço reservado para botão/link com sombra
- Opção de baixar imagem ou copiar texto

## Instalação

1. Abra `chrome://extensions/`
2. Ative o "Modo desenvolvedor"
3. Clique em "Carregar extensão sem empacotamento"
4. Selecione a pasta `share-any-post`

## Uso

1. Navegue para qualquer página web
2. Clique no ícone da extensão
3. Clique em "Gerar Story 9:16"
4. Baixe a imagem ou copie o texto

## Estrutura

```
share-any-post/
├── manifest.json    # Configuração da extensão
├── background.js    # Service worker para fetch de imagens
├── content.js       # Script de extração de dados
├── popup.html       # Interface do popup
├── popup.js         # Lógica de geração de story
├── qrcode.js        # Gerador de QR code
└── icons/           # Ícones da extensão
```