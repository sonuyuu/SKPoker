const firebaseConfig = {
  apiKey: "AIzaSyDslvcK9iPk7iNEFt1OET7P-DeVvLYZrio",
  authDomain: "poker-9f36f.firebaseapp.com",
  databaseURL: "https://poker-9f36f-default-rtdb.firebaseio.com",
  projectId: "poker-9f36f",
  storageBucket: "poker-9f36f.firebasestorage.app",
  messagingSenderId: "463201306117",
  appId: "1:463201306117:web:92cebf168dd4ad177e3e6c"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const menuScreen = document.getElementById('menu-screen');
const rulesScreen = document.getElementById('rules-screen');
const gameScreen = document.getElementById('game-screen');
const adminScreen = document.getElementById('admin-screen');

const createGameBtn = document.getElementById('create-game-btn');
const showRulesBtn = document.getElementById('show-rules-btn');
const closeRulesBtn = document.getElementById('close-rules-btn');
const openAdminBtn = document.getElementById('open-admin-btn');
const closeAdminBtn = document.getElementById('close-admin-btn');

const btnChec = document.querySelector('.chec');
const btnVa = document.querySelector('.va');
const btnPas = document.querySelector('.pas');
const btnCes = document.querySelector('.ces'); // Кнопка Чек / Колл

const betRange = document.getElementById('bet-range');
const betAmountDisplay = document.getElementById('bet-amount-display');

let currentRoomId = null; 
let myPlayerKey = 'fri'; 
let myNick = 'Игрок';

// Карта рангов для оценки комбинаций
const RANK_ORDER = "2345678910JQKA";
const COMBINATIONS = {
  ROYAL_FLUSH: 9, STRAIGHT_FLUSH: 8, FOUR_OF_A_KIND: 7, FULL_HOUSE: 6,
  FLUSH: 5, STRAIGHT: 4, THREE_OF_A_KIND: 3, TWO_PAIR: 2, PAIR: 1, HIGH_CARD: 0
};

function createShuffledDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let deck = [];
  for (let suit of suits) {
    for (let val of values) {
      deck.push({ text: val + suit, value: val, suit: suit, isRed: (suit === '♥' || suit === '♦') });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function showScreen(screenToShow) {
  if(menuScreen) menuScreen.style.display = 'none';
  if(rulesScreen) rulesScreen.style.display = 'none';
  if(gameScreen) gameScreen.style.display = 'none';
  if(adminScreen) adminScreen.style.display = 'none';
  if(screenToShow) screenToShow.style.display = 'block';
}

if (betRange && betAmountDisplay) {
  betRange.addEventListener('input', (e) => {
    betAmountDisplay.textContent = `Ставка: ${e.target.value}sk`;
  });
}

// Покерный движок оценки комбинаций (выбирает лучшие 5 карт из 7 доступных)
function evaluate7Cards(cards) {
  let bestScore = -1;
  let bestCombName = "Старшая карта";
  
  // Перебираем все возможные комбинации по 5 карт из 7 доступных
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      let fiveCards = cards.filter((_, idx) => idx !== i && idx !== j);
      let res = evaluate5Cards(fiveCards);
      if (res.score > bestScore) {
        bestScore = res.score;
        bestCombName = res.name;
      }
    }
  }
  return { score: bestScore, name: bestCombName };
}

function evaluate5Cards(cards) {
  let values = cards.map(c => c.value);
  let suits = cards.map(c => c.suit);
  
  let ranks = values.map(v => RANK_ORDER.indexOf(v)).sort((a,b) => a-b);
  let isFlush = suits.every(s => s === suits[0]);
  
  let isStraight = false;
  if (ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5) isStraight = true;
  // Особый случай стрита от Туза (A-2-3-4-5)
  if (ranks.join(',') === '0,1,2,3,12') isStraight = true;

  let counts = {};
  values.forEach(v => counts[v] = (counts[v] || 0) + 1);
  let countValues = Object.values(counts).sort((a,b) => b-a);

  // Считаем вес карт для разруливания кикеров при одинаковых комбинациях
  let tierScore = ranks.reduce((acc, r) => acc + r, 0);

  if (isStraight && isFlush && values.includes('A') && values.includes('K')) {
    return { score: COMBINATIONS.ROYAL_FLUSH * 1000 + tierScore, name: "Рояль-Флеш" };
  }
  if (isStraight && isFlush) {
    return { score: COMBINATIONS.STRAIGHT_FLUSH * 1000 + tierScore, name: "Стрит-Флеш" };
  }
  if (countValues[0] === 4) {
    return { score: COMBINATIONS.FOUR_OF_A_KIND * 1000 + tierScore, name: "Каре" };
  }
  if (countValues[0] === 3 && countValues[1] === 2) {
    return { score: COMBINATIONS.FULL_HOUSE * 1000 + tierScore, name: "Фулл-Хаус" };
  }
  if (isFlush) {
    return { score: COMBINATIONS.FLUSH * 1000 + tierScore, name: "Флеш" };
  }
  if (isStraight) {
    return { score: COMBINATIONS.STRAIGHT * 1000 + tierScore, name: "Стрит" };
  }
  if (countValues[0] === 3) {
    return { score: COMBINATIONS.THREE_OF_A_KIND * 1000 + tierScore, name: "Сет (Тройка)" };
  }
  if (countValues[0] === 2 && countValues[1] === 2) {
    return { score: COMBINATIONS.TWO_PAIR * 1000 + tierScore, name: "Две пары" };
  }
  if (countValues[0] === 2) {
    return { score: COMBINATIONS.PAIR * 1000 + tierScore, name: "Пара" };
  }
  return { score: COMBINATIONS.HIGH_CARD * 1000 + tierScore, name: "Старшая карта" };
}

// Определение победителя и распределение банка
function checkWinnerAndEnd(roomRef, data) {
  const players = data.players;
  const tableCards = data.tableCards;
  let activePlayers = Object.keys(players).filter(k => players[k].cards);

  if (activePlayers.length === 1) {
    // Если все скинули карты в пас, выигрывает последний оставшийся
    let winnerKey = activePlayers[0];
    let winnerName = players[winnerKey].name;
    roomRef.update({
      pokerStage: 'ended',
      winnerText: `Все сбросили. Победил ${winnerName}! Выигрыш: ${data.bank}sk`,
      [`players/${winnerKey}/chips`]: players[winnerKey].chips + data.bank,
      bank: 0
    });
    return;
  }

  // Сбор комбинаций для тех, кто дошел до вскрытия
  let bestPlayerScore = -1;
  let winnerKey = null;
  let winnerCombName = "";

  activePlayers.forEach(key => {
    let pCards = players[key].cards;
    let full7Cards = [...pCards, ...tableCards];
    let evaluation = evaluate7Cards(full7Cards);
    
    if (evaluation.score > bestPlayerScore) {
      bestPlayerScore = evaluation.score;
      winnerKey = key;
      winnerCombName = evaluation.name;
    }
  });

  let winnerName = players[winnerKey].name;
  roomRef.update({
    pokerStage: 'ended',
    winnerText: `Победил ${winnerName} с комбинацией [${winnerCombName}]! Выигрыш: ${data.bank}sk`,
    [`players/${winnerKey}/chips`]: players[winnerKey].chips + data.bank,
    bank: 0
  });
}

function nextTurn(roomRef, data) {
  const order = ['van', 'ty', 'fri', 'fo'];
  const current = data.currentTurn || 'fri';
  let currentIndex = order.indexOf(current);
  let currentRoundMoves = (data.roundMoves || 0) + 1;
  
  const activePlayersCount = Object.keys(data.players).filter(k => data.players[k].cards).length;
  if (activePlayersCount <= 1) {
    checkWinnerAndEnd(roomRef, data);
    return;
  }

  const totalPlayers = data.playersInGame || Object.keys(data.players).length;

  if (currentRoundMoves >= totalPlayers) {
    let currentStage = data.pokerStage || 'preflop';
    let nextStage = 'preflop';
    let cardsVisible = 0;

    // Сброс текущих ставок игроков перед новым кругом
    let resetBetsUpdates = {};
    Object.keys(data.players).forEach(k => {
      resetBetsUpdates[`players/${k}/bet`] = 0;
    });

    if (currentStage === 'preflop') { nextStage = 'flop'; cardsVisible = 3; }
    else if (currentStage === 'flop') { nextStage = 'turn'; cardsVisible = 4; }
    else if (currentStage === 'turn') { nextStage = 'river'; cardsVisible = 5; }
    else { 
      roomRef.update(resetBetsUpdates);
      checkWinnerAndEnd(roomRef, data); 
      return; 
    }

    roomRef.update({
      ...resetBetsUpdates,
      pokerStage: nextStage,
      tableCardsVisible: cardsVisible,
      roundMoves: 0,
      currentTurn: data.creatorKey || 'fri',
      currentMaxBet: 0
    });
    return;
  }

  for (let i = 1; i <= 4; i++) {
    let nextIndex = (currentIndex + i) % 4;
    let nextPos = order[nextIndex];
    if (data.players && data.players[nextPos] && data.players[nextPos].cards) {
      roomRef.update({ currentTurn: nextPos, roundMoves: currentRoundMoves });
      break;
    }
  }
}

database.ref('rooms').on('value', (snapshot) => {
  const rooms = snapshot.val();
  const lobbyList = document.querySelector('.lobby-list');
  const adminRoomsList = document.getElementById('admin-rooms-list');
  
  if (lobbyList && !currentRoomId) {
    lobbyList.innerHTML = '<h3>Доступные игры:</h3>';
  }
  if (adminRoomsList) adminRoomsList.innerHTML = '';

  if (!rooms) {
    if (lobbyList && !currentRoomId) {
      lobbyList.innerHTML += '<p style="font-size:12px; color:#888; text-align:center; margin-top:10px;">Активных игр нет. Создайте первую!</p>';
    }
    return;
  }

  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    const countPlayers = room.players ? Object.keys(room.players).length : 0;
    const displayRoomName = room.roomName ? room.roomName : `Комната ${room.creator}`;

    if (room.status === 'waiting' && lobbyList && !currentRoomId) {
      const lobbyItem = document.createElement('div');
      lobbyItem.style.margin = "8px 0";
      lobbyItem.innerHTML = `
        <button class="menu-btn join-btn" data-room="${roomId}" style="background:#2e7d32; margin:0; padding: 8px 15px;">${displayRoomName} (${countPlayers}/4) — Войти</button>
      `;
      lobbyList.appendChild(lobbyItem);
    }

    if (adminRoomsList) {
      const adminItem = document.createElement('div');
      adminItem.style.padding = "5px";
      adminItem.innerHTML = `
        <span>${displayRoomName}</span> 
        <button class="delete-room-btn" data-room="${roomId}" style="color:red; background:none; border:none; margin-left:10px;">[Удалить]</button>
      `;
      adminRoomsList.appendChild(adminItem);
    }
  });

  if (!currentRoomId) {
    document.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const selectedRoomId = e.currentTarget.getAttribute('data-room');
        setupLobby(false, selectedRoomId);
      });
    });
  }

  document.querySelectorAll('.delete-room-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetRoomId = e.target.getAttribute('data-room');
      if(confirm("Удалить эту комнату?")) {
        database.ref('rooms/' + targetRoomId).remove();
      }
    });
  });
});

