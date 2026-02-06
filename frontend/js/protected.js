
import { checkAuth } from "./auth.js";
import { websocketManager } from "./websocket_manager.js";

checkAuth().then(ok => {
    if (ok) {
        console.log('Authentication successful, connecting WebSocket...');
        
        
        websocketManager.connect().then(() => {
            console.log('WebSocket connected successfully');
        }).catch(error => {
            console.error('WebSocket connection failed:', error);
        });
        
        
        setInterval(() => {
            const status = websocketManager.getStatus();
            console.log('WebSocket status:', status);
        }, 10000);
        
    } else {
        window.location.href = "/login.html";
    }
});