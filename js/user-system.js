// 用户系统模块
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { hashPassword } from './utils.js';

// 12 New High Saturation Colors
export const PARTICLE_COLORS = [
    '#FF0055', // Radical Red
    '#FF5500', // International Orange
    '#FFD500', // Cyber Yellow
    '#A6FF00', // Spring Bud
    '#00FF55', // Malachite
    '#00FFD5', // Bright Turquoise
    '#00A6FF', // Dodger Blue
    '#002AFF', // Blue
    '#7B00FF', // Electric Violet
    '#D400FF', // Phlox
    '#FF00D4', // Shocking Pink
    '#FFFFFF'  // White
];

export const PARTICLE_SHAPES = [
    { id: 'square', label: '方形', symbol: '■' },
    { id: 'heart', label: '爱心', symbol: '♥' },
    { id: 'diamond', label: '菱形星星', symbol: '✦' },
    { id: 'circle', label: '圆点', symbol: '●' },
    { id: 'star', label: '五角星', symbol: '★' }
];

let db = null;
let auth = null;
let isOfflineMode = false;

// 全局变量，将在 scene.js 中设置
let updateResonanceGeometry = null;
let uiManager = null;

export function setDependencies(updateResonanceGeometryFn, uiManagerInstance) {
    updateResonanceGeometry = updateResonanceGeometryFn;
    uiManager = uiManagerInstance;
}