function listenToRoom() {
  database.ref('rooms/' + currentRoomId).on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const countPlayers = data.players ? Object.keys(data.players).length : 0;
    const lobbyList = document.querySelector('.lobby-list');

    if (data.status === 'waiting' && lobbyList) {
      if (data.creatorKey === myPlayerKey) {
        lobbyList.innerHTML = `
          <h3 style="margin-bottom:10px;">Ожидание игроков (${countPlayers}/4)</h3>
          <button id="start-match-btn" class="menu-btn" style="background:#ff9800; border:none;">Запустить матч</button>
        `;
        document.getElementById('start-match-btn').addEventListener('click', () => {
          const deck = createShuffledDeck();
          let updates = {};
          Object.keys(data.players).forEach(key => {
            updates[`players/${key}/cards`] = [deck.pop(), deck.pop()];
          });
          updates[`tableCards`] = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
          updates[`status`] = 'playing';
          updates[`pokerStage`] = 'preflop';
          updates[`tableCardsVisible`] = 0;
          updates[`roundMoves`] = 0;
          updates[`currentMaxBet`] = 0;
          updates[`playersInGame`] = countPlayers;
          database.ref('rooms/' + currentRoomId).update(updates);
        });
      } else {
        lobbyList.innerHTML = `<h3 style="color:#aaa;">Вы в лобби комнаты "${data.roomName}". Ожидаем запуска игры создателем... (${countPlayers}/4)</h3>`;
      }
    }

    if (data.status === 'playing' && gameScreen && gameScreen.style.display === 'none') {
      showScreen(gameScreen);
    }

    const isMyTurn = data.currentTurn === myPlayerKey && data.pokerStage !== 'ended';
    const currentMaxBet = data.currentMaxBet || 0;
    const myCurrentBet = (data.players[myPlayerKey] && data.players[myPlayerKey].bet) || 0;
    const needToCall = currentMaxBet - myCurrentBet;

    if (btnChec) btnChec.disabled = !isMyTurn;
    if (btnVa) btnVa.disabled = !isMyTurn;
    if (btnPas) btnPas.disabled = !isMyTurn;
    
    // Динамическое переключение Кнопки Чек / Колл
    if (btnCes) {
      btnCes.disabled = !isMyTurn;
      if (needToCall > 0) {
        btnCes.textContent = `Колл (${needToCall}sk)`;
      } else {
        btnCes.textContent = "Чек";
      }
    }

    // 1. Обновление инфоблока
    const infoBlock = document.querySelector('.info');
    if (infoBlock && data.players && data.players[myPlayerKey]) {
      const myCurrentChips = data.players[myPlayerKey].chips;
      let turnText = isMyTurn ? "<b style='color:#00ff00;'>Ваш ход!</b>" : "Ожидание хода соперника...";
      let stageTitle = (data.pokerStage || 'preflop').toUpperCase();

      if (data.pokerStage === 'ended') {
        turnText = `<b style='color:#ff9800;'>Игра окончена!</b><br><span style="font-size:12px; color:#fff;">${data.winnerText || ""}</span><br><button onclick="location.reload()" class="menu-btn" style="margin-top:10px; background:#b71c1c; padding:5px 10px; font-size:12px;">Выйти в меню</button>`;
        stageTitle = "КОНЕЦ МАТЧА";
      }

      infoBlock.innerHTML = `
        <h2>Информация (${stageTitle})</h2>
        <p>Статус: ${turnText}</p>
        <p>Игроки в игре: ${data.playersInGame || countPlayers}</p>
        <p>Банк: ${data.bank || 0}sk</p>
        <p>Ваш баланс: ${myCurrentChips}sk</p>
      `;
      if (betRange) {
        betRange.max = myCurrentChips;
        betRange.disabled = myCurrentChips <= 0 || !isMyTurn;
      }
    }

    // 2. Рендеринг карт на столе
    const tableCardsBlock = document.getElementById('table-cards-display');
    if (tableCardsBlock && data.tableCards) {
      const visibleCount = data.tableCardsVisible || 0;
      let cardsHtml = '<div class="pok"><div class="table-cards">';
      for (let i = 0; i < 5; i++) {
        if (i < visibleCount) {
          const card = data.tableCards[i];
          cardsHtml += `<div class="card ${card.isRed ? 'red' : ''}">${card.text}</div>`;
        } else {
          cardsHtml += `<div class="card" style="background:#333; color:#555; border:1px dashed #666;">?</div>`;
        }
      }
      cardsHtml += '</div></div>';
      tableCardsBlock.innerHTML = cardsHtml;
    }

    // 3. Рендеринг твоих карт внизу
    const cardppBlock = document.querySelector('.cardpp');
    if (cardppBlock && data.players && data.players[myPlayerKey] && data.players[myPlayerKey].cards) {
      const myCards = data.players[myPlayerKey].cards;
      cardppBlock.innerHTML = `
        <div class="cardp ${myCards[0].isRed ? 'red' : ''}">${myCards[0].text}</div>
        <div class="cardp ${myCards[1].isRed ? 'red' : ''}">${myCards[1].text}</div>
      `;
    }

    // 4. Показ аватарок игроков без багов отображения ников
    const positions = ['van', 'ty', 'fri', 'fo'];
    positions.forEach(pos => {
      const pBlock = document.querySelector('.' + pos);
      if (pBlock) {
        if (data.players && data.players[pos]) {
          pBlock.style.display = 'block';
          const currentBet = data.players[pos].bet || 0;
          const isTurn = data.currentTurn === pos && data.pokerStage !== 'ended';
          const hasFolded = !data.players[pos].cards;
          
          pBlock.innerHTML = `
            <span style="color: ${isTurn ? '#00ff00' : '#fff'}; font-weight: bold; text-decoration: ${hasFolded ? 'line-through' : 'none'}">
              ${pos === myPlayerKey ? 'Вы' : data.players[pos].name}
            </span><br>
            <span class="rask">${data.players[pos].chips}sk (${currentBet}sk)</span>
          `;
        } else {
          pBlock.style.display = 'none';
        }
      }
    });
  });
}

