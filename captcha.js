// captcha.js - xsukax CAPTCHA Client Library
// Usage: <script src="captcha.js?site=YOUR_SITE_ID"></script>

(function() {
    'use strict';
    
    // Get site ID from script URL
    var scripts = document.getElementsByTagName('script');
    var currentScript = scripts[scripts.length - 1];
    var scriptSrc = currentScript.src;
    var urlParams = new URLSearchParams(scriptSrc.split('?')[1] || '');
    var siteId = urlParams.get('site');
    
    if (!siteId) {
        console.error('xsukax CAPTCHA: Site ID not provided in script URL');
        return;
    }
    
    // Get API URL from script location
    var apiUrl = scriptSrc.substring(0, scriptSrc.lastIndexOf('/')) + '/captcha.php';
    
    // Create CAPTCHA widget
    function createCaptchaWidget(container) {
        container.innerHTML = '';
        
        var widget = document.createElement('div');
        widget.className = 'xsukax-captcha-widget';
        widget.style.cssText = 'background: #f9f9f9; border: 1px solid #d3d3d3; border-radius: 4px; padding: 16px; max-width: 320px; font-family: Arial, sans-serif;';
        
        var label = document.createElement('div');
        label.style.cssText = 'font-size: 14px; color: #555; margin-bottom: 8px; font-weight: 500;';
        label.textContent = 'Security Check';
        
        var imageContainer = document.createElement('div');
        imageContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        
        var img = document.createElement('img');
        img.src = apiUrl + '?action=image&site=' + siteId + '&refresh=1&t=' + Date.now();
        img.alt = 'CAPTCHA';
        img.style.cssText = 'border: 1px solid #ccc; border-radius: 3px; background: white; display: block;';
        
        var refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '&#8635;';
        refreshBtn.type = 'button';
        refreshBtn.style.cssText = 'background: #4CAF50; color: white; border: none; border-radius: 3px; padding: 8px 12px; cursor: pointer; font-size: 18px; min-width: 40px;';
        refreshBtn.title = 'Refresh CAPTCHA';
        refreshBtn.onclick = function(e) {
            e.preventDefault();
            img.src = apiUrl + '?action=image&site=' + siteId + '&refresh=1&t=' + Date.now();
        };
        
        imageContainer.appendChild(img);
        imageContainer.appendChild(refreshBtn);
        
        var input = document.createElement('input');
        input.type = 'text';
        input.name = 'xsukax_captcha';
        input.placeholder = 'Enter code above';
        input.required = true;
        input.autocomplete = 'off';
        input.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 14px; box-sizing: border-box; text-transform: uppercase;';
        input.className = 'xsukax-captcha-input';
        
        input.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
        });
        
        var hiddenSite = document.createElement('input');
        hiddenSite.type = 'hidden';
        hiddenSite.name = 'xsukax_site_id';
        hiddenSite.value = siteId;
        hiddenSite.className = 'xsukax-site-id';
        
        var branding = document.createElement('div');
        branding.style.cssText = 'margin-top: 8px; font-size: 11px; color: #999; text-align: right;';
        branding.innerHTML = 'Protected by <strong>xsukax CAPTCHA</strong>';
        
        widget.appendChild(label);
        widget.appendChild(imageContainer);
        widget.appendChild(input);
        widget.appendChild(hiddenSite);
        widget.appendChild(branding);
        
        container.appendChild(widget);
    }
    
    // Initialize CAPTCHA widgets
    function initCaptcha() {
        var containers = document.querySelectorAll('.xsukax-captcha');
        containers.forEach(function(container) {
            if (!container.querySelector('.xsukax-captcha-widget')) {
                createCaptchaWidget(container);
            }
        });
    }
    
    // Verify CAPTCHA via API
    function verifyCaptcha(captchaCode, callback) {
        var formData = new FormData();
        formData.append('action', 'verify');
        formData.append('site_id', siteId);
        formData.append('captcha_code', captchaCode);
        
        fetch(apiUrl, {
            method: 'POST',
            body: formData
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            callback(data);
        })
        .catch(function(error) {
            callback({ success: false, message: 'Network error: ' + error.message });
        });
    }
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCaptcha);
    } else {
        initCaptcha();
    }
    
    // Global API
    window.xsukaxCaptcha = {
        /**
         * Manually render CAPTCHA in a specific element
         * @param {string} elementId - ID of the container element
         */
        render: function(elementId) {
            var container = document.getElementById(elementId);
            if (container) {
                createCaptchaWidget(container);
            } else {
                console.error('xsukax CAPTCHA: Element not found: ' + elementId);
            }
        },
        
        /**
         * Verify CAPTCHA code
         * @param {string} captchaCode - The CAPTCHA code entered by user
         * @param {function} callback - Callback function(result)
         */
        verify: function(captchaCode, callback) {
            verifyCaptcha(captchaCode, callback);
        },
        
        /**
         * Get the current CAPTCHA input value
         * @returns {string} The CAPTCHA code entered by user
         */
        getCaptchaValue: function() {
            var input = document.querySelector('.xsukax-captcha-input');
            return input ? input.value.toUpperCase() : '';
        },
        
        /**
         * Get the site ID
         * @returns {string} The site ID
         */
        getSiteId: function() {
            return siteId;
        },
        
        /**
         * Get the API URL
         * @returns {string} The API URL
         */
        getApiUrl: function() {
            return apiUrl;
        }
    };
    
    console.log('xsukax CAPTCHA loaded for site:', siteId);
})();