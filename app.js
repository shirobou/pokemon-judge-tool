// ===== 状態管理 =====
const state = {
    playerA: '先攻',
    playerB: '後攻',
    currentPlayer: 'A',
    turnNumber: 1,
    actions: {},
    basicPokemon: [],
    evolutions: [],
    notes: '',
    log: [],
    // 現在のターン（未保存）のバックアップ（過去ターン編集時に退避）
    currentTurnBackup: null,
    // -1 = 現在のターンを編集中、0以上 = そのログインデックスを編集中
    editingLogIndex: -1,
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
const editingBanner = document.getElementById('editing-banner');
const editingLabel = document.getElementById('editing-label');
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

// ===== 編集モード =====
function isEditing() {
    return state.editingLogIndex >= 0;
}

function enterEditMode(logIndex) {
    // 現在のターンの状態を退避
    state.currentTurnBackup = {
        actions: JSON.parse(JSON.stringify(state.actions)),
        basicPokemon: [...state.basicPokemon],
        evolutions: state.evolutions.map(e => ({...e})),
        notes: state.notes,
    };

    state.editingLogIndex = logIndex;
    const entry = state.log[logIndex];

    // ログの内容を編集エリアに読み込み
    state.actions = JSON.parse(JSON.stringify(entry.actions));
    state.basicPokemon = [...entry.basicPokemon];
    state.evolutions = entry.evolutions.map(e => ({...e}));
    state.notes = entry.notes;
    turnNotesArea.value = state.notes;

    updateAll();
}

function saveEdit() {
    const idx = state.editingLogIndex;
    // ログを上書き
    state.log[idx].actions = JSON.parse(JSON.stringify(state.actions));
    state.log[idx].basicPokemon = [...state.basicPokemon];
    state.log[idx].evolutions = state.evolutions.map(e => ({...e}));
    state.log[idx].notes = state.notes;

    exitEditMode();
}

function exitEditMode() {
    // 退避した現在ターンの状態を復元
    const backup = state.currentTurnBackup;
    state.actions = backup.actions;
    state.basicPokemon = backup.basicPokemon;
    state.evolutions = backup.evolutions;
    state.notes = backup.notes;
    turnNotesArea.value = state.notes;
    state.currentTurnBackup = null;
    state.editingLogIndex = -1;

    updateAll();
}

// ===== 表示更新 =====
function updateAll() {
    updateTurnDisplay();
    updateActionCards();
    updatePokemonList();
    renderLog();
}

function updateTurnDisplay() {
    if (isEditing()) {
        const entry = state.log[state.editingLogIndex];
        const playerName = entry.player === 'A' ? state.playerA : state.playerB;
        turnLabel.textContent = `${playerName} ${entry.turn}ターン目（編集中）`;
        turnLabel.className = entry.player === 'A' ? 'player-a' : 'player-b';

        // 編集バナー表示
        editingBanner.classList.remove('hidden');
        editingLabel.textContent = `${playerName} ${entry.turn}ターン目を編集中`;

        // 通常ボタン非表示
        btnNextTurn.classList.add('hidden');
        btnUndoTurn.classList.add('hidden');

        // 先攻1ターン目制限
        const isFirstTurn = entry.player === 'A' && entry.turn === 1;
        firstTurnNotice.classList.toggle('hidden', !isFirstTurn);
        document.querySelector('[data-action="supporter"]').classList.toggle('disabled', isFirstTurn);
        document.querySelector('[data-action="attack"]').classList.toggle('disabled', isFirstTurn);
    } else {
        const playerName = state.currentPlayer === 'A' ? state.playerA : state.playerB;
        turnLabel.textContent = `${playerName} ${state.turnNumber}ターン目`;
        turnLabel.className = state.currentPlayer === 'A' ? 'player-a' : 'player-b';

        editingBanner.classList.add('hidden');
        btnNextTurn.classList.remove('hidden');
        btnUndoTurn.classList.remove('hidden');

        const isFirstTurn = state.currentPlayer === 'A' && state.turnNumber === 1;
        firstTurnNotice.classList.toggle('hidden', !isFirstTurn);
        document.querySelector('[data-action="supporter"]').classList.toggle('disabled', isFirstTurn);
        document.querySelector('[data-action="attack"]').classList.toggle('disabled', isFirstTurn);

        btnUndoTurn.disabled = state.log.length === 0;
    }
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
    [...state.log].reverse().forEach((entry, reverseIdx) => {
        const realIdx = state.log.length - 1 - reverseIdx;
        const div = document.createElement('div');
        div.className = `log-entry player-${entry.player.toLowerCase()}`;
        if (state.editingLogIndex === realIdx) {
            div.classList.add('editing');
        }
        div.dataset.logIndex = realIdx;

        let bodyHtml = '';

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

        if (entry.basicPokemon.length > 0) {
            bodyHtml += `<div class="log-pokemon">🟢 たね：${entry.basicPokemon.join('、')}</div>`;
        }

        if (entry.evolutions.length > 0) {
            const evoStrs = entry.evolutions.map(e => `${e.from}→${e.to}`);
            bodyHtml += `<div class="log-pokemon">🔮 進化：${evoStrs.join('、')}</div>`;
        }

        if (entry.notes) {
            bodyHtml += `<div class="log-notes">📝 ${entry.notes}</div>`;
        }

        const playerName = entry.player === 'A' ? state.playerA : state.playerB;
        div.innerHTML = `
            <div class="log-entry-header">${playerName} ${entry.turn}ターン目 <span class="log-edit-hint">タップで編集</span></div>
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

// ログエントリをクリックして編集
logEntries.addEventListener('click', (e) => {
    const entry = e.target.closest('.log-entry');
    if (!entry) return;
    const logIndex = parseInt(entry.dataset.logIndex);
    if (isEditing() && state.editingLogIndex === logIndex) return; // 既に編集中
    if (isEditing()) {
        // 別のターンに切り替える前に確認
        if (!confirm('現在の編集を破棄して別のターンを編集しますか？')) return;
        exitEditMode();
    }
    enterEditMode(logIndex);
    // メインエリアにスクロール
    document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' });
});

// 編集保存
btnSaveEdit.addEventListener('click', saveEdit);

// 編集キャンセル
btnCancelEdit.addEventListener('click', () => {
    exitEditMode();
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
        evolutions: state.evolutions.map(e => ({...e})),
        notes: state.notes,
    };
    state.log.push(logEntry);

    if (state.currentPlayer === 'A') {
        state.currentPlayer = 'B';
    } else {
        state.currentPlayer = 'A';
        state.turnNumber++;
    }

    initTurnActions();
    turnNotesArea.value = '';
    updateAll();
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
    updateAll();
});

// リセット
btnReset.addEventListener('click', () => {
    if (!confirm('ゲームをリセットしますか？ログもすべて消えます。')) return;
    state.currentPlayer = 'A';
    state.turnNumber = 1;
    state.log = [];
    state.editingLogIndex = -1;
    state.currentTurnBackup = null;
    initTurnActions();
    turnNotesArea.value = '';
    updateAll();
});

// ===== 初期化 =====
initTurnActions();
updateAll();
