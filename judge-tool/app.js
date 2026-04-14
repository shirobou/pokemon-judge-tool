// ===== 状態管理 =====
const state = {
    playerA: '先攻',
    playerB: '後攻',
    currentPlayer: 'A',
    turnNumber: 1,
    actions: {},
    // 盤面
    active: '',       // バトル場
    bench: [],        // ベンチ（5 or 8枠）
    benchExpanded: false,
    notes: '',
    log: [],
    // 編集モード
    currentTurnBackup: null,
    editingLogIndex: -1,
};

const BENCH_NORMAL = 5;
const BENCH_EXPANDED = 8;

function getBenchSize() {
    return state.benchExpanded ? BENCH_EXPANDED : BENCH_NORMAL;
}

function initTurnActions() {
    state.actions = {
        supporter: { used: false, detail: '' },
        energy: { used: false, detail: '' },
        retreat: { used: false, detail: '' },
        stadium: { used: false, detail: '' },
        attack: { used: false, detail: '' },
    };
    state.notes = '';
}

// 盤面を初期化（前ターンから引き継ぎ or 空）
function initField(prevField) {
    if (prevField) {
        state.active = prevField.active;
        state.bench = [...prevField.bench];
        state.benchExpanded = prevField.benchExpanded;
    } else {
        state.active = '';
        state.bench = Array(BENCH_NORMAL).fill('');
        state.benchExpanded = false;
    }
    // サイズ合わせ
    adjustBenchSize();
}

function adjustBenchSize() {
    const size = getBenchSize();
    while (state.bench.length < size) state.bench.push('');
    while (state.bench.length > size) state.bench.pop();
}

function getFieldSnapshot() {
    return {
        active: state.active,
        bench: [...state.bench],
        benchExpanded: state.benchExpanded,
    };
}

// 前のターンの盤面を取得（同じプレイヤーの直近）
function getPrevFieldForCurrentPlayer() {
    // ログを逆順に探して、同じプレイヤーの最新を見つける
    for (let i = state.log.length - 1; i >= 0; i--) {
        if (state.log[i].player === state.currentPlayer) {
            return state.log[i].field;
        }
    }
    return null;
}

// 前のターンと比較して変更があった入力欄にクラスを付与
function markChangedFields() {
    const player = isEditing()
        ? state.log[state.editingLogIndex].player
        : state.currentPlayer;
    const editingTurn = isEditing()
        ? state.log[state.editingLogIndex].turn
        : state.turnNumber;

    // このプレイヤーの、このターンより前の最新ログを探す
    let prevField = null;
    for (let i = state.log.length - 1; i >= 0; i--) {
        const entry = state.log[i];
        if (entry.player === player) {
            if (isEditing() && i === state.editingLogIndex) continue;
            if (entry.turn < editingTurn || (entry.turn === editingTurn && i < state.editingLogIndex)) {
                prevField = entry.field;
                break;
            }
        }
    }

    const activeInput = document.getElementById('active-pokemon');
    if (prevField) {
        activeInput.classList.toggle('changed', state.active !== prevField.active);
        const benchInputs = document.querySelectorAll('.bench-input');
        benchInputs.forEach((input, i) => {
            const prev = prevField.bench[i] || '';
            input.classList.toggle('changed', input.value !== prev);
        });
    } else {
        // 前のターンがない（1ターン目）→ 入力があれば全部changed
        activeInput.classList.toggle('changed', state.active !== '');
        const benchInputs = document.querySelectorAll('.bench-input');
        benchInputs.forEach(input => {
            input.classList.toggle('changed', input.value !== '');
        });
    }
}

// ===== スワップ状態 =====
let swapSource = null; // null or { type: 'active' } or { type: 'bench', index: N }

function clearSwapState() {
    swapSource = null;
    document.querySelectorAll('.field-slot').forEach(el => {
        el.classList.remove('swap-selected', 'swap-target');
    });
    document.getElementById('swap-hint').classList.add('hidden');
}

function startSwap(source) {
    swapSource = source;
    document.getElementById('swap-hint').classList.remove('hidden');
    // ハイライト
    document.querySelectorAll('.field-slot').forEach(el => {
        el.classList.remove('swap-selected', 'swap-target');
    });
    const sourceEl = getSlotElement(source);
    if (sourceEl) sourceEl.classList.add('swap-selected');
    // 他のスロットにtargetクラス
    document.querySelectorAll('.field-slot').forEach(el => {
        if (el !== sourceEl) el.classList.add('swap-target');
    });
}

function executeSwap(target) {
    syncFieldFromInputs();
    const srcVal = getSlotValue(swapSource);
    const tgtVal = getSlotValue(target);
    setSlotValue(swapSource, tgtVal);
    setSlotValue(target, srcVal);
    clearSwapState();
    updateFieldInputs();
    markChangedFields();
}

