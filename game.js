const canvas = document.getElementById("game-canvas");

const SQUARE_SIZE = 30;
const BOARD_W = Math.floor(canvas.clientWidth / SQUARE_SIZE);
const BOARD_H = Math.floor(canvas.clientWidth / SQUARE_SIZE);

class Color {
  static LIGHTGRAY = "#eaeaea";
  static GRAY = "#aaa";
}

function drawBorder(ctx, x, y, size, borderSize, color, bgColor) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);

  ctx.fillStyle = bgColor;
  ctx.fillRect(x * size + borderSize, y * size + borderSize, size - borderSize * 2, size - borderSize * 2);
}

class Square {
  static SIZE = SQUARE_SIZE;

  static empty = " ";
  static castle = "c";
  static capital = "C";
  static mountain = "m";

  constructor(y, x, type) {
    this.y = y;
    this.x = x;
    this.type = type;
    this.capturedBy = null;

    this.population = 0;

    if (this.type === Square.castle) {
      this.population === 40;
    }
  }

  capture(capturedBy) {
    this.capturedBy = capturedBy;
  }

  render(ctx) {
    if (this.capturedBy) {
      ctx.fillStyle = this.capturedBy.color;
    } else {
      ctx.fillStyle = "black";
    }

    let colors = [Color.LIGHTGRAY, "white"];

    if (this.type === Square.mountain) {
      colors = [Color.GRAY, Color.GRAY];
    } else if (this.type === Square.castle) {
      colors[0] = "yellow";
      colors[1] = "yellow";
    } else if (this.type === Square.capital) {
      colors[0] = "black";
    }

    if (this.capturedBy) {
      colors[1] = this.capturedBy.color;
    }

    drawBorder(ctx, this.x, this.y, Square.SIZE, 2, colors[0], colors[1]);

    // Draw population
    if (this.population > 0) {
      ctx.fillStyle = "white";
      ctx.fillText(this.population, this.x * Square.SIZE + 2, this.y * Square.SIZE + Square.SIZE / 2);
    }
  }

  update(tick) {
    if (this.capturedBy) {
      if (this.type === Square.capital || this.type === Square.castle) {
        this.population += 1;
      } else if (this.type === Square.empty && tick % 50 === 0) {
        this.population += 1;
      }
    }
  }
}

class Board {
  constructor(ctx, width, height, players) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.players = players;
    this.tick = 0;
    this.winner = null;

    this.players.forEach((p) => {
      p.onChange = () => this.render();
      p.board = this;
    });

    this.board = [];

    for (let y = 0; y < height; y++) {
      this.board.push(new Array(width));
      for (let x = 0; x < width; x++) {
        this.board[y][x] = new Square(y, x, Square.empty);
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isMountain = Math.random() < 0.1;
        const isCastle = Math.random() < 0.02;

        if (isCastle) {
          this.board[y][x] = new Square(y, x, Square.castle);
        } else if (isMountain) {
          this.board[y][x] = new Square(y, x, Square.mountain);
        }
      }
    }

    this.players.forEach((player) => {
      this.board[player.y][player.x] = new Square(player.y, player.x, Square.capital);
      this.board[player.y][player.x].capture(player);
    });
  }

  render() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.board[y][x].render(this.ctx);
      }
    }

    this.players.forEach((player) => player.render(this.ctx));
  }

  computeStats() {
    let playerToCapital = {};
    let playerToSquares = {};
    let playerToPopulation = {};

    this.players.forEach((p) => {
      playerToCapital[p.name] = false;
      playerToSquares[p.name] = 0;
      playerToPopulation[p.name] = 0;
    });

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sq = this.board[y][x];
        if (sq.capturedBy) {
          if (sq.type === Square.capital) {
            playerToCapital[sq.capturedBy.name] = true;
          }
          playerToSquares[sq.capturedBy.name] += 1;
          playerToPopulation[sq.capturedBy.name] += sq.population;
        }
      }
    }

    const statsElm = document.getElementById("stats");

    this.players.forEach((player) => {
      // Check game end
      // remove player without capital
      if (!playerToCapital[player.name]) {
        this.players = this.players.filter((p) => p.name !== player.name);

        if (this.players.length === 1) {
          this.winner = this.players[0];
          return;
        }
      }

      // Write stats
      const elmId = "stats-" + player.name;

      let elm = document.getElementById(elmId);
      if (!elm) {
        elm = document.createElement("tr");
        elm.id = elmId;
        statsElm.appendChild(elm);
      }

      elm.innerHTML = `<td>${player.name}</td><td>${playerToPopulation[player.name]}</td><td>${
        playerToSquares[player.name]
      }</td>`;
    });
  }

  showEnd() {
    const scoreElm = document.getElementById("score-screen");
    scoreElm.innerText = `The winner is ${this.winner.name}!`;
    scoreElm.classList.remove("score-hide");
    scoreElm.classList.add("score-display");
  }

  update() {
    if (this.winner) {
      this.showEnd();
      return;
    }

    this.tick += 1;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.board[y][x].update(this.tick);
      }
    }

    this.players.forEach((player) => {
      player.update(this.tick);

      const action = player.actionQueue.shift();
      if (action) {
        const fromSq = this.board[action.y][action.x];
        const toSq = this.board[action.dy][action.dx];

        if (fromSq.capturedBy !== player) return;
        if (toSq.type === Square.mountain) {
          player.actionQueue = [];
          return;
        }

        const willCapture = fromSq.population > toSq.population + 1;
        if (toSq.capturedBy === null) {
          toSq.population = fromSq.population - toSq.population - 1;
          fromSq.population = 1;
        } else if (toSq.capturedBy === fromSq.capturedBy) {
          toSq.population = toSq.population + fromSq.population - 1;
          fromSq.population = 1;
        } else if (toSq.capturedBy !== fromSq.capturedBy) {
          if (willCapture) {
            toSq.population = fromSq.population - toSq.population;
          } else {
            toSq.population = toSq.population - fromSq.population;
          }
          fromSq.population = 1;
        }

        if (willCapture) {
          toSq.capturedBy = fromSq.capturedBy;
        }
      }
    });

    this.computeStats();

    this.render();

    setTimeout(() => this.update(), 250);
  }
}

