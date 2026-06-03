// 音频管理模块

// 全局变量，将在主文件中设置
let userSystem = null;
let albumData = null;
let focusedAlbum = null;

function getFocusedAlbum() {
    return focusedAlbum && focusedAlbum.value !== undefined ? focusedAlbum.value : focusedAlbum;
}

export function setDependencies(userSystemInstance, albumDataObj, focusedAlbumRef) {
    userSystem = userSystemInstance;
    albumData = albumDataObj;
    focusedAlbum = focusedAlbumRef;
}

export function updateFocusedAlbum(newFocusedAlbum) {
    focusedAlbum = newFocusedAlbum;
}

export const audioManager = {
    albumLabelEl: null,
    progressWrapperEl: null,
    progressEl: null,
    bgEl: null,
    fillEl: null,
    knobEl: null,
    tooltipEl: null,
    currentTimeEl: null,
    durationEl: null,
    miniPlayerEl: null,
    miniProgressEl: null,
    miniFillEl: null,
    miniKnobEl: null,
    miniTooltipEl: null,
    miniCurrentTimeEl: null,
    miniDurationEl: null,
    audioEl: null,
    isPlaying: false,
    currentTrackData: null,
    pendingSrc: null,
    isDragging: false,

    init: function() {
        // 获取 DOM 元素
        this.albumLabelEl = document.getElementById('album-label');
        this.progressWrapperEl = document.getElementById('main-progress-wrapper');
        this.progressEl = document.getElementById('progress-container');
        this.bgEl = document.querySelector('#progress-container .progress-bg');
        this.fillEl = document.querySelector('#progress-container .progress-fill');
        this.knobEl = document.querySelector('#progress-container .progress-knob');
        this.tooltipEl = document.querySelector('#progress-container .progress-tooltip');
        this.currentTimeEl = document.querySelector('#progress-container .progress-current-time');
        this.durationEl = document.getElementById('progress-duration');
        this.miniPlayerEl = document.getElementById('mini-player');
        this.miniProgressEl = document.getElementById('mini-progress-container');
        this.miniFillEl = document.querySelector('#mini-progress-container .progress-fill');
        this.miniKnobEl = document.querySelector('#mini-progress-container .progress-knob');
        this.miniTooltipEl = document.querySelector('#mini-progress-container .progress-tooltip');
        this.miniCurrentTimeEl = document.getElementById('mini-current-time');
        this.miniDurationEl = document.getElementById('mini-duration');

        // 创建音频元素
        this.audioEl = new Audio();

        // 绑定进度条事件
        this.bindProgressEvents(this.progressEl, this.fillEl, this.knobEl, this.tooltipEl);
        this.bindProgressEvents(this.miniProgressEl, this.miniFillEl, this.miniKnobEl, null);

        // 绑定音频事件
        this.audioEl.addEventListener('timeupdate', () => this.updateProgress());
        this.audioEl.addEventListener('loadedmetadata', () => this.updateProgress());
        this.audioEl.addEventListener('durationchange', () => this.updateProgress());
        this.audioEl.addEventListener('play', () => this.updateProgress());
        this.audioEl.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updateUIState();
        });

        // Mini Player 按钮
        const miniPauseBtn = document.getElementById('mini-pause-btn');
        if (miniPauseBtn) {
            miniPauseBtn.onclick = (e) => {
                e.stopPropagation();
                this.playToggle();
            };
        }

        const miniCloseBtn = document.getElementById('mini-close-btn');
        if (miniCloseBtn) {
            miniCloseBtn.onclick = (e) => {
                e.stopPropagation();
                this.stop();
            };
        }

        const toggleBtn = document.getElementById('mini-toggle-btn');
        const miniPlayer = document.getElementById('mini-player');
        if (toggleBtn && miniPlayer) {
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                miniPlayer.classList.toggle('collapsed');
            };
        }

        // 绑定主播放按钮
        const trackPlayBtn = document.getElementById('track-play-btn');
        if (trackPlayBtn) {
            trackPlayBtn.onclick = (e) => {
                e.stopPropagation();
                this.handleMainPlayClick();
            };
        }

        // 绑定共鸣按钮
        const resonateBtn = document.getElementById('resonate-btn');
        if (resonateBtn) {
            resonateBtn.onclick = (e) => {
                e.stopPropagation();
                this.resonate();
            };
        }
    },

    checkAndSetupAudio: function(groupId, labelText) {
        const path = `assets/${groupId}/${labelText}(1).mp3`;
        this.hideButton();
        this.hideProgress();
        this.pendingSrc = null;

        fetch(path, { method: 'HEAD' })
            .then(res => {
                if (res.ok) {
                    const currentAlbum = getFocusedAlbum();
                    if (currentAlbum && currentAlbum.userData.labelText === labelText) {
                        this.pendingSrc = path;
                        this.showButton();

                        if ((this.audioEl.src.includes(encodeURI(path)) || this.audioEl.src.endsWith(path)) && this.audioEl.currentTime > 0) {
                            this.showProgress();
                        }

                        this.updateMainButtonIcon();
                    }
                } else {
                    this.pendingSrc = null;
                }
            })
            .catch(err => {
                this.pendingSrc = null;
            });
    },

    handleMainPlayClick: function() {
        if (!userSystem || !userSystem.isLoggedIn) {
            alert("请登录以播放音乐");
            return;
        }
        if (!this.pendingSrc) return;

        if (this.audioEl.src.includes(encodeURI(this.pendingSrc)) || this.audioEl.src.endsWith(this.pendingSrc)) {
            this.playToggle();
            const currentAlbum = getFocusedAlbum();
            if (currentAlbum) {
                this.currentTrackData = currentAlbum.userData;
            }
        } else {
            this.load(this.pendingSrc);
            const currentAlbum = getFocusedAlbum();
            if (currentAlbum) {
                this.currentTrackData = currentAlbum.userData;
            }
            this.showMiniPlayer();
            this.playToggle();
            this.hideMiniPlayer();
            this.showProgress();
        }
    },

    load: function(src) {
        if (src) {
            this.audioEl.src = src;
        } else {
            this.audioEl.src = '';
        }
    },

    updateCurrentInfo: function(data) {
        const title = data.labelText;
        const artist = albumData && albumData[title] ? albumData[title].artist : "Unknown";
        const imgPath = `assets/${data.groupId}/${title}.jpg`;

        const mini = document.getElementById('mini-player');
        if (mini) {
            const img = mini.querySelector('img');
            const titleEl = mini.querySelector('.title');
            const artistEl = mini.querySelector('.artist');
            if (img) img.src = imgPath;
            if (titleEl) titleEl.innerText = albumData && albumData[title] ? albumData[title].title : title;
            if (artistEl) artistEl.innerText = artist;
        }
    },

    playToggle: function() {
        if (!this.audioEl.src) return;
        if (this.audioEl.paused) {
            this.audioEl.play().catch(e => console.log("Audio play error", e));
            this.isPlaying = true;
        } else {
            this.audioEl.pause();
            this.isPlaying = false;
        }
        this.updateUIState();
    },

    stop: function() {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.isPlaying = false;
        this.currentTrackData = null;
        this.updateUIState();
        this.hideMiniPlayer();
    },

    updateUIState: function() {
        const playIcon = document.getElementById('track-icon-play');
        const pauseIcon = document.getElementById('track-icon-pause');
        const miniIcon = document.querySelector('#mini-pause-btn svg path');

        if (this.isPlaying) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
            if (miniIcon) miniIcon.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
        } else {
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
            if (miniIcon) miniIcon.setAttribute('d', 'M8 5v14l11-7z');
        }
    },

    updateMainButtonIcon: function() {
        const playIcon = document.getElementById('track-icon-play');
        const pauseIcon = document.getElementById('track-icon-pause');
        if (this.pendingSrc && this.audioEl.src.endsWith(this.pendingSrc) && this.isPlaying) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
        } else {
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
        }
    },

    resonate: function() {
        if (!userSystem || !userSystem.isLoggedIn) {
            alert("请登录以共鸣");
            return;
        }
        const currentAlbum = getFocusedAlbum();
        if (!currentAlbum) return;
        const userData = currentAlbum.userData;
        const title = userData.labelText;
        const artist = albumData && albumData[title] ? albumData[title].artist : "Unknown";
        const success = userSystem.addResonance(title, artist);
        if (!success) {
            console.log("Max resonance reached or not logged in");
        }
    },

    showButton: function() {
        const btn = document.getElementById('track-play-btn');
        if (btn) btn.style.display = 'flex';
    },

    hideButton: function() {
        const btn = document.getElementById('track-play-btn');
        if (btn) btn.style.display = 'none';
    },

    showResonateButton: function() {
        const btn = document.getElementById('resonate-btn');
        if (btn) btn.style.display = 'flex';
    },

    hideResonateButton: function() {
        const btn = document.getElementById('resonate-btn');
        if (btn) btn.style.display = 'none';
    },

    showProgress: function() {
        if (this.progressWrapperEl) {
            this.progressWrapperEl.classList.add('active');
        }
        this.updateProgress();
    },

    hideProgress: function() {
        if (this.progressWrapperEl) {
            this.progressWrapperEl.classList.remove('active');
        }
        this.setMainProgress(0, 0, 0);
    },

    updateProgress: function() {
        if (this.isDragging) return;
        const duration = this.audioEl.duration || 0;
        const currentTime = this.audioEl.currentTime || 0;
        const progressPercent = duration > 0 && Number.isFinite(duration) ? (currentTime / duration) * 100 : 0;
        const clampedPercent = Math.max(0, Math.min(100, progressPercent));

        this.setMainProgress(clampedPercent, currentTime, duration);
        if (this.miniFillEl) this.miniFillEl.style.width = `${clampedPercent}%`;
        if (this.miniKnobEl) this.miniKnobEl.style.left = `${clampedPercent}%`;
        if (this.miniCurrentTimeEl) {
            this.miniCurrentTimeEl.innerText = this.formatTime(currentTime);
            this.miniCurrentTimeEl.style.left = `${clampedPercent}%`;
        }
        if (this.miniDurationEl) this.miniDurationEl.innerText = this.formatTime(duration);
    },

    setMainProgress: function(percent, currentTime, duration) {
        if (this.fillEl) this.fillEl.style.width = `${percent}%`;
        if (this.knobEl) this.knobEl.style.left = `${percent}%`;
        if (this.currentTimeEl) {
            this.currentTimeEl.innerText = this.formatTime(currentTime);
            this.currentTimeEl.style.left = `${percent}%`;
        }
        if (this.durationEl) {
            this.durationEl.innerText = this.formatTime(duration);
        }
    },

    seekToPercent: function(percent) {
        const duration = this.audioEl.duration || 0;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const safePercent = Math.max(0, Math.min(1, percent));
        const targetTime = duration * safePercent;
        try {
            if (typeof this.audioEl.fastSeek === 'function') {
                this.audioEl.fastSeek(targetTime);
            } else {
                this.audioEl.currentTime = targetTime;
            }
        } catch (err) {
            this.audioEl.currentTime = targetTime;
        }
        this.setMainProgress(safePercent * 100, targetTime, duration);
        if (this.miniFillEl) this.miniFillEl.style.width = `${safePercent * 100}%`;
        if (this.miniKnobEl) this.miniKnobEl.style.left = `${safePercent * 100}%`;
        if (this.miniCurrentTimeEl) {
            this.miniCurrentTimeEl.innerText = this.formatTime(targetTime);
            this.miniCurrentTimeEl.style.left = `${safePercent * 100}%`;
        }
        if (this.miniDurationEl) this.miniDurationEl.innerText = this.formatTime(duration);
    },

    formatTime: function(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    },

    bindProgressEvents: function(container, fill, knob, tooltip) {
        if (!container) return;
        const self = this;
        let isDragging = false;
        let wasPlayingBeforeDrag = false;

        const getPercentFromEvent = (e) => {
            const rect = container.getBoundingClientRect();
            let offsetX = e.clientX - rect.left;
            if (offsetX < 0) offsetX = 0;
            if (offsetX > rect.width) offsetX = rect.width;
            return rect.width > 0 ? (offsetX / rect.width) : 0;
        };

        const paintProgress = (percent) => {
            const safePercent = Math.max(0, Math.min(1, percent));
            const percentValue = safePercent * 100;

            if (fill) fill.style.width = `${percentValue}%`;
            if (knob) knob.style.left = `${percentValue}%`;

            const duration = self.audioEl.duration || 0;
            const time = duration * safePercent;
            if (container.id === 'progress-container') {
                self.setMainProgress(percentValue, time, duration);
            }
            if (tooltip) {
                tooltip.innerText = `${self.formatTime(time)} / ${self.formatTime(duration)}`;
                tooltip.style.left = `${percentValue}%`;
                tooltip.style.opacity = 1;
            }

            return safePercent;
        };

        const commitSeek = (percent) => {
            self.seekToPercent(percent);
            if (wasPlayingBeforeDrag && self.audioEl.paused) {
                self.audioEl.play().catch(err => console.log("Audio play error", err));
            }
            self.updateProgress();
        };

        container.addEventListener('pointerdown', (e) => {
            if (!self.audioEl.src) return;
            e.preventDefault();
            e.stopPropagation();
            wasPlayingBeforeDrag = !self.audioEl.paused;
            self.isDragging = true;
            isDragging = true;
            container.setPointerCapture?.(e.pointerId);
            const percent = paintProgress(getPercentFromEvent(e));
            self.seekToPercent(percent);
        });

        container.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            paintProgress(getPercentFromEvent(e));
        });

        container.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            const percent = paintProgress(getPercentFromEvent(e));
            commitSeek(percent);
            isDragging = false;
            self.isDragging = false;
            container.releasePointerCapture?.(e.pointerId);
            if (tooltip) tooltip.style.opacity = 0;
        });

        container.addEventListener('pointercancel', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
            self.isDragging = false;
            container.releasePointerCapture?.(e.pointerId);
            self.updateProgress();
            if (tooltip) tooltip.style.opacity = 0;
        });

        container.addEventListener('mousemove', (e) => {
            if (!self.audioEl.src || isDragging) return;
            const percent = getPercentFromEvent(e);
            const duration = self.audioEl.duration || 0;
            if (tooltip) {
                tooltip.innerText = `${self.formatTime(duration * percent)} / ${self.formatTime(duration)}`;
                tooltip.style.left = `${percent * 100}%`;
            }
        });
    },

    showMiniPlayer: function() {
        if (!this.currentTrackData) return;
        const data = this.currentTrackData;
        const title = data.labelText;
        const artist = albumData && albumData[title] ? albumData[title].artist : "Unknown";
        const imgPath = `assets/${data.groupId}/${title}.jpg`;

        const mini = this.miniPlayerEl;
        if (mini) {
            const img = mini.querySelector('img');
            const titleEl = mini.querySelector('.title');
            const artistEl = mini.querySelector('.artist');
            if (img) img.src = imgPath;
            if (titleEl) titleEl.innerText = albumData && albumData[title] ? albumData[title].title : title;
            if (artistEl) artistEl.innerText = artist;
            mini.classList.add('active');
            this.updateUIState();
        }
    },

    hideMiniPlayer: function() {
        if (this.miniPlayerEl) {
            this.miniPlayerEl.classList.remove('active');
        }
    }
};