function getSlotValue(slot) {
    if (slot.type === 'active') return state.active;
    return state.bench[slot.index] || '';
}

function setSlotValue(slot, val) {
    if (slot.type === 'active') state.active = val;
    else state.bench[slot.index] = val;
}

function getSlotElement(slot) {
    if (slot.type === 'active') return document.querySelector('[data-slot="active"]');
    return document.querySelector(`[data-slot="bench-${slot.index}"]`);
}

function slotsEqual(a, b) {
    return a && b && a.type === b.type && (a.type === 'active' || a.index === b.index);
}

// ===== DOM要素 =====
const turnLabel = document.getElementById('current-turn-label');
const btnNextTurn = document.getElementById('btn-next-turn');
const btnUndoTurn = document.getElementById('btn-undo-turn');
const btnReset = document.getElementById('btn-reset');
const firstTurnNotice = document.getElementById('first-turn-notice');
const activeInput = document.getElementById('active-pokemon');
const benchArea = document.getElementById('bench-area');
const benchExpandCheck = document.getElementById('bench-expand');
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
    state.currentTurnBackup = {
        actions: JSON.parse(JSON.stringify(state.actions)),
        field: getFieldSnapshot(),
        notes: state.notes,
    };

    state.editingLogIndex = logIndex;
    const entry = state.log[logIndex];

    state.actions = JSON.parse(JSON.stringify(entry.actions));
    state.active = entry.field.active;
    state.bench = [...entry.field.bench];
    state.benchExpanded = entry.field.benchExpanded;
    adjustBenchSize();
    state.notes = entry.notes;
    turnNotesArea.value = state.notes;

    updateAll();
}

function saveEdit() {
    syncFieldFromInputs();
    const idx = state.editingLogIndex;
    state.log[idx].actions = JSON.parse(JSON.stringify(state.actions));
    state.log[idx].field = getFieldSnapshot();
    state.log[idx].notes = state.notes;
    exitEditMode();
}

function exitEditMode() {
    const backup = state.currentTurnBackup;
    state.actions = backup.actions;
    state.active = backup.field.active;
    state.bench = [...backup.field.bench];
    state.benchExpanded = backup.field.benchExpanded;
    adjustBenchSize();
    state.notes = backup.notes;
    turnNotesArea.value = state.notes;
    state.currentTurnBackup = null;
    state.editingLogIndex = -1;
    updateAll();
}

// ===== 盤面の入力値を同期 =====
function syncFieldFromInputs() {
    state.active = activeInput.value.trim();
    const benchInputs = document.querySelectorAll('.bench-input');
    benchInputs.forEach((input, i) => {
        state.bench[i] = input.value.trim();
    });
}

// ===== 表示更新 =====
function updateAll() {
    updateTurnDisplay();
    updateActionCards();
    renderBench();
    updateFieldInputs();
    renderLog();
    markChangedFields();
}

