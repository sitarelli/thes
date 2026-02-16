/* -------------------------------------------------------------------------- */
/* AUDIO MANAGER - Sistema robusto di caricamento e gestione audio           */
/* -------------------------------------------------------------------------- */

class AudioManager {
    constructor() {
        this.sounds = {};
        this.audioContext = null;
        this.loadedCount = 0;
        this.totalCount = 0;
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        
        // Definizione suoni con formati multipli (fallback automatico)
        this.soundDefinitions = {
            doorOpen: { files: ['audio/dooropen.ogg', 'audio/dooropen.mp3'], volume: 0.6 },
            doorClose: { files: ['audio/doorclose.ogg', 'audio/doorclose.mp3'], volume: 0.6 },
            walk: { files: ['audio/walkingthes.ogg', 'audio/walkingthes.mp3'], volume: 0.4, loop: true },
            fly: { files: ['audio/flyingthes.ogg', 'audio/flyingthes.m4a'], volume: 0.5, loop: true },
            levelup: { files: ['audio/levelup.ogg', 'audio/levelup.mp3'], volume: 0.7 },
            beginLevel: { files: ['audio/beginlevel.ogg', 'audio/beginlevel.mp3'], volume: 0.7 },
            keyPickup: { files: ['audio/key.ogg', 'audio/key.mp3'], volume: 0.6 },
            death: { files: ['audio/death.ogg', 'audio/death.mp3'], volume: 0.7 },
            contact: { files: ['audio/contact.ogg', 'audio/contact.mp3'], volume: 0.6 },
            lava: { files: ['audio/lava.ogg', 'audio/lava.mp3'], volume: 0.5 }
        };
        
        this.totalCount = Object.keys(this.soundDefinitions).length;
    }
    
    // Inizializza AudioContext (deve essere chiamato dopo user interaction)
    initAudioContext() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }
    
    // Carica tutti gli audio con sistema di fallback multi-formato
    loadAll(onProgress, onComplete) {
        this.onProgressCallback = onProgress;
        this.onCompleteCallback = onComplete;
        this.loadedCount = 0;
        
        console.log('🔊 Inizio caricamento audio...');
        
        // Carica ogni suono
        Object.entries(this.soundDefinitions).forEach(([name, config]) => {
            this.loadSound(name, config);
        });
    }
    
    // Carica un singolo suono con fallback automatico
    loadSound(name, config) {
        const audio = new Audio();
        
        // Configurazione base
        audio.volume = config.volume || 1.0;
        audio.loop = config.loop || false;
        audio.preload = 'auto';
        
        let currentFormatIndex = 0;
        const tryNextFormat = () => {
            if (currentFormatIndex >= config.files.length) {
                console.warn(`⚠️ Impossibile caricare ${name}, tutti i formati falliti`);
                this.onSoundLoaded(name, null);
                return;
            }
            
            const src = config.files[currentFormatIndex];
            console.log(`🎵 Tentativo caricamento: ${name} → ${src}`);
            
            audio.src = src;
            
            // Timeout per fallback rapido (2 secondi max per formato)
            const timeout = setTimeout(() => {
                console.warn(`⏱️ Timeout su ${src}, provo formato successivo...`);
                currentFormatIndex++;
                tryNextFormat();
            }, 2000);
            
            // Success handler
            const onSuccess = () => {
                clearTimeout(timeout);
                console.log(`✅ Caricato: ${name} (${src})`);
                this.onSoundLoaded(name, audio);
                cleanup();
            };
            
            // Error handler
            const onError = () => {
                clearTimeout(timeout);
                console.warn(`❌ Errore su ${src}, provo formato successivo...`);
                currentFormatIndex++;
                tryNextFormat();
                cleanup();
            };
            
            const cleanup = () => {
                audio.removeEventListener('canplaythrough', onSuccess);
                audio.removeEventListener('error', onError);
            };
            
            audio.addEventListener('canplaythrough', onSuccess, { once: true });
            audio.addEventListener('error', onError, { once: true });
            audio.load();
        };
        
        tryNextFormat();
    }
    
    // Callback quando un suono è caricato
    onSoundLoaded(name, audio) {
        this.sounds[name] = audio;
        this.loadedCount++;
        
        const progress = Math.floor((this.loadedCount / this.totalCount) * 100);
        console.log(`📊 Progresso: ${this.loadedCount}/${this.totalCount} (${progress}%)`);
        
        if (this.onProgressCallback) {
            this.onProgressCallback(this.loadedCount, this.totalCount, progress);
        }
        
        if (this.loadedCount >= this.totalCount) {
            console.log('✨ Tutti gli audio caricati!');
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
        }
    }
    
    // Play con gestione errori robusta
    play(name) {
        const audio = this.sounds[name];
        if (!audio) {
            console.warn(`Audio '${name}' non trovato`);
            return;
        }
        
        // Riprendi AudioContext se sospeso
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Reset posizione se l'audio è già pronto
        if (audio.readyState >= 2) {
            audio.currentTime = 0;
        }
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                if (err.name === 'NotAllowedError') {
                    console.warn('🔇 Audio bloccato da policy browser');
                } else if (err.name === 'AbortError') {
                    // Retry dopo breve delay
                    setTimeout(() => {
                        audio.play().catch(e => console.warn('Retry fallito:', e));
                    }, 50);
                } else {
                    console.warn('Errore audio:', err);
                }
            });
        }
    }
    
    // Stop audio
    stop(name) {
        const audio = this.sounds[name];
        if (!audio) return;
        
        audio.pause();
        if (audio.readyState >= 2) {
            audio.currentTime = 0;
        }
    }
    
    // Stop tutti gli audio
    stopAll() {
        Object.values(this.sounds).forEach(audio => {
            if (audio) {
                audio.pause();
                if (audio.readyState >= 2) {
                    audio.currentTime = 0;
                }
            }
        });
    }
    
    // Unlock audio per iOS/Android (chiamare al primo tap/touch)
    unlock() {
        this.initAudioContext();
        
        // "Prime" ogni audio riproducendolo silenziosamente
        // Questo sblocca completamente l'audio su iOS/Android
        Object.values(this.sounds).forEach(audio => {
            if (!audio) return;
            
            const originalVolume = audio.volume;
            audio.volume = 0;
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    audio.pause();
                    if (audio.readyState >= 2) {
                        audio.currentTime = 0;
                    }
                    audio.volume = originalVolume;
                }).catch(() => {
                    audio.volume = originalVolume;
                });
            }
        });
        
        console.log('🔓 Audio sbloccato (iOS/Android ready)');
    }
}

// Export singleton
export const audioManager = new AudioManager();
