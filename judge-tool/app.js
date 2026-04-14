// ===== 状態管理 =====
const state = {
    playerA: '先攻',
    playerB: '後攻',
    currentPlayer: 'A', // 'A' = 先攻, 'B' = 後攻
    turnNumber: 1,
    actions: {},
    basicPokemon: [],   // たねポケモン（場に出した）
    evolutions: [],     // 進化 { from: '進化前', to: '進化後' }
    notes: '',
    log: [],
};

function initTurnActions() {
    state.actions = {
        supporter: { used: false, detail: '' },
        energy: { used: false, detail: '' },
        retreat: { used: false, detail: '' },
        stadium: { used: false, detail: '' },
        attack: { used: false, detail: '' },
    };
    state.basicPokemon = [];
    state.evolutions = [];
    state.notes = '';
}

// ===== DOM要素 =====
const turnLabel = document.getElementById('current-turn-label');
const btnNextTurn = document.getElementById('btn-next-turn');
const btnUndoTurn = document.getElementById('btn-undo-turn');
const btnReset = document.getElementById('btn-reset');
const firstTurnNotice = document.getElementById('first-turn-notice');
const basicPokemonName = document.getElementById('basic-pokemon-name');
const btnAddBasic = document.getElementById('btn-add-basic');
const basicPokemonList = document.getElementById('basic-pokemon-list');
const evoFromName = document.getElementById('evo-from-name');
const evoToName = document.getElementById('evo-to-name');
const btnAddEvolution = document.getElementById('btn-add-evolution');
const evolutionPokemonList = document.getElementById('evolution-pokemon-list');
const evolutionWarning = document.getElementById('evolution-warning');
const turnNotesArea = document.getElementById('turn-notes');
const logEntries = document.getElementById('log-entries');
const actionCards = document.querySelectorAll('.action-card');

// ===== 表示更新 =====
function updateTurnDisplay() {
    const playerName = state.currentPlayer === 'A' ? state.playerA : state.playerB;
    turnLabel.textContent = `${playerName} ${state.turnNumber}ターン目`;
    turnLabel.className = state.currentPlayer === 'A' ? 'player-a' : 'player-b';

    // 先攻1ターン目の制限
    const isFirstTurn = state.currentPlayer === 'A' && state.turnNumber === 1;
    firstTurnNotice.classList.toggle('hidden', !isFirstTurn);

    // サポートとワザの制限
    const supporterCard = document.querySelector('[data-action="supporter"]');
    const attackCard = document.querySelector('[data-action="attack"]');
    supporterCard.classList.toggle('disabled', isFirstTurn);
    attackCard.classList.toggle('disabled', isFirstTurn);

    // 戻すボタン
    btnUndoTurn.disabled = state.log.length === 0;
}

function updateActionCards() {
    actionCards.forEach(card => {
        const action = card.dataset.action;
        const actionState = state.actions[action];
        card.classList.toggle('used', actionState.used);
        card.querySelector('.action-status').textContent = actionState.used ? '使用済み ✓' : '未使用';
        card.querySelector('.action-detail').value = actionState.detail;
    });
}

function updatePokemonList() {
    // たねポケモン
    basicPokemonList.innerHTML = '';
    state.basicPokemon.forEach((name, i) => {
        const tag = document.createElement('div');
        tag.className = 'pokemon-tag basic';
        tag.innerHTML = `
            <span>${name}</span>
            <span class="remove-pokemon" data-type="basic" data-index="${i}">×</span>
        `;
        basicPokemonList.appendChild(tag);
    });

    evolutionWarning.classList.toggle('hidden', state.basicPokemon.length === 0);

    // 進化ポケモン
    evolutionPokemonList.innerHTML = '';
    state.evolutions.forEach((evo, i) => {
        const tag = document.createElement('div');
        tag.className = 'pokemon-tag evolution';
        tag.innerHTML = `
            <span>${evo.from} → ${evo.to}</span>
            <span class="remove-pokemon" data-type="evolution" data-index="${i}">×</span>
        `;
        evolutionPokemonList.appendChild(tag);
    });
}

