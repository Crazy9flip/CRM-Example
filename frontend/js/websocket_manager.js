
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.reconnectInterval = 3000;
        this.isConnected = false;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.pendingMessages = [];
        this.connectionPromise = null;
    }

    async connect() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                const isLocalhost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
                const API_URL = isLocalhost ? "127.0.0.1:8000" : "api.example.com";
                
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${API_URL}/ws`;
                
                console.log('Connecting to WebSocket:', wsUrl);
                
                this.socket = new WebSocket(wsUrl);
                
                this.socket.onopen = () => {
                    console.log('WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    
                    this.flushPendingMessages();
                    resolve(true);
                };

                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('WebSocket message received:', data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error, event.data);
                    }
                };

                this.socket.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    this.connectionPromise = null;
                    
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                        setTimeout(() => this.connect(), this.reconnectInterval);
                    } else {
                        console.log('Max reconnection attempts reached');
                        reject(new Error('Failed to connect to WebSocket'));
                    }
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.connectionPromise = null;
                    reject(error);
                };

            } catch (error) {
                console.error('WebSocket connection failed:', error);
                this.connectionPromise = null;
                reject(error);
            }
        });

        return this.connectionPromise;
    }

    
    flushPendingMessages() {
        while (this.pendingMessages.length > 0) {
            const message = this.pendingMessages.shift();
            this.sendImmediate(message.type, message.payload);
        }
    }

    
    sendImmediate(type, payload) {
        if (this.isConnected && this.socket) {
            const message = { type, ...payload };
            console.log('Sending WebSocket message:', message);
            this.socket.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    async send(type, payload) {
        
        if (this.isConnected) {
            return this.sendImmediate(type, payload);
        }
        
        
        if (this.connectionPromise) {
            try {
                await this.connectionPromise;
                return this.sendImmediate(type, payload);
            } catch (error) {
                console.warn('Failed to send message after connection attempt:', type, error);
                return false;
            }
        }
        
        
        console.log('WebSocket not connected, queuing message:', type);
        this.pendingMessages.push({ type, payload });
        
        try {
            await this.connect();
            return this.sendImmediate(type, payload);
        } catch (error) {
            console.warn('Failed to send message after connection:', type, error);
            return false;
        }
    }

    handleMessage(data) {
        const { type, ...payload } = data;
        
        console.log('Handling WebSocket message:', type, payload);
        
        if (this.eventHandlers.has(type)) {
            this.eventHandlers.get(type).forEach(handler => {
                try {
                    handler(payload);
                } catch (error) {
                    console.error('Error in WebSocket handler:', error);
                }
            });
        } else {
            console.log('No handlers for message type:', type);
        }
    }

    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
        console.log(`Registered handler for: ${eventType}, total handlers: ${this.eventHandlers.get(eventType).length}`);
    }

    off(eventType, handler) {
        if (this.eventHandlers.has(eventType)) {
            const handlers = this.eventHandlers.get(eventType);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
        this.isConnected = false;
        this.connectionPromise = null;
        this.pendingMessages = [];
    }

    
    getStatus() {
        return {
            isConnected: this.isConnected,
            pendingMessages: this.pendingMessages.length,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

export const websocketManager = new WebSocketManager();