/**
 * xsukax CAPTCHA v1.0
 * A secure, text-based CAPTCHA solution for bot protection
 * Features: Canvas-based text challenges, automatic initialization, no external dependencies
 * Usage: <script src="xsukax-captcha.js"></script>
 *        <div class="xsukax-captcha"></div>
 */

(function(global) {
    'use strict';
    
    // Configuration
    const CONFIG = {
        canvasWidth: 280,
        canvasHeight: 80,
        codeLength: 6,
        challengeTimeout: 120000, // 2 minutes
        maxAttempts: 3,
        tokenLength: 32,
        fonts: ['Arial', 'Helvetica', 'sans-serif'],
        characters: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Uppercase only, no ambiguous characters
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

    // Global object for CAPTCHA
    global.xsukaxCAPTCHA = {
        version: '1.0.0'
    };

    // Store all CAPTCHA instances
    const captchaInstances = new Map();

    // Auto-initialize when DOM is ready
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
                attempts: 0,
                verified: false,
                startTime: Date.now(),
                container: container
            };

            captchaInstances.set(container.id, instanceState);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'xsukax-captcha-wrapper';
            wrapper.style.cssText = `
                border: 1px solid ${CONFIG.colors.border};
                border-radius: 6px;
                padding: 16px;
                background: ${CONFIG.colors.background};
                font-family: ${CONFIG.fonts.join(', ')};
                max-width: ${CONFIG.canvasWidth + 32}px;
                margin: 12px 0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            `;

            // Header with title and refresh button
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            `;
            
            const title = document.createElement('div');
            title.textContent = 'Security Check';
            title.style.cssText = `
                font-weight: 600;
                color: ${CONFIG.colors.text};
                font-size: 14px;
            `;
            
            const refreshBtn = document.createElement('button');
            refreshBtn.innerHTML = '↻';
            refreshBtn.title = 'Refresh CAPTCHA';
            refreshBtn.type = 'button';
            refreshBtn.style.cssText = `
                background: transparent;
                color: ${CONFIG.colors.primary};
                border: 1px solid ${CONFIG.colors.border};
                border-radius: 4px;
                width: 28px;
                height: 28px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            `;
            refreshBtn.addEventListener('mouseenter', function() {
                this.style.background = CONFIG.colors.primary;
                this.style.color = 'white';
            });
            refreshBtn.addEventListener('mouseleave', function() {
                this.style.background = 'transparent';
                this.style.color = CONFIG.colors.primary;
            });
            refreshBtn.addEventListener('click', function() {
                resetCaptcha(container.id);
            });
            
            header.appendChild(title);
            header.appendChild(refreshBtn);
            wrapper.appendChild(header);

            // Canvas container
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                margin-bottom: 12px;
                position: relative;
            `;
            
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
            `;
            
            canvasContainer.appendChild(canvas);
            wrapper.appendChild(canvasContainer);

            // Input group
            const inputGroup = document.createElement('div');
            inputGroup.style.cssText = `
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
                align-items: stretch;
            `;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Enter code';
            input.style.cssText = `
                flex: 1;
                padding: 8px 12px;
                border: 1px solid ${CONFIG.colors.border};
                border-radius: 4px;
                font-family: ${CONFIG.fonts.join(', ')};
                font-size: 14px;
                transition: border-color 0.2s;
                text-transform: uppercase;
            `;
            
            // Auto-uppercase input
            input.addEventListener('input', function() {
                this.value = this.value.toUpperCase();
            });
            
            input.addEventListener('focus', function() {
                this.style.borderColor = CONFIG.colors.primary;
                this.style.outline = 'none';
            });
            input.addEventListener('blur', function() {
                this.style.borderColor = CONFIG.colors.border;
            });
            
            const verifyBtn = document.createElement('button');
            verifyBtn.textContent = 'Verify';
            verifyBtn.type = 'button';
            verifyBtn.style.cssText = `
                background: ${CONFIG.colors.primary};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 0 16px;
                cursor: pointer;
                font-family: ${CONFIG.fonts.join(', ')};
                font-size: 14px;
                font-weight: 500;
                transition: background-color 0.2s;
                min-width: 80px;
            `;
            verifyBtn.addEventListener('mouseenter', function() {
                if (!this.disabled) {
                    this.style.background = '#1a2530';
                }
            });
            verifyBtn.addEventListener('mouseleave', function() {
                if (!this.disabled) {
                    this.style.background = CONFIG.colors.primary;
                }
            });
            
            inputGroup.appendChild(input);
            inputGroup.appendChild(verifyBtn);
            wrapper.appendChild(inputGroup);

            // Status message area
            const status = document.createElement('div');
            status.className = 'xsukax-captcha-status';
            status.style.cssText = `
                min-height: 18px;
                margin-bottom: 8px;
                font-size: 13px;
                line-height: 1.4;
            `;
            wrapper.appendChild(status);

            // Brand footer - updated to remove italic and make brand bold
            const footer = document.createElement('div');
            footer.style.cssText = `
                text-align: right;
                font-size: 11px;
                color: ${CONFIG.colors.lightText};
                border-top: 1px solid ${CONFIG.colors.border};
                padding-top: 8px;
            `;
            footer.innerHTML = 'Protected by <strong>xsukax CAPTCHA</strong>';
            wrapper.appendChild(footer);

            container.appendChild(wrapper);

            // Store references
            instanceState.canvas = canvas;
            instanceState.ctx = canvas.getContext('2d');
            instanceState.input = input;
            instanceState.verifyBtn = verifyBtn;
            instanceState.status = status;

            generateTextCaptcha(instanceState);

            // Event listeners
            verifyBtn.addEventListener('click', function() {
                verifyCaptcha(instanceState);
            });

            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    verifyCaptcha(instanceState);
                }
            });

            canvas.addEventListener('click', function() {
                resetCaptcha(container.id);
            });

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

    function generateTextCaptcha(instanceState) {
        const { ctx, canvas, status } = instanceState;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Generate uppercase code only
        instanceState.currentCode = '';
        for (let i = 0; i < CONFIG.codeLength; i++) {
            instanceState.currentCode += CONFIG.characters.charAt(
                Math.floor(Math.random() * CONFIG.characters.length)
            );
        }

        drawBackground(ctx, width, height);
        drawTextWithEffects(ctx, instanceState.currentCode, width, height);
        addNoise(ctx, width, height);
        
        status.textContent = 'Please enter the uppercase characters shown in the image above';
        status.style.color = CONFIG.colors.lightText;
    }

    function drawBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#f8f9fa');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.lineWidth = 1;
        
        for (let x = 0; x < width; x += 15) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    function drawTextWithEffects(ctx, text, width, height) {
        const fontSize = Math.min(36, Math.floor(height * 0.6));
        ctx.font = `bold ${fontSize}px ${CONFIG.fonts.join(', ')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(text).width;
        const letterSpacing = 8;
        const totalWidth = textWidth + (letterSpacing * (text.length - 1));
        const startX = (width - totalWidth) / 2;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const x = startX + (ctx.measureText(text.substring(0, i)).width) + (i * letterSpacing) + (ctx.measureText(char).width / 2);
            const y = height / 2 + (Math.random() - 0.5) * 8;
            
            const rotation = (Math.random() - 0.5) * 0.3;
            const hue = Math.floor(Math.random() * 60) + 200;
            ctx.fillStyle = `hsl(${hue}, 70%, 35%)`;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 1;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            ctx.fillText(char, 0, 0);
            ctx.restore();
        }
    }

    function addNoise(ctx, width, height) {
        const dotCount = width * height * 0.005;
        for (let i = 0; i < dotCount; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            const size = Math.random() * 1.5;
            const alpha = Math.random() * 0.2;
            
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillRect(x, y, size, size);
        }
        
        const lineCount = 3;
        for (let i = 0; i < lineCount; i++) {
            const x1 = Math.floor(Math.random() * width);
            const y1 = Math.floor(Math.random() * height);
            const x2 = x1 + Math.floor(Math.random() * 20) - 10;
            const y2 = y1 + Math.floor(Math.random() * 20) - 10;
            const lineWidth = Math.random() * 1;
            const alpha = Math.random() * 0.1;
            
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    function verifyCaptcha(instanceState) {
        const { input, status } = instanceState;
        const userInput = input.value.trim();

        if (!instanceState.currentCode) {
            showStatus(instanceState, 'CAPTCHA not properly initialized. Please refresh.', 'error');
            return;
        }

        if (Date.now() - instanceState.startTime > CONFIG.challengeTimeout) {
            showStatus(instanceState, 'CAPTCHA has expired. Please refresh.', 'error');
            resetCaptcha(instanceState.id);
            return;
        }

        instanceState.attempts++;

        const normalizedInput = userInput.replace(/\s/g, '').toUpperCase();
        const normalizedCode = instanceState.currentCode;

        if (normalizedInput === normalizedCode) {
            // Success
            instanceState.verified = true;
            showStatus(instanceState, '✓ Verification successful! You may now submit the form.', 'success');
            
            input.disabled = true;
            instanceState.verifyBtn.disabled = true;
            input.style.backgroundColor = '#f0fff4';
            input.style.borderColor = CONFIG.colors.success;
            instanceState.verifyBtn.style.background = CONFIG.colors.success;
            instanceState.verifyBtn.textContent = 'Verified';
            
            addTokenToForm(instanceState);
            
        } else {
            // Failure - show detailed error message
            const remaining = CONFIG.maxAttempts - instanceState.attempts;
            
            if (remaining > 0) {
                showStatus(instanceState, `✗ Verification failed. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 'error');
            } else {
                showStatus(instanceState, '✗ Maximum attempts exceeded. Please refresh CAPTCHA.', 'error');
            }
            
            input.value = '';
            input.focus();
            input.style.borderColor = CONFIG.colors.error;
            
            // Reset border color after 2 seconds
            setTimeout(() => {
                if (!instanceState.verified) {
                    input.style.borderColor = CONFIG.colors.border;
                }
            }, 2000);
            
            // Generate new CAPTCHA after failure
            generateTextCaptcha(instanceState);
            
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
        
        // Add appropriate icon based on type
        if (type === 'success') {
            status.innerHTML = '✓ ' + message;
        } else if (type === 'error') {
            status.innerHTML = '✗ ' + message;
        } else {
            status.innerHTML = message;
        }
    }

    function resetCaptcha(instanceId) {
        const instanceState = captchaInstances.get(instanceId);
        if (instanceState) {
            instanceState.attempts = 0;
            instanceState.verified = false;
            instanceState.currentToken = generateToken();
            instanceState.startTime = Date.now();
            
            instanceState.input.disabled = false;
            instanceState.verifyBtn.disabled = false;
            instanceState.input.style.backgroundColor = '';
            instanceState.input.style.borderColor = CONFIG.colors.border;
            instanceState.verifyBtn.style.background = CONFIG.colors.primary;
            instanceState.verifyBtn.textContent = 'Verify';
            instanceState.input.value = '';
            
            removeTokenFromForm(instanceState);
            generateTextCaptcha(instanceState);
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
                                showStatus(instanceState, '✗ Please complete the CAPTCHA verification before submitting.', 'error');
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

})(typeof window !== 'undefined' ? window : this);