function renderLog() {
    logEntries.innerHTML = '';
    // 新しいログを上に表示
    [...state.log].reverse().forEach(entry => {
        const div = document.createElement('div');
        div.className = `log-entry player-${entry.player.toLowerCase()}`;

        let bodyHtml = '';

        // アクション
        const actionLabels = {
            supporter: 'サポート',
            energy: 'エネルギー',
            retreat: 'にげる',
            stadium: 'スタジアム',
            attack: 'ワザ',
        };

        const usedActions = Object.entries(entry.actions)
            .filter(([, v]) => v.used)
            .map(([k, v]) => {
                const label = actionLabels[k];
                return v.detail ? `${label}（${v.detail}）` : label;
            });

        if (usedActions.length > 0) {
            bodyHtml += `<div class="log-action">🎯 ${usedActions.join('、')}</div>`;
        } else {
            bodyHtml += `<div class="log-action" style="color:#999">行動なし</div>`;
        }

        // たねポケモン
        if (entry.basicPokemon.length > 0) {
            bodyHtml += `<div class="log-pokemon">🟢 たね：${entry.basicPokemon.join('、')}</div>`;
        }

        // 進化
        if (entry.evolutions.length > 0) {
            const evoStrs = entry.evolutions.map(e => `${e.from}→${e.to}`);
            bodyHtml += `<div class="log-pokemon">🔮 進化：${evoStrs.join('、')}</div>`;
        }

        // メモ
        if (entry.notes) {
            bodyHtml += `<div class="log-notes">📝 ${entry.notes}</div>`;
        }

        const playerName = entry.player === 'A' ? state.playerA : state.playerB;
        div.innerHTML = `
            <div class="log-entry-header">${playerName} ${entry.turn}ターン目</div>
            <div class="log-entry-body">${bodyHtml}</div>
        `;
        logEntries.appendChild(div);
    });
}

// ===== イベント処理 =====

// アクションカードのクリック（トグル）
actionCards.forEach(card => {
    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('action-detail')) return;
        const action = card.dataset.action;
        if (card.classList.contains('disabled')) return;
        state.actions[action].used = !state.actions[action].used;
        updateActionCards();
    });

    card.querySelector('.action-detail').addEventListener('input', (e) => {
        const action = card.dataset.action;
        state.actions[action].detail = e.target.value;
    });
});

// たねポケモン追加
function addBasicPokemon() {
    const name = basicPokemonName.value.trim();
    if (!name) return;
    state.basicPokemon.push(name);
    basicPokemonName.value = '';
    updatePokemonList();
}

btnAddBasic.addEventListener('click', addBasicPokemon);
basicPokemonName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBasicPokemon();
});

// 進化追加
function addEvolution() {
    const from = evoFromName.value.trim();
    const to = evoToName.value.trim();
    if (!from || !to) return;
    state.evolutions.push({ from, to });
    evoFromName.value = '';
    evoToName.value = '';
    updatePokemonList();
}

btnAddEvolution.addEventListener('click', addEvolution);
evoToName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addEvolution();
});

// ポケモン削除
document.getElementById('pokemon-tracker').addEventListener('click', (e) => {
    if (!e.target.classList.contains('remove-pokemon')) return;
    const type = e.target.dataset.type;
    const index = parseInt(e.target.dataset.index);
    if (type === 'basic') {
        state.basicPokemon.splice(index, 1);
    } else {
        state.evolutions.splice(index, 1);
    }
    updatePokemonList();
});

// メモ同期
turnNotesArea.addEventListener('input', () => {
    state.notes = turnNotesArea.value;
});

// ターン終了
btnNextTurn.addEventListener('click', () => {
    const logEntry = {
        player: state.currentPlayer,
        turn: state.turnNumber,
        actions: JSON.parse(JSON.stringify(state.actions)),
        basicPokemon: [...state.basicPokemon],
        evolutions: [...state.evolutions],
        notes: state.notes,
    };
    state.log.push(logEntry);

    // 次のターンへ
    if (state.currentPlayer === 'A') {
        state.currentPlayer = 'B';
    } else {
        state.currentPlayer = 'A';
        state.turnNumber++;
    }

    initTurnActions();
    turnNotesArea.value = '';

    updateTurnDisplay();
    updateActionCards();
    updatePokemonList();
    renderLog();
});

// ターン戻す
btnUndoTurn.addEventListener('click', () => {
    if (state.log.length === 0) return;

    const lastEntry = state.log.pop();

    state.currentPlayer = lastEntry.player;
    state.turnNumber = lastEntry.turn;
    state.actions = lastEntry.actions;
    state.basicPokemon = lastEntry.basicPokemon;
    state.evolutions = lastEntry.evolutions;
    state.notes = lastEntry.notes;
    turnNotesArea.value = state.notes;

    updateTurnDisplay();
    updateActionCards();
    updatePokemonList();
    renderLog();
});

// リセット
btnReset.addEventListener('click', () => {
    if (!confirm('ゲームをリセットしますか？ログもすべて消えます。')) return;
    state.currentPlayer = 'A';
    state.turnNumber = 1;
    state.log = [];
    initTurnActions();
    turnNotesArea.value = '';

    updateTurnDisplay();
    updateActionCards();
    updatePokemonList();
    renderLog();
});

// ===== 初期化 =====
initTurnActions();
updateTurnDisplay();
updateActionCards();
updatePokemonList();
renderLog();
