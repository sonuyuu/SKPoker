function listenToRoom() {
  database.ref('rooms/' + currentRoomId).on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const countPlayers = data.players ? Object.keys(room.players).length : 0; // Сверяем игроков
    const isMyTurn = data.currentTurn === myPlayerKey && data.pokerStage !== 'ended';
    const currentMaxBet = data.currentMaxBet || 0;
    const myCurrentBet = (data.players[myPlayerKey] && data.players[myPlayerKey].bet) || 0;
    const needToCall = currentMaxBet - myCurrentBet;

    if (btnChec) btnChec.disabled = !isMyTurn;
    if (btnVa) btnVa.disabled = !isMyTurn;
    if (btnPas) btnPas.disabled = !isMyTurn;
    
    // Новая стабильная логика Чек / Колл
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
        <p>Игроки в игре: ${data.playersInGame || Object.keys(data.players).length}</p>
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

    // 4. Показ аватарок игроков — ТЕПЕРЬ ОТОБРАЖАЕТ ТВОЙ НИК, А НЕ "ВЫ"
    const positions = ['van', 'ty', 'fri', 'fo'];
    positions.forEach(pos => {
      const pBlock = document.querySelector('.' + pos);
      if (pBlock) {
        if (data.players && data.players[pos]) {
          pBlock.style.display = 'block';
          const currentBet = data.players[pos].bet || 0;
          const isTurn = data.currentTurn === pos && data.pokerStage !== 'ended';
          const hasFolded = !data.players[pos].cards;
          
          // Изменено тут: вместо 'Вы' всегда пишем имя из базы данных data.players[pos].name
          pBlock.innerHTML = `
            <span style="color: ${isTurn ? '#00ff00' : '#fff'}; font-weight: bold; text-decoration: ${hasFolded ? 'line-through' : 'none'}">
              ${data.players[pos].name}
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

// Переписанный обработчик кнопки Чек / Колл (исправлены сбои)
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

      let updates = {};

      if (needToCall > 0) {
        // Если это Колл (уравнивание)
        const callAmount = needToCall > myChips ? myChips : needToCall;
        updates[`bank`] = data.bank + callAmount;
        updates[`players/${myPlayerKey}/chips`] = myChips - callAmount;
        updates[`players/${myPlayerKey}/bet`] = currentBet + callAmount;
      } 
      
      // Отправляем атомарный апдейт в Firebase, затем передаем ход
      roomRef.update(updates).then(() => {
        roomRef.get().then((freshSnapshot) => {
          nextTurn(roomRef, freshSnapshot.val());
        });
      });
    });
  });
}

// Переписанный обработчик кнопки Ставка (исправлены сбои)
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
        let updates = {
          bank: data.bank + chosenBet,
          [`players/${myPlayerKey}/chips`]: myChips - chosenBet,
          [`players/${myPlayerKey}/bet`]: totalNewBet
        };

        if (totalNewBet > (data.currentMaxBet || 0)) {
          updates[`currentMaxBet`] = totalNewBet;
        }

        roomRef.update(updates).then(() => {
          roomRef.get().then((freshSnapshot) => {
            nextTurn(roomRef, freshSnapshot.val());
          });
        });
      }
    });
  });
}