export const userSystem = {
    isLoggedIn: false,
    username: null,
    resonatedList: [],
    userColor: '#ffffff',
    userBlinkSpeed: 50,
    userShapes: ['circle'],

    init: function() {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;

        if (firebaseConfig) {
            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            signInAnonymously(auth).then(() => {
                this.enableButtons();
            }).catch(() => this.activateOffline());
        } else {
            this.activateOffline();
        }
        setTimeout(() => {
            if (!db && !isOfflineMode) this.activateOffline();
        }, 3000);
    },

    activateOffline: function() {
        isOfflineMode = true;
        this.enableButtons();
    },

    enableButtons: function() {
        const bL = document.getElementById('btn-login');
        const bR = document.getElementById('btn-register');
        if (bL) {
            bL.disabled = false;
            bL.textContent = "LOGIN";
        }
        if (bR) {
            bR.disabled = false;
            bR.textContent = "REGISTER";
        }
    },

    register: async function(u, p) {
        const msg = document.getElementById('reg-msg-area');
        msg.textContent = "Processing...";
        
        // 哈希密码
        const passwordHash = await hashPassword(p);
        const defColor = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];

        if (isOfflineMode) {
            let localDB = JSON.parse(localStorage.getItem('mobius_users') || '{}');
            if (localDB[u]) {
                msg.textContent = "Username taken.";
                return;
            }
            // 存储哈希后的密码
            localDB[u] = {
                passwordHash: passwordHash,
                resonated: [],
                color: defColor,
                blinkSpeed: 50,
                shapes: ['circle']
            };
            localStorage.setItem('mobius_users', JSON.stringify(localDB));
            alert("注册成功！");
            if (uiManager) uiManager.switchModal('login');
            return;
        }

        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const ref = doc(db, 'artifacts', appId, 'public', 'data', 'user_accounts', u);
            if ((await getDoc(ref)).exists()) {
                msg.textContent = "Username exists.";
                return;
            }
            // 存储哈希后的密码
            await setDoc(ref, {
                passwordHash: passwordHash,
                resonated: [],
                color: defColor,
                blinkSpeed: 50,
                shapes: ['circle']
            });
            alert("注册成功！");
            if (uiManager) uiManager.switchModal('login');
        } catch (e) {
            msg.textContent = "Error: " + e.message;
        }
    },

    login: async function(u, p) {
        const msg = document.getElementById('login-msg-area');
        msg.textContent = "验证中...";
        
        // 哈希输入的密码
        const passwordHash = await hashPassword(p);
        let userData = null;

        if (isOfflineMode) {
            userData = JSON.parse(localStorage.getItem('mobius_users') || '{}')[u];
        } else {
            try {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_accounts', u));
                if (snap.exists()) userData = snap.data();
            } catch (e) {
                msg.textContent = "网络错误";
                return;
            }
        }

        // 兼容旧数据：如果存在 password 字段，也支持（用于迁移）
        const storedHash = userData?.passwordHash || (userData?.password ? await hashPassword(userData.password) : null);
        
        if (userData && storedHash && storedHash === passwordHash) {
            this.isLoggedIn = true;
            this.username = u;
            this.resonatedList = userData.resonated || [];
            this.userColor = userData.color || PARTICLE_COLORS[0];
            this.userBlinkSpeed = userData.blinkSpeed !== undefined ? userData.blinkSpeed : 50;
            this.userShapes = Array.isArray(userData.shapes) && userData.shapes.length ? userData.shapes : ['circle'];
            this.onLoginSuccess();
        } else {
            msg.textContent = "无效的凭据";
        }
    },

    cheatLogin: async function() {
        const username = '小白';
        const password = '12345678';
        const msg = document.getElementById('login-msg-area');
        if (msg) msg.textContent = "Cheat login...";

        const passwordHash = await hashPassword(password);
        let localDB = JSON.parse(localStorage.getItem('mobius_users') || '{}');
        const existing = localDB[username] || {};
        localDB[username] = {
            passwordHash,
            resonated: existing.resonated || [],
            color: existing.color || PARTICLE_COLORS[0],
            blinkSpeed: existing.blinkSpeed !== undefined ? existing.blinkSpeed : 50,
            shapes: Array.isArray(existing.shapes) && existing.shapes.length ? existing.shapes : ['circle']
        };
        localStorage.setItem('mobius_users', JSON.stringify(localDB));

        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        if (usernameInput) usernameInput.value = username;
        if (passwordInput) passwordInput.value = password;

        await this.login(username, password);
    },

    logout: function() {
        this.isLoggedIn = false;
        this.username = null;
        this.resonatedList = [];
        if (uiManager) uiManager.closeOverlay();
        const loginHint = document.getElementById('login-hint');
        if (loginHint) loginHint.style.display = 'block';
        alert("已登出");
    },

    onLoginSuccess: function() {
        if (uiManager) {
            uiManager.closeOverlay();
            uiManager.initShapePicker();
            uiManager.initColorPicker();
            uiManager.updateProfileUI();
        }
        this.syncVisuals();
        const loginHint = document.getElementById('login-hint');
        if (loginHint) loginHint.style.display = 'none';
        alert("欢迎回来 " + this.username);
    },

    saveData: async function() {
        if (isOfflineMode) {
            let localDB = JSON.parse(localStorage.getItem('mobius_users') || '{}');
            if (localDB[this.username]) {
                localDB[this.username].resonated = this.resonatedList;
                localDB[this.username].color = this.userColor;
                localDB[this.username].blinkSpeed = this.userBlinkSpeed;
                localDB[this.username].shapes = this.userShapes;
                localStorage.setItem('mobius_users', JSON.stringify(localDB));
            }
        } else {
            try {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                await setDoc(
                    doc(db, 'artifacts', appId, 'public', 'data', 'user_accounts', this.username),
                    {
                        resonated: this.resonatedList,
                        color: this.userColor,
                        blinkSpeed: this.userBlinkSpeed,
                        shapes: this.userShapes
                    },
                    { merge: true }
                );
            } catch (e) {
                console.error("Save data error:", e);
            }
        }
    },

    addResonance: function(title, artist) {
        if (!this.isLoggedIn) return false;
        let item = this.resonatedList.find(i => i.album === title);
        if (!item) {
            item = { album: title, artist: artist, count: 0 };
            this.resonatedList.push(item);
        }
        if (item.count < 10) {
            item.count++;
            this.saveData();
            this.syncVisuals();
            if (uiManager) uiManager.updateProfileUI();
            return true;
        }
        return false;
    },

    updateResonanceCount: function(title, delta) {
        let item = this.resonatedList.find(i => i.album === title);
        if (item) {
            const newCount = item.count + delta;
            if (newCount >= 0 && newCount <= 10) {
                item.count = newCount;
                if (item.count === 0) {
                    this.resonatedList = this.resonatedList.filter(i => i.album !== title);
                }
                this.saveData();
                this.syncVisuals();
                if (uiManager) uiManager.updateProfileUI();
            }
        }
    },

    deleteResonance: function(title) {
        this.resonatedList = this.resonatedList.filter(i => i.album !== title);
        this.saveData();
        this.syncVisuals();
        if (uiManager) uiManager.updateProfileUI();
    },

    setColor: function(color) {
        this.userColor = color;
        this.saveData();
        this.syncVisuals();
        if (uiManager) uiManager.updateProfileUI();
    },

    setBlinkSpeed: function(speed) {
        this.userBlinkSpeed = parseInt(speed);
        this.saveData();
    },

    toggleShape: function(shapeId) {
        const validIds = PARTICLE_SHAPES.map(shape => shape.id);
        if (!validIds.includes(shapeId)) return;

        if (this.userShapes.includes(shapeId)) {
            if (this.userShapes.length === 1) return;
            this.userShapes = this.userShapes.filter(id => id !== shapeId);
        } else {
            this.userShapes = [...this.userShapes, shapeId];
        }

        this.saveData();
        this.syncVisuals();
        if (uiManager) uiManager.updateProfileUI();
    },

    syncVisuals: function() {
        if (!this.isLoggedIn || !updateResonanceGeometry) return;
        const albums = window.albums || [];
        albums.forEach(g => {
            const title = g.userData.labelText;
            const item = this.resonatedList.find(i => i.album === title);
            const count = item ? item.count : 0;
            g.userData.localClicks = count;
            let pCount = 0;
            if (count > 0) {
                pCount = count <= 5 ? 200 * Math.pow(2, count - 1) : 3200 + (count - 5) * 640;
            }
            g.userData.currentParticleCount = pCount;
            if (pCount > 0) {
                updateResonanceGeometry(g.userData.resonanceParticles, pCount, this.userShapes);
                g.userData.resonanceParticles.visible = true;
                g.userData.resonanceParticles.traverse(obj => {
                    if (obj.material && obj.material.color) obj.material.color.set(this.userColor);
                });
            } else {
                g.userData.resonanceParticles.visible = false;
            }
        });
    }
};