function setupLobby(isCreator, roomId = null) {
  const inputNick = document.getElementById('username-input');
  myNick = inputNick && inputNick.value.trim() !== "" ? inputNick.value.trim() : "Игрок_" + Math.floor(Math.random() * 900 + 100);
  
  if (isCreator) {
    currentRoomId = 'room_' + Date.now();
    myPlayerKey = 'fri'; 
    const inputRoomName = document.getElementById('room-name-input');
    const finalRoomName = inputRoomName && inputRoomName.value.trim() !== "" ? inputRoomName.value.trim() : `Комната ${myNick}`;
    
    database.ref('rooms/' + currentRoomId).set({
      creator: myNick,
      creatorKey: 'fri',
      roomName: finalRoomName,
      status: 'waiting',
      bank: 0, 
      currentTurn: 'fri', 
      currentMaxBet: 0,
      players: { fri: { name: myNick, chips: 100, bet: 0 } }
    });
  } else {
    currentRoomId = roomId;
    database.ref('rooms/' + currentRoomId + '/players').get().then((snapshot) => {
      const currentPlayers = snapshot.val() || {};
      const positions = ['van', 'ty', 'fo'];
      for (let pos of positions) {
        if (!currentPlayers[pos]) { myPlayerKey = pos; break; }
      }
      database.ref('rooms/' + currentRoomId + '/players/' + myPlayerKey).set({
        name: myNick, chips: 100, bet: 0
      });
    });
  }
  listenToRoom();
}

