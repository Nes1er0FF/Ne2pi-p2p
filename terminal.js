// Ne2pi p2p - Консольный P2P мессенджер
class Ne2piTerminal {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.roomCode = null;
        this.isHost = false;
        this.commandHistory = [];
        this.historyIndex = -1;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.printWelcome();
        this.updateStatus('offline');
        this.updateFooter();
        
        // Начинаем с пустого вывода
        document.getElementById('terminal-output').innerHTML = '';
    }
    
    bindEvents() {
        const input = document.getElementById('command-input');
        
        // Обработка команд
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.processCommand(input.value.trim());
                input.value = '';
                this.historyIndex = -1;
            }
        });
        
        // История команд (стрелки вверх/вниз)
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
        
        // Фокус на поле ввода
        document.addEventListener('click', () => {
            input.focus();
        });
        
        // Автофокус при загрузке
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
                this.createRoom();
                break;
                
            case 'join':
                if (args[1]) {
                    this.joinRoom(args[1]);
                } else {
                    this.printError('Укажите код комнаты: join [code]');
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
                
            case 'code':
                this.showRoomCode();
                break;
                
            case 'status':
                this.showStatus();
                break;
                
            case 'disconnect':
            case 'exit':
                this.disconnect();
                break;
                
            default:
                this.printError(`Неизвестная команда: ${command}`);
                this.printOutput('Введите "help" для списка команд');
        }
    }
    
    printWelcome() {
        // Приветствие уже в HTML, просто скрываем при первом команде
    }
    
    printCommand(cmd) {
        // Скрываем приветственный экран при первой команде
        const welcome = document.getElementById('welcome-screen');
        if (welcome.style.display !== 'none') {
            welcome.style.display = 'none';
        }
        
        // Выводим команду
        const output = document.getElementById('terminal-output');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `
            <span class="line-prompt">$</span>
            <span class="line-command">${this.escapeHtml(cmd)}</span>
        `;
        output.appendChild(line);
        this.scrollToBottom();
        
        // Звук печати
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
    
    showHelp() {
        const help = [
            '',
            '=== Ne2pi p2p Команды ===',
            'help                 - эта справка',
            'create               - создать новую комнату P2P',
            'join [code]          - присоединиться к комнате',
            'code                 - показать код текущей комнаты',
            'msg [текст]          - отправить сообщение',
            'ls / list            - список подключенных',
            'status               - статус соединения',
            'clear                - очистить экран',
            'disconnect / exit    - отключиться от комнаты',
            ''
        ];
        
        help.forEach(line => this.printOutput(line));
    }
    
    async createRoom() {
        if (this.peer) {
            this.printError('Уже подключен к комнате');
            return;
        }
        
        this.printSystem('Создание P2P комнаты...');
        this.updateStatus('connecting');
        
        try {
            // Создаем Peer с рандомным ID
            this.peer = new Peer({
                debug: 2
            });
            
            this.isHost = true;
            
            this.peer.on('open', (id) => {
                this.roomCode = id;
                this.updateStatus('online');
                this.updateFooter();
                
                this.printSuccess(`Комната создана!`);
                this.printOutput(`Код: ${id}`);
                this.printOutput('Поделитесь этим кодом с друзьями');
                this.printOutput('Ожидание подключений...');
                
                // Системное уведомление
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Ne2pi p2p', {
                        body: 'Комната создана! Код: ' + id,
                        icon: '/icon-192.png'
                    });
                }
            });
            
            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });
            
            this.peer.on('error', (err) => {
                this.printError(`Peer ошибка: ${err.type}`);
                this.updateStatus('offline');
                this.peer = null;
            });
            
        } catch (error) {
            this.printError(`Ошибка создания: ${error.message}`);
            this.updateStatus('offline');
        }
    }
    
    async joinRoom(code) {
        if (this.peer) {
            this.printError('Уже подключен к комнате');
            return;
        }
        
        code = code.toUpperCase();
        this.printSystem(`Подключение к комнате: ${code}...`);
        this.updateStatus('connecting');
        
        try {
            // Создаем свой Peer
            this.peer = new Peer({
                debug: 2
            });
            
            this.isHost = false;
            this.roomCode = code;
            
            this.peer.on('open', async (id) => {
                this.printSystem(`Мой ID: ${id}`);
                this.updateFooter();
                
                // Подключаемся к хосту
                const conn = this.peer.connect(code, {
                    reliable: true,
                    serialization: 'json'
                });
                
                this.handleConnection(conn);
            });
            
            this.peer.on('error', (err) => {
                if (err.type === 'peer-unavailable') {
                    this.printError('Комната не найдена или закрыта');
                } else {
                    this.printError(`Ошибка подключения: ${err.type}`);
                }
                this.updateStatus('offline');
                this.peer = null;
            });
            
        } catch (error) {
            this.printError(`Ошибка: ${error.message}`);
            this.updateStatus('offline');
        }
    }
    
    handleConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.updateStatus('online');
            
            this.printSuccess(`Подключен к: ${conn.peer}`);
            
            if (this.isHost) {
                this.printSystem('Новый участник присоединился!');
            }
            
            // Системное сообщение новому участнику
            if (this.isHost) {
                conn.send({
                    type: 'system',
                    message: 'Добро пожаловать в Ne2pi p2p!',
                    timestamp: Date.now()
                });
            }
        });
        
        conn.on('data', (data) => {
            this.handleIncomingData(data, conn.peer);
        });
        
        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.printSystem(`Отключен: ${conn.peer}`);
            
            if (this.connections.size === 0 && !this.isHost) {
                this.printError('Потеряно соединение с комнатой');
                this.updateStatus('offline');
                this.peer = null;
            }
        });
        
        conn.on('error', (err) => {
            this.printError(`Ошибка соединения: ${err.message}`);
        });
    }
    
    handleIncomingData(data, fromPeer) {
        const time = new Date(data.timestamp).toLocaleTimeString();
        
        switch (data.type) {
            case 'message':
                this.printOutput(`[${time}] ${fromPeer}: ${data.text}`);
                this.playSound('message');
                break;
                
            case 'system':
                this.printSystem(`[СИСТЕМА] ${data.message}`);
                break;
                
            default:
                this.printSystem(`[ДАННЫЕ от ${fromPeer}] ${JSON.stringify(data)}`);
        }
    }
    
    sendMessage(text) {
        if (!this.peer) {
            this.printError('Не подключен к комнате');
            return;
        }
        
        if (this.connections.size === 0) {
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
    
    listConnections() {
        if (this.connections.size === 0) {
            this.printOutput('Нет активных подключений');
        } else {
            this.printOutput(`Активных подключений: ${this.connections.size}`);
            this.connections.forEach((conn, peerId) => {
                this.printOutput(`  ↳ ${peerId} ${this.isHost ? '(хост)' : ''}`);
            });
        }
    }
    
    showRoomCode() {
        if (this.roomCode) {
            this.printOutput(`Код комнаты: ${this.roomCode}`);
            
            // Предлагаем скопировать
            if (confirm('Скопировать код в буфер обмена?')) {
                navigator.clipboard.writeText(this.roomCode).then(() => {
                    this.printSuccess('Код скопирован!');
                });
            }
        } else {
            this.printError('Не подключен к комнате');
        }
    }
    
    showStatus() {
        const status = document.getElementById('connection-status').textContent;
        this.printOutput(`Статус: ${status}`);
        this.printOutput(`Комната: ${this.roomCode || '--'}`);
        this.printOutput(`Участников: ${this.connections.size + 1}`);
        this.printOutput(`Режим: ${this.isHost ? 'Хост' : 'Клиент'}`);
    }
    
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.connections.clear();
        this.roomCode = null;
        this.updateStatus('offline');
        this.updateFooter();
        
        this.printSuccess('Отключен от комнаты');
    }
    
    clearScreen() {
        document.getElementById('terminal-output').innerHTML = '';
    }
    
    updateStatus(status) {
        const elem = document.getElementById('connection-status');
        elem.className = `status-${status}`;
        elem.textContent = status.toUpperCase();
    }
    
    updateFooter() {
        document.getElementById('peer-id').textContent = 
            `peer-id: ${this.peer ? this.peer.id || '--' : '--'}`;
        
        document.getElementById('room-info').textContent = 
            `комната: ${this.roomCode || '--'}`;
    }
    
    scrollToBottom() {
        const output = document.getElementById('terminal-output');
        output.scrollTop = output.scrollHeight;
    }
    
    playSound(type) {
        // Простая звуковая система (можно добавить позже)
        if (type === 'type') {
            // Тихий клик при печати
            try {
                const audio = new AudioContext();
                const oscillator = audio.createOscillator();
                const gain = audio.createGain();
                
                oscillator.connect(gain);
                gain.connect(audio.destination);
                
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gain.gain.value = 0.05;
                
                oscillator.start();
                oscillator.stop(audio.currentTime + 0.05);
            } catch (e) {
                // Игнорируем ошибки аудио
            }
        }
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
    
    // Регистрируем Service Worker для PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('✅ Service Worker зарегистрирован'))
            .catch(err => console.log('❌ Service Worker ошибка:', err));
    }
    
    // Показываем подсказку об установке PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setTimeout(() => {
            if (confirm('Установить Ne2pi p2p как приложение?')) {
                e.prompt();
            }
        }, 3000);
    });
});

// Глобальный доступ для отладки
window.Ne2piTerminal = Ne2piTerminal;
