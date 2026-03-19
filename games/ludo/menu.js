import { supabase } from '../../supabase.js';

// Menu handling for Ludo multiplayer
let selectedMode = 'single';
let selectedPlayerCount = 3;
let currentRoomId = null;

// DOM Elements
const multiplayerMenu = document.getElementById('multiplayer-menu');
const gameContainer = document.getElementById('game-container');
const waitingRoom = document.getElementById('waiting-room');
const singlePlayerSection = document.getElementById('single-player-section');
const multiplayerSection = document.getElementById('multiplayer-section');
const modeButtons = document.querySelectorAll('.mode-btn');
const playerCountButtons = document.querySelectorAll('.player-count-selector .btn');
const btnStartSingle = document.getElementById('btn-start-single');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnLeaveRoom = document.getElementById('btn-leave-room');
const btnCopyCode = document.getElementById('btn-copy-code');
const roomCodeInput = document.getElementById('room-code-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const playersList = document.getElementById('players-list');
const waitingHint = document.getElementById('waiting-hint');
const btnStartGameMulti = document.getElementById('btn-start-game-multi');

// Check URL params on load
document.addEventListener('DOMContentLoaded', () => {
  initMenu();
});

function initMenu() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');

  if (roomId) {
    // Joining via link - skip menu and show game
    hideMenu();
    showGame();
    return;
  }

  // Show menu by default
  showMenu();
  hideGame();
  hideWaitingRoom();

  // Event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Mode selection
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.dataset.mode;
      updateModeUI();
    });
  });

  // Player count selection
  playerCountButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      playerCountButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPlayerCount = parseInt(btn.dataset.count);
    });
  });

  // Start single player
  btnStartSingle?.addEventListener('click', () => {
    hideMenu();
    showGame();
    // Trigger game init
    if (typeof window.initGame === 'function') {
      window.initGame();
    }
  });

  // Create room
  btnCreateRoom?.addEventListener('click', createRoom);

  // Join room
  btnJoinRoom?.addEventListener('click', () => {
    const code = roomCodeInput.value.trim();
    if (code) {
      joinRoomByCode(code);
    } else {
      // Generate random code if none provided
      const randomCode = generateRoomCode();
      joinRoomByCode(randomCode);
    }
  });

  // Leave room
  btnLeaveRoom?.addEventListener('click', leaveRoom);

  // Copy room code
  btnCopyCode?.addEventListener('click', copyRoomCode);

  // Start game (host only)
  btnStartGameMulti?.addEventListener('click', startMultiplayerGame);
}