if (createGameBtn) createGameBtn.addEventListener('click', () => setupLobby(true));
if (showRulesBtn) showRulesBtn.addEventListener('click', () => showScreen(rulesScreen));
if (closeRulesBtn) closeRulesBtn.addEventListener('click', () => showScreen(menuScreen));
if (openAdminBtn) openAdminBtn.addEventListener('click', () => showScreen(adminScreen));
if (closeAdminBtn) closeAdminBtn.addEventListener('click', () => showScreen(menuScreen));

// Кнопка Сделать Ставку (Повысить / Рэйз)
if (btnChec) {
  btnChec.addEventListener('click', () => {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.get().then((snapshot) => {
      const data = snapshot.val();
      if (!data || data.currentTurn !== myPlayerKey) return;
      
      const myChips = data.players[myPlayerKey].chips;
      const currentBet = data.players[myPlayerKey].bet || 0;
      const chosenBet = parseInt(betRange.value) || 0;

      if (chosenBet > 0 && myChips >= chosenBet) {
        const totalNewBet = currentBet + chosenBet;
        roomRef.update({
          bank: data.bank + chosenBet,
          currentMaxBet: totalNewBet > (data.currentMaxBet || 0) ? totalNewBet : data.currentMaxBet,
          [`players/${myPlayerKey}/chips`]: myChips - chosenBet,
          [`players/${myPlayerKey}/bet`]: totalNewBet
        });
        nextTurn(roomRef, data);
      }
    });
  });
}

