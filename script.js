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
const btnCes = document.querySelector('.ces');

const betRange = document.getElementById('bet-range');
const betAmountDisplay = document.getElementById('bet-amount-display');

let currentRoomId = null; 
let myPlayerKey = 'fri'; 
let myNick = 'Вы';

function createShuffledDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let deck = [];
  for (let suit of suits) {
    for (let val of values) {
      deck.push({ text: val + suit, isRed: (suit === '♥' || suit === '♦') });
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
      lobbyList.innerHTML += '<p style="font-size:12px; color:#888; text-align:center; margin-top:10px;">Активных игр нет.</p>';
    }
    return;
  }

  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    const countPlayers = room.players ? Object.keys(room.players).length : 0;
    const displayRoomName = room.roomName ? room.roomName : `Комната ${room.creator}`;

    if (room.status === 'waiting' && lobbyList && !currentRoomId) {
      const lobbyItem = document.createElement('div');
      lobbyItem.style.margin = "5px 0";
      lobbyItem.innerHTML = `
        <button class="menu-btn join-btn" data-room="${roomId}" style="background:#2e7d32; margin:0;">${displayRoomName} (${countPlayers}/4) — Войти</button>
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
      if(confirm("Удалить комнату?")) {
        database.ref('rooms/' + targetRoomId).remove();
      }
    });
  });
});

function nextTurn(roomRef, data) {
  const order = ['van', 'ty', 'fri', 'fo'];
  const current = data.currentTurn || 'fri';
  let currentIndex = order.indexOf(current);
  let currentRoundMoves = (data.roundMoves || 0) + 1;
  const totalPlayers = data.playersInGame || Object.keys(data.players).length;

  if (currentRoundMoves >= totalPlayers) {
    let currentStage = data.pokerStage || 'preflop';
    let nextStage = 'preflop';
    let cardsVisible = 0;

    if (currentStage === 'preflop') { nextStage = 'flop'; cardsVisible = 3; }
    else if (currentStage === 'flop') { nextStage = 'turn'; cardsVisible = 4; }
    else if (currentStage === 'turn') { nextStage = 'river'; cardsVisible = 5; }
    else { nextStage = 'showdown'; cardsVisible = 5; }

    roomRef.update({
      pokerStage: nextStage,
      tableCardsVisible: cardsVisible,
      roundMoves: 0,
      currentTurn: 'fri'
    });
    return;
  }

  for (let i = 1; i <= 4; i++) {
    let nextIndex = (currentIndex + i) % 4;
    let nextPos = order[nextIndex];
    if (data.players && data.players[nextPos]) {
      roomRef.update({ currentTurn: nextPos, roundMoves: currentRoundMoves });
      break;
    }
  }
}

function listenToRoom() {
  database.ref('rooms/' + currentRoomId).on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const countPlayers = data.players ? Object.keys(data.players).length : 0;
    const lobbyList = document.querySelector('.lobby-list');

    if (data.status === 'waiting' && lobbyList) {
      if (data.creator === myNick) {
        lobbyList.innerHTML = `
          <h3>Ожидание друзей (${countPlayers}/4)</h3>
          <button id="start-match-btn" class="menu-btn" style="background:#ff9800;">Запустить матч</button>
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
          updates[`playersInGame`] = countPlayers;
          database.ref('rooms/' + currentRoomId).update(updates);
        });
      } else {
        lobbyList.innerHTML = `<h3>Вы в лобби. Ждем создателя... (${countPlayers}/4)</h3>`;
      }
    }

    if (data.status === 'playing' && gameScreen && gameScreen.style.display === 'none') {
      showScreen(gameScreen);
    }

    const isMyTurn = data.currentTurn === myPlayerKey;
    if (btnChec) btnChec.disabled = !isMyTurn;
    if (btnVa) btnVa.disabled = !isMyTurn;
    if (btnPas) btnPas.disabled = !isMyTurn;
    if (btnCes) btnCes.disabled = !isMyTurn;

    // 1. Обновление инфоблока
    const infoBlock = document.querySelector('.info');
    if (infoBlock && data.players && data.players[myPlayerKey]) {
      const myCurrentChips = data.players[myPlayerKey].chips;
      const turnText = isMyTurn ? "<b style='color:#00ff00;'>Ваш ход!</b>" : "Ожидание хода...";
      infoBlock.innerHTML = `
        <h2>Информация (${(data.pokerStage || 'preflop').toUpperCase()})</h2>
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

    // 2. РЕНДЕРИНГ КАРТ НА СТОЛЕ (в твою разметку .pok)
    const tableCardsBlock = document.getElementById('table-cards-display');
    if (tableCardsBlock && data.tableCards) {
      const visibleCount = data.tableCardsVisible || 0;
      let cardsHtml = '<div class="pok"><div class="table-cards">';
      for (let i = 0; i < 5; i++) {
        if (i < visibleCount) {
          const card = data.tableCards[i];
          cardsHtml += `<div class="card ${card.isRed ? 'red' : ''}">${card.text}</div>`;
        } else {
          cardsHtml += `<div class="card" style="background:#444; color:#666;">?</div>`;
        }
      }
      cardsHtml += '</div></div>';
      tableCardsBlock.innerHTML = cardsHtml;
    }

    // 3. РЕНДЕРИНГ ТВОИХ КАРМАННЫХ КАРТ (в блок .cardpp)
    const cardppBlock = document.querySelector('.cardpp');
    if (cardppBlock && data.players && data.players[myPlayerKey] && data.players[myPlayerKey].cards) {
      const myCards = data.players[myPlayerKey].cards;
      cardppBlock.innerHTML = `
        <div class="cardp ${myCards[0].isRed ? 'red' : ''}">${myCards[0].text}</div>
        <div class="cardp ${myCards[1].isRed ? 'red' : ''}">${myCards[1].text}</div>
      `;
    }

    // 4. ПОКАЗ АВАТАРОК И НИКОВ ИГРОКОВ (Зеленый ник у того, кто ходит)
    const positions = ['van', 'ty', 'fri', 'fo'];
    positions.forEach(pos => {
      const pBlock = document.querySelector('.' + pos);
      if (pBlock) {
        if (data.players && data.players[pos]) {
          pBlock.style.display = 'block';
          const currentBet = data.players[pos].bet || 0;
          const isTurn = data.currentTurn === pos;
          pBlock.innerHTML = `
            <span style="color: ${isTurn ? '#00ff00' : '#fff'}; font-weight: bold;">
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
  myNick = inputNick && inputNick.value.trim() !== "" ? inputNick.value.trim() : (isCreator ? "Создатель" : "Игрок");
  
  if (isCreator) {
    currentRoomId = 'room_' + Date.now();
    myPlayerKey = 'fri'; 
    const inputRoomName = document.getElementById('room-name-input');
    const finalRoomName = inputRoomName && inputRoomName.value.trim() !== "" ? inputRoomName.value.trim() : `Комната ${myNick}`;
    
    database.ref('rooms/' + currentRoomId).set({
      creator: myNick,
      roomName: finalRoomName,
      status: 'waiting',
      bank: 0, 
      currentTurn: 'fri', 
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
        roomRef.update({
          bank: data.bank + chosenBet,
          [`players/${myPlayerKey}/chips`]: myChips - chosenBet,
          [`players/${myPlayerKey}/bet`]: currentBet + chosenBet
        });
        nextTurn(roomRef, data);
      }
    });
  });
}