function updateModeUI() {
  if (selectedMode === 'single') {
    singlePlayerSection.classList.remove('hidden');
    multiplayerSection.classList.add('hidden');
  } else {
    singlePlayerSection.classList.add('hidden');
    multiplayerSection.classList.remove('hidden');
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function createRoom() {
  const roomCode = generateRoomCode();
  currentRoomId = roomCode;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || generateAnonymousId();
  const userName = user?.user_metadata?.name || localStorage.getItem('ludo_player_name') || 'Jogador 1';

  try {
    // Create room in database
    const { error } = await supabase
      .from('ludo_rooms')
      .insert({
        id: roomCode,
        host_id: userId,
        status: 'waiting',
        player_count: selectedPlayerCount,
        players: [{
          id: userId,
          name: userName,
          color_index: 0,
          joined_at: new Date().toISOString()
        }],
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    // Show waiting room
    hideMenu();
    showWaitingRoom();
    roomCodeDisplay.textContent = roomCode;

    // Update player slots
    updatePlayerSlots([{ color_index: 0, name: userName }]);

    // Show start button for host
    btnStartGameMulti.classList.remove('hidden');
    waitingHint.textContent = 'Aguardando jogadores entrarem... (1/' + selectedPlayerCount + ')';

    // Subscribe to room changes
    subscribeToRoom(roomCode);

  } catch (err) {
    console.error('Error creating room:', err);
    alert('Erro ao criar sala. Tente novamente.');
  }
}

async function joinRoomByCode(code) {
  currentRoomId = code.toUpperCase();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || generateAnonymousId();
  const userName = user?.user_metadata?.name || localStorage.getItem('ludo_player_name') || 'Jogador ' + Math.floor(Math.random() * 999);

  try {
    // Check if room exists
    const { data: room, error: fetchError } = await supabase
      .from('ludo_rooms')
      .select('*')
      .eq('id', currentRoomId)
      .single();

    if (fetchError) {
      alert('Sala não encontrada!');
      return;
    }

    if (room.status !== 'waiting') {
      alert('Este jogo já começou!');
      return;
    }

    if (room.players.length >= room.player_count) {
      alert('Sala cheia!');
      return;
    }

    // Find available color
    const usedColors = room.players.map(p => p.color_index);
    const availableColors = [0, 1, 2, 3].filter(c => !usedColors.includes(c));

    if (availableColors.length === 0) {
      alert('Sala cheia!');
      return;
    }

    const myColor = availableColors[0];

    // Add player to room
    const newPlayers = [...room.players, {
      id: userId,
      name: userName,
      color_index: myColor,
      joined_at: new Date().toISOString()
    }];

    const { error: updateError } = await supabase
      .from('ludo_rooms')
      .update({ players: newPlayers })
      .eq('id', currentRoomId);

    if (updateError) throw updateError;

    // Show waiting room
    hideMenu();
    showWaitingRoom();
    roomCodeDisplay.textContent = currentRoomId;

    // Update player slots
    updatePlayerSlots(newPlayers);

    // Hide start button for non-host
    btnStartGameMulti.classList.add('hidden');
    waitingHint.textContent = `Aguardando jogadores... (${newPlayers.length}/${room.player_count})`;

    // Subscribe to room changes
    subscribeToRoom(currentRoomId);

  } catch (err) {
    console.error('Error joining room:', err);
    alert('Erro ao entrar na sala. Tente novamente.');
  }
}

function subscribeToRoom(roomId) {
  const channel = supabase
    .channel(`ludo_room_${roomId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ludo_rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      handleRoomUpdate(payload.new);
    })
    .subscribe();
}

function handleRoomUpdate(room) {
  if (!room) return;

  // Update player slots
  updatePlayerSlots(room.players);

  // Update hint
  waitingHint.textContent = `Aguardando... (${room.players.length}/${room.player_count})`;

  // Check if game started
  if (room.status === 'playing') {
    hideWaitingRoom();
    showGame();
    // Update URL without reloading
    window.history.replaceState({}, '', `?room=${room.id}`);
  }
}

function updatePlayerSlots(players) {
  const slots = playersList.querySelectorAll('.player-slot');

  slots.forEach((slot, index) => {
    const player = players.find(p => p.color_index === index);
    const statusSpan = slot.querySelector('.slot-status');

    if (player) {
      slot.classList.remove('waiting');
      slot.classList.add('filled');
      statusSpan.textContent = player.name;
    } else {
      slot.classList.remove('filled');
      slot.classList.add('waiting');
      statusSpan.textContent = 'Aguardando...';
    }
  });

  // Update player count in hint
  const filledSlots = players.length;
  waitingHint.textContent = `Aguardando... (${filledSlots}/${selectedPlayerCount})`;
}

async function startMultiplayerGame() {
  if (!currentRoomId) return;

  try {
    const { error } = await supabase
      .from('ludo_rooms')
      .update({
        status: 'playing',
        started_at: new Date().toISOString()
      })
      .eq('id', currentRoomId);

    if (error) throw error;

    // Game will start via subscription
  } catch (err) {
    console.error('Error starting game:', err);
    alert('Erro ao iniciar o jogo.');
  }
}

async function leaveRoom() {
  if (!currentRoomId) return;

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || generateAnonymousId();

    // Get room data
    const { data: room } = await supabase
      .from('ludo_rooms')
      .select('*')
      .eq('id', currentRoomId)
      .single();

    if (room) {
      const newPlayers = room.players.filter(p => p.id !== userId);

      if (newPlayers.length === 0) {
        // Delete empty room
        await supabase.from('ludo_rooms').delete().eq('id', currentRoomId);
      } else {
        // Update room with remaining players
        await supabase
          .from('ludo_rooms')
          .update({ players: newPlayers })
          .eq('id', currentRoomId);
      }
    }
  } catch (err) {
    console.error('Error leaving room:', err);
  }

  // Reset and show menu
  currentRoomId = null;
  hideWaitingRoom();
  showMenu();
  hideGame();
}

function copyRoomCode() {
  const code = roomCodeDisplay.textContent;
  navigator.clipboard.writeText(code).then(() => {
    btnCopyCode.textContent = 'Copiado!';
    setTimeout(() => {
      btnCopyCode.textContent = 'Copiar';
    }, 2000);
  });
}

function generateAnonymousId() {
  return 'anon_' + Math.random().toString(36).substring(2, 15);
}

// UI Helpers
function showMenu() {
  multiplayerMenu.classList.remove('hidden');
}

function hideMenu() {
  multiplayerMenu.classList.add('hidden');
}

function showGame() {
  gameContainer.classList.remove('hidden');
}

function hideGame() {
  gameContainer.classList.add('hidden');
}

function showWaitingRoom() {
  waitingRoom.classList.remove('hidden');
}

function hideWaitingRoom() {
  waitingRoom.classList.add('hidden');
}
