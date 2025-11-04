/**
 * xsukax CAPTCHA v2.0
 * Enhanced secure CAPTCHA with advanced bot protection
 * Usage: <script src="captcha.js"></script>
 *        <div class="xsukax-captcha"></div>
 */

(function(global) {
    'use strict';
    
    const CONFIG = {
        canvasWidth: 300,
        canvasHeight: 100,
        codeLength: 6,
        challengeTimeout: 180000,
        maxAttempts: 3,
        tokenLength: 32,
        minInteractionTime: 500,
        fonts: ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana'],
        characters: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        colors: {
            primary: '#2c3e50',
            secondary: '#3498db',
            background: '#f8f9fa',
            text: '#2c3e50',
            success: '#28a745',
            error: '#dc3545',
            lightText: '#6c757d',
            border: '#dee2e6'
        }
    };

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    global.xsukaxCAPTCHA = { version: '2.0.0' };
    const captchaInstances = new Map();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInitialize);
    } else {
        autoInitialize();
    }

    function autoInitialize() {
        const captchaElements = document.querySelectorAll('.xsukax-captcha');
        captchaElements.forEach((element, index) => {
            if (!element.id) {
                element.id = `xsukax-captcha-${Date.now()}-${index}`;
            }
            initializeCaptcha(element);
        });
        attachToForms();
    }

    function initializeCaptcha(container) {
        try {
            container.innerHTML = '';
            
            const instanceState = {
                id: container.id,
                currentToken: generateToken(),
                currentCode: null,
                canvasFingerprint: null,
                attempts: 0,
                verified: false,
                startTime: Date.now(),
                firstInteractionTime: null,
                interactionCount: 0,
                container: container
            };

            captchaInstances.set(container.id, instanceState);
            
            const wrapper = createWrapper();
            const header = createHeader(container.id);
            const canvasContainer = createCanvasContainer(instanceState);
            const inputGroup = createInputGroup(instanceState);
            const status = createStatus();
            const footer = createFooter();

            wrapper.appendChild(header);
            wrapper.appendChild(canvasContainer);
            wrapper.appendChild(inputGroup);
            wrapper.appendChild(status);
            wrapper.appendChild(footer);
            container.appendChild(wrapper);

            instanceState.canvas = canvasContainer.querySelector('canvas');
            instanceState.ctx = instanceState.canvas.getContext('2d');
            instanceState.input = inputGroup.querySelector('input');
            instanceState.verifyBtn = inputGroup.querySelector('button');
            instanceState.status = status;

            generateChallenge(instanceState);
            attachBehaviorTracking(instanceState);

        } catch (error) {
            console.error('xsukax CAPTCHA initialization error:', error);
            container.innerHTML = `
                <div style="border: 1px solid #dc3545; border-radius: 6px; padding: 16px; background: #f8d7da; color: #721c24; font-family: Arial, sans-serif; font-size: 14px;">
                    <strong>Security Check Error:</strong> Failed to initialize CAPTCHA.
                    <button type="button" onclick="window.xsukaxCAPTCHA.resetAll()" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 6px 12px; margin-left: 10px; cursor: pointer; font-size: 12px;">Retry</button>
                </div>
            `;
        }
    }

    function createWrapper() {
        const wrapper = document.createElement('div');
        wrapper.className = 'xsukax-captcha-wrapper';
        wrapper.style.cssText = `
            border: 1px solid ${CONFIG.colors.border};
            border-radius: 6px;
            padding: 16px;
            background: ${CONFIG.colors.background};
            font-family: ${CONFIG.fonts[0]}, sans-serif;
            max-width: ${CONFIG.canvasWidth + 32}px;
            margin: 12px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        return wrapper;
    }

    function createHeader(instanceId) {
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        
        const title = document.createElement('div');
        title.textContent = 'Security Verification';
        title.style.cssText = `font-weight: 600; color: ${CONFIG.colors.text}; font-size: 14px;`;
        
        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '↻';
        refreshBtn.title = 'New Challenge';
        refreshBtn.type = 'button';
        refreshBtn.style.cssText = `
            background: transparent;
            color: ${CONFIG.colors.primary};
            border: 1px solid ${CONFIG.colors.border};
            border-radius: 4px;
            width: 32px;
            height: 32px;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        refreshBtn.onmouseenter = function() {
            this.style.background = CONFIG.colors.primary;
            this.style.color = 'white';
        };
        refreshBtn.onmouseleave = function() {
            this.style.background = 'transparent';
            this.style.color = CONFIG.colors.primary;
        };
        refreshBtn.onclick = () => resetCaptcha(instanceId);
        
        header.appendChild(title);
        header.appendChild(refreshBtn);
        return header;
    }

    function createCanvasContainer(instanceState) {
        const container = document.createElement('div');
        container.style.cssText = 'margin-bottom: 12px; position: relative; user-select: none;';
        
        const canvas = document.createElement('canvas');
        canvas.width = CONFIG.canvasWidth;
        canvas.height = CONFIG.canvasHeight;
        canvas.style.cssText = `
            border: 1px solid ${CONFIG.colors.border};
            border-radius: 4px;
            background: white;
            display: block;
            cursor: pointer;
            width: 100%;
            height: auto;
            touch-action: manipulation;
        `;
        canvas.onclick = () => resetCaptcha(instanceState.id);
        
        container.appendChild(canvas);
        return container;
    }

    function createInputGroup(instanceState) {
        const group = document.createElement('div');
        group.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px; align-items: stretch;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter the code';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.inputMode = 'text';
        input.style.cssText = `
            flex: 1;
            padding: 10px 12px;
            border: 1px solid ${CONFIG.colors.border};
            border-radius: 4px;
            font-family: ${CONFIG.fonts[0]}, monospace;
            font-size: ${isMobile ? '16px' : '14px'};
            transition: border-color 0.2s;
            text-transform: uppercase;
        `;
        
        input.oninput = function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        };
        input.onfocus = function() {
            this.style.borderColor = CONFIG.colors.primary;
            this.style.outline = 'none';
        };
        input.onblur = function() {
            this.style.borderColor = CONFIG.colors.border;
        };
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyCaptcha(instanceState);
            }
        };
        
        const verifyBtn = document.createElement('button');
        verifyBtn.textContent = 'Verify';
        verifyBtn.type = 'button';
        verifyBtn.style.cssText = `
            background: ${CONFIG.colors.primary};
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0 20px;
            cursor: pointer;
            font-family: ${CONFIG.fonts[0]}, sans-serif;
            font-size: ${isMobile ? '16px' : '14px'};
            font-weight: 500;
            transition: background-color 0.2s;
            min-width: 90px;
            touch-action: manipulation;
        `;
        verifyBtn.onmouseenter = function() {
            if (!this.disabled) this.style.background = '#1a2530';
        };
        verifyBtn.onmouseleave = function() {
            if (!this.disabled) this.style.background = CONFIG.colors.primary;
        };
        verifyBtn.onclick = () => verifyCaptcha(instanceState);
        
        group.appendChild(input);
        group.appendChild(verifyBtn);
        return group;
    }

    function createStatus() {
        const status = document.createElement('div');
        status.className = 'xsukax-captcha-status';
        status.style.cssText = 'min-height: 18px; margin-bottom: 8px; font-size: 13px; line-height: 1.4;';
        return status;
    }

    function createFooter() {
        const footer = document.createElement('div');
        footer.style.cssText = `
            text-align: right;
            font-size: 11px;
            color: ${CONFIG.colors.lightText};
            border-top: 1px solid ${CONFIG.colors.border};
            padding-top: 8px;
        `;
        footer.innerHTML = 'Protected by <strong>xsukax CAPTCHA</strong>';
        return footer;
    }

    function generateChallenge(instanceState) {
        const { ctx, canvas } = instanceState;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        instanceState.currentCode = '';
        for (let i = 0; i < CONFIG.codeLength; i++) {
            instanceState.currentCode += CONFIG.characters.charAt(
                Math.floor(Math.random() * CONFIG.characters.length)
            );
        }

        drawComplexBackground(ctx, canvas.width, canvas.height);
        drawDistortedText(ctx, instanceState.currentCode, canvas.width, canvas.height);
        addAdvancedNoise(ctx, canvas.width, canvas.height);
        
        if (!isMobile) {
            addWaveDistortion(ctx, canvas.width, canvas.height);
        }
        
        instanceState.canvasFingerprint = generateCanvasFingerprint(ctx, canvas);
        
        showStatus(instanceState, 'Type the characters shown above', 'info');
    }

    function drawComplexBackground(ctx, width, height) {
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        for (let i = 0; i < 15; i++) {
            ctx.strokeStyle = `rgba(${Math.random()*50}, ${Math.random()*50}, ${Math.random()*50}, 0.05)`;
            ctx.lineWidth = Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(Math.random() * width, Math.random() * height);
            ctx.quadraticCurveTo(
                Math.random() * width, Math.random() * height,
                Math.random() * width, Math.random() * height
            );
            ctx.stroke();
        }
    }

    function drawDistortedText(ctx, text, width, height) {
        const fontSize = 42;
        const fontFamily = CONFIG.fonts[Math.floor(Math.random() * CONFIG.fonts.length)];
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'middle';
        
        const letterSpacing = 10;
        const totalWidth = text.length * (fontSize * 0.6 + letterSpacing);
        const startX = (width - totalWidth) / 2;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const x = startX + (i * (fontSize * 0.6 + letterSpacing)) + fontSize * 0.3;
            const y = height / 2 + (Math.sin(i * 0.8) * 10);
            
            const rotation = (Math.random() - 0.5) * 0.4;
            const scale = 0.9 + Math.random() * 0.2;
            const hue = 200 + Math.random() * 60;
            const saturation = 60 + Math.random() * 20;
            const lightness = 25 + Math.random() * 15;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            ctx.fillText(char, 0, 0);
            
            ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness - 10}%)`;
            ctx.lineWidth = 0.5;
            ctx.strokeText(char, 0, 0);
            
            ctx.restore();
        }
    }

    function addAdvancedNoise(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (Math.random() < 0.02) {
                const noise = (Math.random() - 0.5) * 50;
                data[i] += noise;
                data[i + 1] += noise;
                data[i + 2] += noise;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = `rgba(${Math.random()*100}, ${Math.random()*100}, ${Math.random()*100}, 0.15)`;
            ctx.lineWidth = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * width, Math.random() * height);
            ctx.lineTo(Math.random() * width, Math.random() * height);
            ctx.stroke();
        }
    }

    function addWaveDistortion(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        
        ctx.clearRect(0, 0, width, height);
        
        for (let y = 0; y < height; y++) {
            const offset = Math.sin(y / 8) * 3;
            ctx.drawImage(tempCanvas, 0, y, width, 1, offset, y, width, 1);
        }
    }

    function generateCanvasFingerprint(ctx, canvas) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let hash = 0;
        for (let i = 0; i < imageData.data.length; i += 100) {
            hash = ((hash << 5) - hash) + imageData.data[i];
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    function attachBehaviorTracking(instanceState) {
        const { input, canvas } = instanceState;
        
        const trackInteraction = () => {
            if (!instanceState.firstInteractionTime) {
                instanceState.firstInteractionTime = Date.now();
            }
            instanceState.interactionCount++;
        };
        
        input.addEventListener('focus', trackInteraction);
        input.addEventListener('input', trackInteraction);
        input.addEventListener('click', trackInteraction);
        input.addEventListener('touchstart', trackInteraction);
        canvas.addEventListener('click', trackInteraction);
        canvas.addEventListener('touchstart', trackInteraction);
    }

    function verifyCaptcha(instanceState) {
        const { input } = instanceState;
        const userInput = input.value.trim();

        if (!instanceState.currentCode) {
            showStatus(instanceState, 'Challenge expired. Please refresh.', 'error');
            return;
        }

        if (Date.now() - instanceState.startTime > CONFIG.challengeTimeout) {
            showStatus(instanceState, 'Time limit exceeded. Please refresh.', 'error');
            resetCaptcha(instanceState.id);
            return;
        }

        const interactionTime = instanceState.firstInteractionTime ? 
            Date.now() - instanceState.firstInteractionTime : 0;
        
        if (interactionTime < CONFIG.minInteractionTime && instanceState.interactionCount < 2) {
            showStatus(instanceState, 'Please take your time to solve the challenge.', 'error');
            return;
        }

        instanceState.attempts++;

        const normalizedInput = userInput.replace(/\s/g, '').toUpperCase();
        const normalizedCode = instanceState.currentCode.toUpperCase();

        if (normalizedInput === normalizedCode) {
            instanceState.verified = true;
            showStatus(instanceState, '✓ Verification successful!', 'success');
            
            input.disabled = true;
            instanceState.verifyBtn.disabled = true;
            input.style.backgroundColor = '#f0fff4';
            input.style.borderColor = CONFIG.colors.success;
            instanceState.verifyBtn.style.background = CONFIG.colors.success;
            instanceState.verifyBtn.textContent = 'Verified';
            
            addTokenToForm(instanceState);
            
        } else {
            const remaining = CONFIG.maxAttempts - instanceState.attempts;
            
            if (remaining > 0) {
                showStatus(instanceState, `✗ Incorrect. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.`, 'error');
            } else {
                showStatus(instanceState, '✗ Too many attempts. Please refresh.', 'error');
            }
            
            input.value = '';
            input.focus();
            input.style.borderColor = CONFIG.colors.error;
            
            setTimeout(() => {
                if (!instanceState.verified) {
                    input.style.borderColor = CONFIG.colors.border;
                }
            }, 2000);
            
            generateChallenge(instanceState);
            
            if (instanceState.attempts >= CONFIG.maxAttempts) {
                input.disabled = true;
                instanceState.verifyBtn.disabled = true;
                instanceState.verifyBtn.style.background = CONFIG.colors.error;
                instanceState.verifyBtn.textContent = 'Failed';
            }
        }
    }

    function showStatus(instanceState, message, type) {
        const { status } = instanceState;
        status.textContent = message;
        status.style.color = type === 'success' ? CONFIG.colors.success : 
                            type === 'error' ? CONFIG.colors.error : 
                            CONFIG.colors.lightText;
    }

    function resetCaptcha(instanceId) {
        const instanceState = captchaInstances.get(instanceId);
        if (instanceState) {
            instanceState.attempts = 0;
            instanceState.verified = false;
            instanceState.currentToken = generateToken();
            instanceState.startTime = Date.now();
            instanceState.firstInteractionTime = null;
            instanceState.interactionCount = 0;
            
            instanceState.input.disabled = false;
            instanceState.verifyBtn.disabled = false;
            instanceState.input.style.backgroundColor = '';
            instanceState.input.style.borderColor = CONFIG.colors.border;
            instanceState.verifyBtn.style.background = CONFIG.colors.primary;
            instanceState.verifyBtn.textContent = 'Verify';
            instanceState.input.value = '';
            
            removeTokenFromForm(instanceState);
            generateChallenge(instanceState);
        }
    }

    function generateToken() {
        const array = new Uint8Array(CONFIG.tokenLength);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(array);
        } else {
            for (let i = 0; i < CONFIG.tokenLength; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
        }
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function attachToForms() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const hasCaptcha = form.querySelector('.xsukax-captcha');
            if (hasCaptcha) {
                form.addEventListener('submit', function(e) {
                    const captchasInForm = form.querySelectorAll('.xsukax-captcha');
                    let isVerified = false;
                    
                    captchasInForm.forEach(captchaEl => {
                        const instanceId = captchaEl.id;
                        const instanceState = captchaInstances.get(instanceId);
                        if (instanceState && instanceState.verified) {
                            isVerified = true;
                        }
                    });
                    
                    if (!isVerified) {
                        e.preventDefault();
                        const firstCaptcha = captchasInForm[0];
                        if (firstCaptcha) {
                            const instanceId = firstCaptcha.id;
                            const instanceState = captchaInstances.get(instanceId);
                            if (instanceState) {
                                showStatus(instanceState, '✗ Complete CAPTCHA before submitting.', 'error');
                                instanceState.input.focus();
                            }
                        }
                    }
                });
            }
        });
    }

    function addTokenToForm(instanceState) {
        const form = instanceState.container.closest('form');
        if (form) {
            removeTokenFromForm(instanceState);
            
            const tokenInput = document.createElement('input');
            tokenInput.type = 'hidden';
            tokenInput.name = 'xsukax_captcha_token';
            tokenInput.value = instanceState.currentToken;
            tokenInput.className = 'xsukax-captcha-token';
            
            form.appendChild(tokenInput);
        }
    }

    function removeTokenFromForm(instanceState) {
        const form = instanceState.container.closest('form');
        if (form) {
            const existingToken = form.querySelector('.xsukax-captcha-token');
            if (existingToken) {
                existingToken.remove();
            }
        }
    }

    global.xsukaxCAPTCHA.resetAll = function() {
        captchaInstances.forEach((instanceState, instanceId) => {
            resetCaptcha(instanceId);
        });
    };

    global.xsukaxCAPTCHA.getInstance = function(id) {
        return captchaInstances.get(id);
    };

    global.xsukaxCAPTCHA.isVerified = function(id) {
        const instance = captchaInstances.get(id);
        return instance ? instance.verified : false;
    };

})(typeof window !== 'undefined' ? window : this);
