// Variáveis globais para controle
let cor = [0, 0, 0];        // Armazena a cor atual [R, G, B]
let pesoTraco = 10;         // Espessura inicial do traço
let fundo = 255;            // Cor de fundo (branco)

function setup() {
  // Configuração inicial do sketch
  createCanvas(windowWidth, windowHeight);  // Cria canvas do tamanho da janela
  background(fundo);         // Pinta o fundo de branco
  stroke(cor);               // Define cor inicial do traço (preto)
  strokeWeight(pesoTraco);   // Define espessura inicial do traço
  strokeCap(ROUND);          // Arredonda as pontas das linhas
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
    case 'c': // Limpa o canvas
      background(fundo);
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
  // Redimensiona o canvas se a janela mudar de tamanho
  resizeCanvas(windowWidth, windowHeight);
}