function createAction(y, x, dy, dx) {
  return {
    y,
    x,
    dy,
    dx,
  };
}

class Player {
  board = null;

  constructor(y, x, name, color) {
    this.sy = y;
    this.y = y;
    this.sx = x;
    this.x = x;

    this.name = name;
    this.color = color;
    this.isActionActive = false;

    this.actionQueue = [];

    this.onChange = () => null;
  }

  render(ctx) {
    if (this.isActionActive) {
      ctx.fillStyle = "#00aa0055";
    } else {
      ctx.fillStyle = "#00aa0033";
    }
    ctx.fillRect(this.x * Square.SIZE, this.y * Square.SIZE, Square.SIZE, Square.SIZE);
  }

  update(tick) {}

  move(dy, dx) {
    const origx = this.x,
      origy = this.y;

    let ny = this.y + dy;
    let nx = this.x + dx;

    if (ny < 0) ny = 0;
    if (ny >= BOARD_H) ny = BOARD_H - 1;
    if (nx < 0) nx = 0;
    if (nx >= BOARD_W) nx = BOARD_W - 1;

    let hasMoved = false;

    if (this.y !== ny || this.x !== nx) {
      hasMoved = true;
    }

    this.y = ny;
    this.x = nx;

    if (hasMoved) {
      if (this.isActionActive) {
        this.actionQueue.push(createAction(origy, origx, ny, nx));
      }

      this.onChange();
    }

    return hasMoved;
  }
}

class RandomPlayer extends Player {
  POSSIBLE_MOVES = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  update(tick) {
    const move = this.POSSIBLE_MOVES[Math.floor(Math.random() * this.POSSIBLE_MOVES.length)];

    if (this.board.board[this.y][this.x].capturedBy === null) {
      this.y = this.sy;
      this.x = this.sx;
    }

    this.isActionActive = true;

    this.move(move[0], move[1]);
  }
}

class KeyboardPlayer extends Player {
  connect(canvas) {
    window.onkeydown = (evt) => this.onKeyDown(evt);
    canvas.onclick = (evt) => this.onClick(evt);
  }

  onKeyDown(evt) {
    // console.log("pressed", evt);

    if (evt.code === "space") {
      this.isActionActive = !this.isActionActive;
    }

    switch (evt.code) {
      case "Space":
        console.log("Space");
        this.isActionActive = !this.isActionActive;
        this.onChange();
        break;
      case "ArrowUp":
      case "KeyW":
        console.log("Up");
        this.move(-1, 0);
        break;
      case "ArrowDown":
      case "KeyS":
        this.move(1, 0);
        console.log("Down");
        break;
      case "ArrowLeft":
      case "KeyA":
        this.move(0, -1);
        console.log("Left");
        break;
      case "ArrowRight":
      case "KeyD":
        this.move(0, 1);
        console.log("Right");
        break;
    }
  }

  onClick(evt) {
    console.log(evt);

    const clickedX = Math.floor(evt.offsetX / Square.SIZE);
    const clickedY = Math.floor(evt.offsetY / Square.SIZE);

    console.log("Clicked", clickedX, clickedY);

    this.x = clickedX;
    this.y = clickedY;
  }
}

function generateStart(boardHeight, boardWidth) {
  // generate pair of coords for the board size, so that coords are at least boardSize apart

  const boardSize = (boardWidth + boardHeight) / 2;

  let dist = boardSize - 1;
  let x1, x2, y1, y2;

  while (dist < boardSize) {
    x1 = Math.floor(Math.random() * boardWidth);
    y1 = Math.floor(Math.random() * boardHeight);
    x2 = Math.floor(Math.random() * boardWidth);
    y2 = Math.floor(Math.random() * boardHeight);

    dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  return [x1, y1, x2, y2];
}

function startGame() {
  const canvas = document.getElementById("game-canvas");
  canvas.width = 600;
  canvas.height = 600;

  const ctx = canvas.getContext("2d");

  const [sx1, sy1, sx2, sy2] = generateStart(BOARD_H, BOARD_W);

  const p1 = new KeyboardPlayer(sy1, sx1, "Player 1", "blue");
  p1.connect(canvas);
  const p2 = new RandomPlayer(sy2, sx2, "Bot", "red");

  const board = new Board(ctx, BOARD_H, BOARD_W, [p1, p2]);

  board.update();
}

window.onload = function () {
  startGame();
};