// Кнопка Ва-Банк
if (btnVa) {
  btnVa.addEventListener('click', () => {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.get().then((snapshot) => {
      const data = snapshot.val();
      if (data && data.currentTurn === myPlayerKey) {
        const myChips = data.players[myPlayerKey].chips;
        const currentBet = data.players[myPlayerKey].bet || 0;
        const totalNewBet = currentBet + myChips;
        roomRef.update({
          bank: data.bank + myChips,
          currentMaxBet: totalNewBet > (data.currentMaxBet || 0) ? totalNewBet : data.currentMaxBet,
          [`players/${myPlayerKey}/chips`]: 0,
          [`players/${myPlayerKey}/bet`]: totalNewBet
        });
        nextTurn(roomRef, data);
      }
    });
  });
}

// Кнопка Чек / Колл (Уравнять)
if (btnCes) {
  btnCes.addEventListener('click', () => {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.get().then((snapshot) => {
      const data = snapshot.val();
      if (!data || data.currentTurn !== myPlayerKey) return;

      const myChips = data.players[myPlayerKey].chips;
      const currentBet = data.players[myPlayerKey].bet || 0;
      const currentMaxBet = data.currentMaxBet || 0;
      const needToCall = currentMaxBet - currentBet;

      if (needToCall > 0) {
        // Логика Колла (Уравниваем ставку)
        const callAmount = needToCall > myChips ? myChips : needToCall;
        roomRef.update({
          bank: data.bank + callAmount,
          [`players/${myPlayerKey}/chips`]: myChips - callAmount,
          [`players/${myPlayerKey}/bet`]: currentBet + callAmount
        });
      }
      // Если уравнивать не нужно было, это простой Чек (ничего не списываем)
      nextTurn(roomRef, data);
    });
  });
}

// Кнопка Пас
if (btnPas) {
  btnPas.addEventListener('click', () => {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.get().then((snapshot) => {
      const data = snapshot.val();
      if (data && data.currentTurn === myPlayerKey) {
        roomRef.update({
          [`players/${myPlayerKey}/cards`]: null, // Сбрасываем карты в null
          playersInGame: (data.playersInGame || 1) - 1
        }).then(() => {
          // Получаем свежие данные после обновления, чтобы проверить на победу
          roomRef.get().then((newSnapshot) => {
            nextTurn(roomRef, newSnapshot.val());
          });
        });
      }
    });
  });
}