if (btnVa) {
  btnVa.addEventListener('click', () => {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.get().then((snapshot) => {
      const data = snapshot.val();
      if (data && data.currentTurn === myPlayerKey) {
        const myChips = data.players[myPlayerKey].chips;
        const currentBet = data.players[myPlayerKey].bet || 0;
        roomRef.update({
          bank: data.bank + myChips,
          [`players/${myPlayerKey}/chips`]: 0,
          [`players/${myPlayerKey}/bet`]: currentBet + myChips
        });
        nextTurn(roomRef, data);
      }
    });
  });
}

if (btnPas) {
  btnPas.addEventListener('click', () => {
    database.ref('rooms/' + currentRoomId).get().then((snapshot) => {
      const data = snapshot.val();
      if (data && data.currentTurn === myPlayerKey) {
        database.ref('rooms/' + currentRoomId).update({
          playersInGame: (data.playersInGame || 1) - 1
        });
        nextTurn(database.ref('rooms/' + currentRoomId), data);
      }
      location.reload();
    });
  });
}

if (btnCes) {
  btnCes.addEventListener('click', () => {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.get().then((snapshot) => {
      const data = snapshot.val();
      if (data && data.currentTurn === myPlayerKey) {
        nextTurn(roomRef, data);
      }
    });
  });
}
