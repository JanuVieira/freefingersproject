// Variáveis globais para controle
let cor = [0, 0, 0];        // Armazena a cor atual [R, G, B]
let pesoTraco = 10;         // Espessura inicial do traço
let fundo = 255;            // Cor de fundo (branco)

// Variável para armazenar o fundo pontilhado como imagem
let fundoPontilhado;

function setup() {
  // Cria canvas do tamanho *5 da janela do usuário 
  createCanvas(windowWidth * 5, windowHeight * 5);  
  
  // Cria o fundo pontilhado como uma imagem separada
  criarFundoPontilhado();
  
  // Define configurações de desenho
  stroke(cor);              // Cor inicial do traço (preto)         
  strokeWeight(pesoTraco);  // Espessura inicial do traço               
  strokeCap(ROUND);         // Pontas arredondadas
}

function draw() {
  // Função principal de desenho (executada continuamente)
  if (mouseIsPressed) {
    // Quando o mouse é pressionado:
    line(pmouseX, pmouseY, mouseX, mouseY);  // Desenha linha da posição anterior até a atual
  }
}

function keyPressed() {
  // Função chamada ao pressionar teclas
  switch(key) {
    case 'c': // Limpa o canvas (mantém o fundo pontilhado)
      // Limpa tudo e redesenha o fundo
      background(fundoPontilhado);
      break;
    case 'e': // Modo borracha (branco)
      cor = [fundo, fundo, fundo];
      break;
    case '1': // Preto
      cor = [0, 0, 0];
      break;
    case '2': // Vermelho
      cor = [255, 0, 0];
      break;
    case '3': // Verde
      cor = [0, 255, 0];
      break;
    case '4': // Azul
      cor = [0, 0, 255];
      break;
    case '+': // Aumenta espessura (+5)
      pesoTraco = min(pesoTraco + 5, 50); // Limite máximo de 50
      break;
    case '-': // Diminui espessura (-5)
      pesoTraco = max(pesoTraco - 5, 5); // Limite mínimo de 5
      break;
    case 's': // Salva a imagem
      saveCanvas('meu_desenho', 'png');
      break;
  }
  
  // Aplica as novas configurações
  stroke(cor);
  strokeWeight(pesoTraco);
}

function windowResized() {
  // Redimensiona o canvas para 5x o tamanho da janela
  resizeCanvas(windowWidth * 5, windowHeight * 5);
  
  // Recria o fundo para o novo tamanho
  criarFundoPontilhado();
}

// Cria o fundo pontilhado como imagem
function criarFundoPontilhado() {
  // Cria um buffer gráfico para o fundo
  let buffer = createGraphics(width, height);
  
  // Configurações do fundo
  buffer.background(fundo); // Fundo branco
  
  const espacamento = 20;        // Distância entre pontos
  const tamanhoPonto = 1.3;      // Diâmetro dos pontos
  const tomCinza = 120;          // Tom de cinza (0-255)
  
  buffer.noStroke();             // Desativa contorno
  buffer.fill(tomCinza);         // Define cor dos pontos
  
  // Desenha os pontos no buffer
  for (let x = espacamento/2; x < width; x += espacamento) {
    for (let y = espacamento/2; y < height; y += espacamento) {
      buffer.circle(x, y, tamanhoPonto);
    }
  }
  
  // Salva o buffer como imagem
  fundoPontilhado = buffer.get();
  
  // Aplica o fundo ao canvas principal
  background(fundoPontilhado);
}