function updateTurnDisplay() {
    if (isEditing()) {
        const entry = state.log[state.editingLogIndex];
        const playerName = entry.player === 'A' ? state.playerA : state.playerB;
        turnLabel.textContent = `${playerName} ${entry.turn}ターン目（編集中）`;
        turnLabel.className = entry.player === 'A' ? 'player-a' : 'player-b';
        editingBanner.classList.remove('hidden');
        editingLabel.textContent = `${playerName} ${entry.turn}ターン目を編集中`;
        btnNextTurn.classList.add('hidden');
        btnUndoTurn.classList.add('hidden');

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

function renderBench() {
    const size = getBenchSize();
    benchArea.innerHTML = '';
    for (let i = 0; i < size; i++) {
        const slot = document.createElement('div');
        slot.className = 'bench-slot';
        slot.innerHTML = `
            <div class="bench-label">ベンチ${i + 1}</div>
            <div class="field-slot" data-slot="bench-${i}">
                <input type="text" class="field-input bench-input" data-index="${i}" placeholder="ポケモン名" value="">
                <button class="slot-btn slot-swap" title="入れ替え">↔</button>
                <button class="slot-btn slot-clear" title="クリア">×</button>
            </div>
        `;
        benchArea.appendChild(slot);
    }
    benchExpandCheck.checked = state.benchExpanded;

    // ベンチ入力のイベント
    document.querySelectorAll('.bench-input').forEach(input => {
        input.addEventListener('input', () => {
            const idx = parseInt(input.dataset.index);
            state.bench[idx] = input.value.trim();
            markChangedFields();
        });
    });
}

function updateFieldInputs() {
    activeInput.value = state.active;
    const benchInputs = document.querySelectorAll('.bench-input');
    benchInputs.forEach((input, i) => {
        input.value = state.bench[i] || '';
    });
}

function renderLog() {
    logEntries.innerHTML = '';
    [...state.log].reverse().forEach((entry, reverseIdx) => {
        const realIdx = state.log.length - 1 - reverseIdx;
        const div = document.createElement('div');
        div.className = `log-entry player-${entry.player.toLowerCase()}`;
        if (state.editingLogIndex === realIdx) div.classList.add('editing');
        div.dataset.logIndex = realIdx;

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
        }

        // 盤面
        if (entry.field.active) {
            bodyHtml += `<div class="log-field">⚔️ ${entry.field.active}`;
            const benchNames = entry.field.bench.filter(b => b);
            if (benchNames.length > 0) {
                bodyHtml += ` ｜ ${benchNames.join('・')}`;
            }
            bodyHtml += `</div>`;
        }

        if (entry.notes) {
            bodyHtml += `<div class="log-notes">📝 ${entry.notes}</div>`;
        }

        if (!bodyHtml) {
            bodyHtml = `<div style="color:#999">記録なし</div>`;
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

// アクションカード
actionCards.forEach(card => {
    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('action-detail')) return;
        const action = card.dataset.action;
        if (card.classList.contains('disabled')) return;
        state.actions[action].used = !state.actions[action].used;
        updateActionCards();
    });
    card.querySelector('.action-detail').addEventListener('input', (e) => {
        state.actions[card.dataset.action].detail = e.target.value;
    });
});

// バトル場入力
activeInput.addEventListener('input', () => {
    state.active = activeInput.value.trim();
    markChangedFields();
});

// スワップ・クリアのイベント委譲（フィールド全体）
function handleSlotButton(e) {
    const btn = e.target.closest('.slot-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const slotEl = btn.closest('.field-slot');
    const slotId = slotEl.dataset.slot;
    const slot = slotId === 'active'
        ? { type: 'active' }
        : { type: 'bench', index: parseInt(slotId.replace('bench-', '')) };

    if (btn.classList.contains('slot-clear')) {
        syncFieldFromInputs();
        setSlotValue(slot, '');
        updateFieldInputs();
        markChangedFields();
        return;
    }

    if (btn.classList.contains('slot-swap')) {
        if (swapSource && slotsEqual(swapSource, slot)) {
            clearSwapState();
        } else if (swapSource) {
            executeSwap(slot);
        } else {
            startSwap(slot);
        }
    }
}
document.getElementById('field-section').addEventListener('click', handleSlotButton);

// ベンチ拡張
benchExpandCheck.addEventListener('change', () => {
    state.benchExpanded = benchExpandCheck.checked;
    adjustBenchSize();
    renderBench();
    updateFieldInputs();
    markChangedFields();
});

// ログクリック→編集
logEntries.addEventListener('click', (e) => {
    const entry = e.target.closest('.log-entry');
    if (!entry) return;
    const logIndex = parseInt(entry.dataset.logIndex);
    if (isEditing() && state.editingLogIndex === logIndex) return;
    if (isEditing()) {
        if (!confirm('現在の編集を破棄して別のターンを編集しますか？')) return;
        exitEditMode();
    }
    enterEditMode(logIndex);
    document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' });
});

btnSaveEdit.addEventListener('click', saveEdit);
btnCancelEdit.addEventListener('click', () => exitEditMode());

// メモ
turnNotesArea.addEventListener('input', () => {
    state.notes = turnNotesArea.value;
});

// ターン終了
btnNextTurn.addEventListener('click', () => {
    syncFieldFromInputs();

    const logEntry = {
        player: state.currentPlayer,
        turn: state.turnNumber,
        actions: JSON.parse(JSON.stringify(state.actions)),
        field: getFieldSnapshot(),
        notes: state.notes,
    };
    state.log.push(logEntry);

    // 次のプレイヤーへ
    const prevPlayer = state.currentPlayer;
    if (state.currentPlayer === 'A') {
        state.currentPlayer = 'B';
    } else {
        state.currentPlayer = 'A';
        state.turnNumber++;
    }

    // 行動リセット
    initTurnActions();
    turnNotesArea.value = '';

    // 盤面は同じプレイヤーの前ターンから引き継ぎ
    const prevField = getPrevFieldForCurrentPlayer();
    initField(prevField);

    updateAll();
});

// ターン戻す
btnUndoTurn.addEventListener('click', () => {
    if (state.log.length === 0) return;
    const lastEntry = state.log.pop();
    state.currentPlayer = lastEntry.player;
    state.turnNumber = lastEntry.turn;
    state.actions = lastEntry.actions;
    state.active = lastEntry.field.active;
    state.bench = [...lastEntry.field.bench];
    state.benchExpanded = lastEntry.field.benchExpanded;
    adjustBenchSize();
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
    initField(null);
    turnNotesArea.value = '';
    updateAll();
});

// ===== 初期化 =====
initTurnActions();
initField(null);
updateAll();
