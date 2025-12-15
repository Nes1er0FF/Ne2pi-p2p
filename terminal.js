// Ne2pi p2p - Консольный P2P мессенджер с комнатами и паролями
class Ne2piTerminal {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.roomName = null;
        this.roomPassword = null;
        this.isHost = false;
        this.isPrivate = false;
        this.pendingJoin = null; // {roomName, password}
        this.commandHistory = [];
        this.historyIndex = -1;
        this.roomsCache = new Map(); // Кэш найденных комнат
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.printWelcome();
        this.updateStatus('offline');
        this.updateFooter();
        
        document.getElementById('terminal-output').innerHTML = '';
    }
    
    bindEvents() {
        const input = document.getElementById('command-input');
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.processCommand(input.value.trim());
                input.value = '';
                this.historyIndex = -1;
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.commandHistory.length > 0) {
                    if (this.historyIndex < this.commandHistory.length - 1) {
                        this.historyIndex++;
                    }
                    input.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    input.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex] || '';
                } else {
                    this.historyIndex = -1;
                    input.value = '';
                }
            }
        });
        
        document.addEventListener('click', () => {
            input.focus();
        });
        
        setTimeout(() => input.focus(), 100);
    }
    
    processCommand(cmd) {
        if (!cmd) return;
        
        // Сохраняем в историю
        this.commandHistory.push(cmd);
        if (this.commandHistory.length > 50) {
            this.commandHistory.shift();
        }
        
        // Показываем команду
        this.printCommand(cmd);
        
        // Парсим команду
        const args = cmd.split(' ');
        const command = args[0].toLowerCase();
        
        switch (command) {
            case 'help':
                this.showHelp();
                break;
                
            case 'create':
                if (args[1]) {
                    this.createRoom(args[1]);
                } else {
                    this.printError('Укажите название комнаты: create [название]');
                }
                break;
                
            case 'password':
            case 'pass':
                if (args[1]) {
                    this.setPassword(args.slice(1).join(' '));
                } else {
                    this.printError('Укажите пароль: password [пароль]');
                }
                break;
                
            case 'join':
                if (args[1]) {
                    this.joinRoom(args[1]);
                } else {
                    this.printError('Укажите название комнаты: join [название]');
                }
                break;
                
            case 'clear':
                this.clearScreen();
                break;
                
            case 'ls':
            case 'list':
                this.listConnections();
                break;
                
            case 'msg':
                if (args[1]) {
                    const message = args.slice(1).join(' ');
                    this.sendMessage(message);
                } else {
                    this.printError('Укажите сообщение: msg [текст]');
                }
                break;
                
            case 'rooms':
                this.listRooms();
                break;
                
            case 'info':
                this.showRoomInfo();
                break;
                
            case 'status':
                this.showStatus();
                break;
                
            case 'disconnect':
            case 'exit':
                this.disconnect();
                break;
                
            case 'private':
                this.togglePrivate();
                break;
                
            default:
                this.printError(`Неизвестная команда: ${command}`);
                this.printOutput('Введите "help" для списка команд');
        }
    }
    
    showHelp() {
        const help = [
            '',
            '=== Ne2pi p2p Команды ===',
            'help                 - эта справка',
            'create [name]        - создать комнату с названием',
            'password [pass]      - установить пароль для комнаты (только хост)',
            'private              - переключить приватность (только хост)',
            'join [name]          - найти и присоединиться к комнате',
            'rooms                - список доступных комнат',
            'msg [текст]          - отправить сообщение',
            'ls / list            - список подключенных',
            'info                 - информация о комнате',
            'status               - статус соединения',
            'clear                - очистить экран',
            'disconnect / exit    - отключиться от комнаты',
            ''
        ];
        
        help.forEach(line => this.printOutput(line));
    }
    
    async createRoom(roomName) {
        if (this.peer) {
            this.printError('Уже подключен к комнате');
            return;
        }
        
        // Проверяем длину названия
        if (roomName.length < 3) {
            this.printError('Название комнаты должно быть от 3 символов');
            return;
        }
        
        if (roomName.length > 20) {
            this.printError('Название комнаты должно быть до 20 символов');
            return;
        }
        
        // Проверяем символы
        if (!/^[a-zA-Z0-9_-]+$/.test(roomName)) {
            this.printError('Только буквы, цифры, дефисы и подчеркивания');
            return;
        }
        
        this.printSystem(`Создание комнаты "${roomName}"...`);
        this.updateStatus('connecting');
        
        try {
            // Генерируем ID на основе названия комнаты
            const roomId = this.generateRoomId(roomName);
            
            this.peer = new Peer(roomId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            this.isHost = true;
            this.roomName = roomName;
            this.roomPassword = null;
            this.isPrivate = false;
            
            this.peer.on('open', (id) => {
                this.updateStatus('online');
                this.updateFooter();
                
                this.printSuccess(`Комната "${roomName}" создана!`);
                this.printOutput(`ID комнаты: ${id}`);
                this.printOutput('Ожидание подключений...');
                this.printOutput('Используйте "password [пароль]" чтобы установить пароль');
                
                // Сохраняем в localStorage для истории
                this.saveRoomToHistory(roomName, id, true);
                
                // Уведомление
                this.showNotification('Комната создана', `"${roomName}" готова к подключению`);
            });
            
            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });
            
            this.peer.on('error', (err) => {
                if (err.type === 'unavailable-id') {
                    this.printError(`Комната с именем "${roomName}" уже существует`);
                } else {
                    this.printError(`Ошибка: ${err.type}`);
                }
                this.updateStatus('offline');
                this.peer = null;
                this.roomName = null;
            });
            
        } catch (error) {
            this.printError(`Ошибка создания: ${error.message}`);
            this.updateStatus('offline');
        }
    }
    
    setPassword(password) {
        if (!this.isHost) {
            this.printError('Только создатель комнаты может устанавливать пароль');
            return;
        }
        
        if (!this.peer) {
            this.printError('Не подключен к комнате');
            return;
        }
        
        if (password.length < 4) {
            this.printError('Пароль должен быть от 4 символов');
            return;
        }
        
        this.roomPassword = password;
        this.isPrivate = true;
        
        this.printSuccess(`Пароль установлен: ${'*'.repeat(password.length)}`);
        this.printOutput('Комната теперь приватная');
        
        // Уведомляем всех участников
        this.broadcastSystemMessage('Комната теперь защищена паролем');
    }
    
    togglePrivate() {
        if (!this.isHost) {
            this.printError('Только создатель комнаты может менять приватность');
            return;
        }
        
        if (!this.peer) {
            this.printError('Не подключен к комнате');
            return;
        }
        
        this.isPrivate = !this.isPrivate;
        
        if (this.isPrivate && !this.roomPassword) {
            this.printError('Сначала установите пароль командой "password [пароль]"');
            this.isPrivate = false;
            return;
        }
        
        const status = this.isPrivate ? 'приватная' : 'публичная';
        this.printSuccess(`Комната теперь ${status}`);
        
        // Уведомляем всех
        this.broadcastSystemMessage(`Комната теперь ${status}`);
    }
    
    async joinRoom(roomName) {
        if (this.peer) {
            this.printError('Уже подключен к комнате');
            return;
        }
        
        roomName = roomName.toLowerCase();
        this.printSystem(`Поиск комнаты "${roomName}"...`);
        this.updateStatus('connecting');
        
        try {
            // Генерируем ID комнаты на основе названия
            const roomId = this.generateRoomId(roomName);
            
            // Сначала пробуем подключиться как обычный Peer
            this.peer = new Peer({
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            this.isHost = false;
            this.pendingJoin = { roomName, roomId };
            
            this.peer.on('open', async (myId) => {
                this.printSystem(`Мой ID: ${myId}`);
                this.updateFooter();
                
                // Пытаемся подключиться к комнате
                const conn = this.peer.connect(roomId, {
                    reliable: true,
                    serialization: 'json',
                    metadata: {
                        type: 'handshake',
                        clientId: myId,
                        timestamp: Date.now()
                    }
                });
                
                // Устанавливаем таймаут
                const timeout = setTimeout(() => {
                    this.printError('Таймаут подключения. Комната не отвечает');
                    this.disconnect();
                }, 10000);
                
                conn.on('open', () => {
                    clearTimeout(timeout);
                    this.handleConnection(conn);
                    this.roomName = roomName;
                    this.saveRoomToHistory(roomName, roomId, false);
                });
                
                conn.on('error', (err) => {
                    clearTimeout(timeout);
                    if (err.type === 'peer-unavailable') {
                        this.printError(`Комната "${roomName}" не найдена`);
                    } else {
                        this.printError(`Ошибка подключения: ${err.type}`);
                    }
                    this.disconnect();
                });
            });
            
            this.peer.on('error', (err) => {
                this.printError(`Ошибка: ${err.type}`);
                this.updateStatus('offline');
                this.peer = null;
                this.pendingJoin = null;
            });
            
        } catch (error) {
            this.printError(`Ошибка: ${error.message}`);
            this.updateStatus('offline');
        }
    }
    
    handleConnection(conn) {
        // Обработчик входящих подключений (для хоста)
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.updateStatus('online');
            
            this.printSuccess(`Подключен: ${conn.peer}`);
            
            // Если мы хост и комната приватная, запрашиваем пароль
            if (this.isHost && this.isPrivate) {
                conn.send({
                    type: 'auth_request',
                    message: 'Требуется пароль',
                    timestamp: Date.now()
                });
                
                this.printSystem(`Запрос пароля от ${conn.peer}...`);
            } else {
                // Приветственное сообщение
                conn.send({
                    type: 'welcome',
                    message: `Добро пожаловать в "${this.roomName}"!`,
                    roomName: this.roomName,
                    isPrivate: this.isPrivate,
                    timestamp: Date.now()
                });
                
                this.printSystem(`Новый участник в "${this.roomName}": ${conn.peer}`);
            }
        });
        
        conn.on('data', (data) => {
            this.handleIncomingData(data, conn);
        });
        
        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.printSystem(`Отключен: ${conn.peer}`);
            
            if (this.connections.size === 0 && !this.isHost) {
                this.printError('Потеряно соединение с комнатой');
                this.disconnect();
            }
        });
        
        conn.on('error', (err) => {
            this.printError(`Ошибка соединения: ${err.message}`);
        });
    }
    
    handleIncomingData(data, conn) {
        const time = new Date(data.timestamp).toLocaleTimeString();
        
        switch (data.type) {
            case 'message':
                this.printOutput(`[${time}] ${data.sender || conn.peer}: ${data.text}`);
                this.playSound('message');
                break;
                
            case 'welcome':
                this.printSuccess(`[${time}] ${data.message}`);
                this.roomName = data.roomName;
                this.isPrivate = data.isPrivate;
                this.updateFooter();
                break;
                
            case 'auth_request':
                this.printSystem(`[${time}] ${data.message}`);
                this.requestPassword(conn);
                break;
                
            case 'auth_response':
                if (this.isHost) {
                    this.handleAuthResponse(data, conn);
                }
                break;
                
            case 'auth_success':
                this.printSuccess(`[${time}] ${data.message}`);
                break;
                
            case 'auth_failed':
                this.printError(`[${time}] ${data.message}`);
                conn.close();
                break;
                
            case 'system':
                this.printSystem(`[${time}] ${data.message}`);
                break;
                
            default:
                this.printSystem(`[ДАННЫЕ] ${JSON.stringify(data)}`);
        }
    }
    
    requestPassword(conn) {
        const password = prompt(`Введите пароль для комнаты "${this.roomName}":`);
        
        if (password) {
            conn.send({
                type: 'auth_response',
                password: password,
                timestamp: Date.now()
            });
        } else {
            this.printError('Подключение отменено: не введен пароль');
            conn.close();
        }
    }
    
    handleAuthResponse(data, conn) {
        if (data.password === this.roomPassword) {
            // Пароль верный
            conn.send({
                type: 'auth_success',
                message: 'Пароль принят! Добро пожаловать!',
                roomName: this.roomName,
                timestamp: Date.now()
            });
            
            this.printSuccess(`Участник ${conn.peer} успешно авторизован`);
            this.connections.set(conn.peer, conn);
            
        } else {
            // Неверный пароль
            conn.send({
                type: 'auth_failed',
                message: 'Неверный пароль',
                timestamp: Date.now()
            });
            
            this.printError(`Неверный пароль от ${conn.peer}`);
            setTimeout(() => conn.close(), 1000);
        }
    }
    
    sendMessage(text) {
        if (!this.peer) {
            this.printError('Не подключен к комнате');
            return;
        }
        
        if (this.connections.size === 0 && !this.isHost) {
            this.printError('Нет подключенных участников');
            return;
        }
        
        const message = {
            type: 'message',
            text: text,
            timestamp: Date.now(),
            sender: 'terminal'
        };
        
        // Отправляем всем
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(message);
            }
        });
        
        // Показываем локально
        const time = new Date().toLocaleTimeString();
        this.printOutput(`[${time}] Я: ${text}`);
        this.playSound('send');
    }
    
    broadcastSystemMessage(text) {
        const message = {
            type: 'system',
            message: text,
            timestamp: Date.now()
        };
        
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(message);
            }
        });
        
        this.printSystem(text);
    }
    
    listRooms() {
        // В будущем можно добавить discovery сервер
        // Пока просто показываем историю
        const history = JSON.parse(localStorage.getItem('ne2pi_rooms_history') || '[]');
        
        if (history.length === 0) {
            this.printOutput('История комнат пуста');
            return;
        }
        
        this.printOutput('=== История комнат ===');
        history.forEach((room, index) => {
            const type = room.isHost ? '[ХОСТ]' : '[УЧАСТНИК]';
            const date = new Date(room.lastJoin).toLocaleDateString();
            this.printOutput(`${index + 1}. ${room.name} ${type} ${date}`);
        });
    }
    
    listConnections() {
        if (this.connections.size === 0) {
            this.printOutput('Нет активных подключений');
        } else {
            this.printOutput(`Активных подключений: ${this.connections.size}`);
            this.connections.forEach((conn, peerId) => {
                this.printOutput(`  ↳ ${peerId}`);
            });
        }
    }
    
    showRoomInfo() {
        if (!this.roomName) {
            this.printError('Не подключен к комнате');
            return;
        }
        
        this.printOutput(`=== Информация о комнате ===`);
        this.printOutput(`Название: ${this.roomName}`);
        this.printOutput(`Статус: ${this.isPrivate ? '🔒 Приватная' : '🔓 Публичная'}`);
        this.printOutput(`Режим: ${this.isHost ? 'Хост' : 'Участник'}`);
        this.printOutput(`Участников: ${this.connections.size + 1}`);
        this.printOutput(`ID: ${this.peer.id}`);
    }
    
    showStatus() {
        const status = document.getElementById('connection-status').textContent;
        this.printOutput(`Статус: ${status}`);
        this.printOutput(`Комната: ${this.roomName || '--'}`);
        this.printOutput(`Участников: ${this.connections.size + 1}`);
        this.printOutput(`Режим: ${this.isHost ? 'Хост' : 'Клиент'}`);
        this.printOutput(`Приватность: ${this.isPrivate ? 'Да' : 'Нет'}`);
    }
    
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.connections.clear();
        this.roomName = null;
        this.roomPassword = null;
        this.isPrivate = false;
        this.pendingJoin = null;
        
        this.updateStatus('offline');
        this.updateFooter();
        
        this.printSuccess('Отключен от комнаты');
    }
    
    clearScreen() {
        document.getElementById('terminal-output').innerHTML = '';
    }
    
    generateRoomId(roomName) {
        // Создаем уникальный ID на основе названия комнаты
        const salt = Math.random().toString(36).substring(2, 8);
        return `ne2pi-${roomName.toLowerCase()}-${salt}`;
    }
    
    saveRoomToHistory(roomName, roomId, isHost) {
        const history = JSON.parse(localStorage.getItem('ne2pi_rooms_history') || '[]');
        
        // Удаляем старую запись этой комнаты
        const filtered = history.filter(room => room.id !== roomId);
        
        // Добавляем новую запись
        filtered.unshift({
            name: roomName,
            id: roomId,
            isHost: isHost,
            lastJoin: Date.now()
        });
        
        // Ограничиваем историю 20 записями
        localStorage.setItem('ne2pi_rooms_history', JSON.stringify(filtered.slice(0, 20)));
    }
    
    updateStatus(status) {
        const elem = document.getElementById('connection-status');
        elem.className = `status-${status}`;
        elem.textContent = status.toUpperCase();
    }
    
    updateFooter() {
        document.getElementById('peer-id').textContent = 
            `peer-id: ${this.peer ? this.peer.id?.substring(0, 8) || '--' : '--'}`;
        
        document.getElementById('room-info').textContent = 
            `комната: ${this.roomName || '--'}`;
    }
    
    scrollToBottom() {
        const output = document.getElementById('terminal-output');
        output.scrollTop = output.scrollHeight;
    }
    
    playSound(type) {
        // Простая звуковая система
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            
            let freq = 800;
            let duration = 0.05;
            
            switch (type) {
                case 'message':
                    freq = 600;
                    duration = 0.1;
                    break;
                case 'send':
                    freq = 1000;
                    duration = 0.08;
                    break;
                case 'success':
                    freq = 1200;
                    duration = 0.2;
                    break;
                case 'error':
                    freq = 400;
                    duration = 0.3;
                    break;
            }
            
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            gain.gain.value = 0.05;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + duration);
        } catch (e) {
            // Игнорируем ошибки аудио
        }
    }
    
    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: 'https://via.placeholder.com/192/00ff00/000000?text=NE2PI'
            });
        }
    }
    
    printCommand(cmd) {
        const welcome = document.getElementById('welcome-screen');
        if (welcome.style.display !== 'none') {
            welcome.style.display = 'none';
        }
        
        const output = document.getElementById('terminal-output');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `
            <span class="line-prompt">$</span>
            <span class="line-command">${this.escapeHtml(cmd)}</span>
        `;
        output.appendChild(line);
        this.scrollToBottom();
        
        this.playSound('type');
    }
    
    printOutput(text, type = 'output') {
        const output = document.getElementById('terminal-output');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `<span class="line-${type}">${this.escapeHtml(text)}</span>`;
        output.appendChild(line);
        this.scrollToBottom();
    }
    
    printError(text) {
        this.printOutput(`Ошибка: ${text}`, 'error');
        this.playSound('error');
    }
    
    printSuccess(text) {
        this.printOutput(text, 'success');
        this.playSound('success');
    }
    
    printSystem(text) {
        this.printOutput(text, 'system');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Запускаем терминал
let terminal;

window.addEventListener('DOMContentLoaded', () => {
    terminal = new Ne2piTerminal();
    console.log('🚀 Ne2pi p2p запущен!');
    
    // Регистрируем Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('✅ Service Worker зарегистрирован'))
            .catch(err => console.log('❌ Service Worker ошибка:', err));
    }
    
    // Запрашиваем разрешение на уведомления
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            Notification.requestPermission();
        }, 2000);
    }
    
    // PWA установка
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setTimeout(() => {
            if (confirm('Установить Ne2pi p2p как приложение для быстрого доступа?')) {
                e.prompt();
            }
        }, 5000);
    });
});

window.Ne2piTerminal = Ne2piTerminal;
