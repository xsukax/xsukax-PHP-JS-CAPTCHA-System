<?php
// captcha.php - Backend API Only
// Requires PHP GD Library

ini_set('session.use_cookies', 1);
ini_set('session.use_only_cookies', 1);
session_start();

// Configuration
define('SALT', 'xsukax_secret_salt_2024_change_this');
define('SITES_FILE', __DIR__ . '/registered_sites.json');
define('CAPTCHA_API_URL', (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['SCRIPT_NAME']) . '/captcha.php');

// Enable CORS for API
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Initialize sites file
if (!file_exists(SITES_FILE)) {
    file_put_contents(SITES_FILE, json_encode([]));
}

// Check GD Library
if (!function_exists('imagecreatetruecolor')) {
    die('ERROR: PHP GD Library is required.');
}

// Generate site ID
function generateSiteID($domain) {
    return substr(hash('sha256', $domain . SALT), 0, 15);
}

// Verify site ID
function verifySiteID($siteId) {
    $sites = json_decode(file_get_contents(SITES_FILE), true);
    return isset($sites[$siteId]) ? $sites[$siteId] : false;
}

// Generate captcha code
function generateCaptchaCode() {
    return substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 6);
}

// Verify domain
function verifyRequestDomain($allowedDomain) {
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    if (empty($referer) && empty($origin)) {
        return false;
    }
    
    $requestDomain = '';
    if (!empty($referer)) {
        $parsed = parse_url($referer);
        $requestDomain = $parsed['host'] ?? '';
    } elseif (!empty($origin)) {
        $parsed = parse_url($origin);
        $requestDomain = $parsed['host'] ?? '';
    }
    
    $requestDomain = preg_replace('/^www\./', '', $requestDomain);
    $allowedDomain = preg_replace('/^www\./', '', $allowedDomain);
    
    if ($requestDomain === $allowedDomain || 
        preg_match('/\.' . preg_quote($allowedDomain, '/') . '$/', $requestDomain)) {
        return true;
    }
    
    return false;
}

// Handle captcha image generation
if (isset($_GET['action']) && $_GET['action'] === 'image' && isset($_GET['site'])) {
    $siteId = $_GET['site'];
    $siteData = verifySiteID($siteId);
    
    if (!$siteData) {
        header('Content-Type: image/png');
        $image = imagecreatetruecolor(200, 60);
        $bg = imagecolorallocate($image, 255, 200, 200);
        $text = imagecolorallocate($image, 150, 0, 0);
        imagefilledrectangle($image, 0, 0, 200, 60, $bg);
        imagestring($image, 3, 30, 25, 'Invalid Site ID', $text);
        imagepng($image);
        imagedestroy($image);
        exit;
    }
    
    if (!verifyRequestDomain($siteData['domain'])) {
        header('Content-Type: image/png');
        $image = imagecreatetruecolor(200, 60);
        $bg = imagecolorallocate($image, 255, 200, 200);
        $text = imagecolorallocate($image, 150, 0, 0);
        imagefilledrectangle($image, 0, 0, 200, 60, $bg);
        imagestring($image, 2, 20, 25, 'Unauthorized Domain', $text);
        imagepng($image);
        imagedestroy($image);
        exit;
    }
    
    $sessionKey = 'captcha_' . $siteId;
    
    if (isset($_GET['refresh']) || !isset($_SESSION[$sessionKey]) || empty($_SESSION[$sessionKey])) {
        $_SESSION[$sessionKey] = generateCaptchaCode();
    }
    
    $code = $_SESSION[$sessionKey];
    
    if (ob_get_level()) {
        ob_end_clean();
    }
    
    header('Content-Type: image/png');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
    
    $width = 200;
    $height = 60;
    $image = imagecreatetruecolor($width, $height);
    
    $bg_color = imagecolorallocate($image, 245, 245, 245);
    $text_colors = [
        imagecolorallocate($image, 50, 50, 50),
        imagecolorallocate($image, 70, 70, 70),
        imagecolorallocate($image, 30, 30, 30)
    ];
    $line_color = imagecolorallocate($image, 200, 200, 200);
    
    imagefilledrectangle($image, 0, 0, $width, $height, $bg_color);
    
    for ($i = 0; $i < 8; $i++) {
        imageline($image, rand(0, $width), rand(0, $height), 
                  rand(0, $width), rand(0, $height), $line_color);
    }
    
    for ($i = 0; $i < 100; $i++) {
        imagesetpixel($image, rand(0, $width), rand(0, $height), $line_color);
    }
    
    $font_size = 5;
    $x_start = 25;
    
    for ($i = 0; $i < strlen($code); $i++) {
        $x = $x_start + ($i * 27) + rand(-4, 4);
        $y = 20 + rand(-5, 5);
        $color = $text_colors[array_rand($text_colors)];
        imagestring($image, $font_size, $x, $y, $code[$i], $color);
    }
    
    imagepng($image);
    imagedestroy($image);
    exit;
}

// Handle site registration
if (isset($_POST['action']) && $_POST['action'] === 'register') {
    header('Content-Type: application/json');
    
    $domain = trim($_POST['domain'] ?? '');
    
    if (empty($domain)) {
        echo json_encode(['success' => false, 'message' => 'Domain is required']);
        exit;
    }
    
    $siteId = generateSiteID($domain);
    
    $sites = json_decode(file_get_contents(SITES_FILE), true) ?? [];
    
    $sites[$siteId] = [
        'domain' => $domain,
        'created' => date('Y-m-d H:i:s'),
        'last_used' => null
    ];
    
    file_put_contents(SITES_FILE, json_encode($sites, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true, 
        'siteId' => $siteId, 
        'domain' => $domain,
        'jsUrl' => dirname(CAPTCHA_API_URL) . '/captcha.js?site=' . $siteId
    ]);
    exit;
}

// Handle captcha verification
if (isset($_POST['action']) && $_POST['action'] === 'verify') {
    header('Content-Type: application/json');
    
    $siteId = $_POST['site_id'] ?? '';
    $userCode = strtoupper(trim($_POST['captcha_code'] ?? ''));
    
    $siteData = verifySiteID($siteId);
    
    if (!$siteData) {
        echo json_encode(['success' => false, 'message' => 'Invalid site ID']);
        exit;
    }
    
    if (!verifyRequestDomain($siteData['domain'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized domain']);
        exit;
    }
    
    $sessionKey = 'captcha_' . $siteId;
    $sessionCode = $_SESSION[$sessionKey] ?? '';
    
    if ($userCode === $sessionCode) {
        $_SESSION[$sessionKey] = generateCaptchaCode();
        echo json_encode(['success' => true, 'message' => 'CAPTCHA verified successfully']);
    } else {
        $_SESSION[$sessionKey] = generateCaptchaCode();
        echo json_encode(['success' => false, 'message' => 'Invalid CAPTCHA code']);
    }
    exit;
}

// Handle site info request
if (isset($_GET['action']) && $_GET['action'] === 'info' && isset($_GET['site'])) {
    header('Content-Type: application/json');
    
    $siteId = $_GET['site'];
    $siteData = verifySiteID($siteId);
    
    if (!$siteData) {
        echo json_encode(['success' => false, 'message' => 'Invalid site ID']);
        exit;
    }
    
    if (!verifyRequestDomain($siteData['domain'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized domain']);
        exit;
    }
    
    echo json_encode([
        'success' => true,
        'domain' => $siteData['domain'],
        'apiUrl' => CAPTCHA_API_URL
    ]);
    exit;
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>xsukax PHP JS CAPTCHA System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; 
                 overflow: auto; background-color: rgba(0, 0, 0, 0.5); animation: fadeIn 0.3s; }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        .modal-content { background-color: white; padding: 0; border-radius: 8px; max-width: 800px; 
                        width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .notification { position: fixed; top: 20px; right: 20px; background-color: #10b981; color: white; 
                       padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                       z-index: 2000; display: none; }
        .notification.active { display: block; animation: slideInRight 0.3s; }
        @keyframes slideInRight { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .code-block { background-color: #f6f8fa; border: 1px solid #d1d5da; border-radius: 6px; 
                     padding: 16px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 14px; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="notification" id="notification">
        <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span id="notificationText"></span>
        </div>
    </div>

    <div id="docModal" class="modal">
        <div class="modal-content">
            <div class="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0">
                <h2 class="text-2xl font-semibold text-gray-800">Documentation</h2>
                <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div class="p-6">
                <div class="space-y-6">
                    <section>
                        <h3 class="text-xl font-semibold text-gray-800 mb-3">Integration Steps</h3>
                        <ol class="list-decimal list-inside space-y-2 text-gray-600">
                            <li>Register your domain below</li>
                            <li>Copy the script tag provided</li>
                            <li>Add it to your HTML file</li>
                            <li>Add <code class="bg-gray-100 px-2 py-1 rounded">&lt;div class="xsukax-captcha"&gt;&lt;/div&gt;</code> in your form</li>
                            <li>Use JavaScript to verify</li>
                        </ol>
                    </section>
                    <section>
                        <h3 class="text-xl font-semibold text-gray-800 mb-3">Example Usage</h3>
                        <div class="code-block">
&lt;script src="https://yoursite.com/captcha.js?site=YOUR_SITE_ID"&gt;&lt;/script&gt;

&lt;form id="myForm"&gt;
    &lt;input type="text" name="name" required&gt;
    &lt;div class="xsukax-captcha"&gt;&lt;/div&gt;
    &lt;button type="submit"&gt;Submit&lt;/button&gt;
&lt;/form&gt;

&lt;script&gt;
document.getElementById('myForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var code = xsukaxCaptcha.getCaptchaValue();
    xsukaxCaptcha.verify(code, function(result) {
        if (result.success) {
            alert('Success!');
        } else {
            alert('Invalid CAPTCHA');
        }
    });
});
&lt;/script&gt;
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </div>

    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="flex justify-between items-center mb-8">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">xsukax PHP JS CAPTCHA System</h1>
                <p class="text-gray-600 mt-2">JavaScript Library + PHP Backend API</p>
            </div>
            <button onclick="openModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition">
                Documentation
            </button>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Register Your Site</h2>
            <div class="mb-4">
                <label for="domain" class="block text-sm font-medium text-gray-700 mb-2">
                    Domain Name <span class="text-red-500">*</span>
                </label>
                <input type="text" id="domain" placeholder="example.com" 
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <button onclick="registerSite()" class="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition">
                Register & Generate Code
            </button>
        </div>

        <div id="codeSection" style="display: none;" class="bg-white rounded-lg shadow-md p-6">
            <div class="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <p class="text-green-800 mb-2"><strong>✓ Registration Successful!</strong></p>
                <p class="text-sm text-green-700">Domain: <strong id="registeredDomain"></strong></p>
                <p class="text-sm text-green-700">Site ID: <strong id="siteIdDisplay"></strong></p>
            </div>
            <div class="mb-4">
                <h3 class="font-semibold text-gray-800 mb-2">Your Script Tag:</h3>
                <div class="code-block mb-2" id="scriptCode"></div>
                <button onclick="copyScript()" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
                    Copy Code
                </button>
            </div>
        </div>
    </div>

    <script>
        function openModal() { document.getElementById('docModal').classList.add('active'); }
        function closeModal() { document.getElementById('docModal').classList.remove('active'); }
        function showNotification(msg) {
            var n = document.getElementById('notification');
            document.getElementById('notificationText').textContent = msg;
            n.classList.add('active');
            setTimeout(function() { n.classList.remove('active'); }, 3000);
        }
        function registerSite() {
            var domain = document.getElementById('domain').value.trim();
            if (!domain) { alert('Please enter your domain'); return; }
            
            var formData = new FormData();
            formData.append('action', 'register');
            formData.append('domain', domain);
            
            fetch('', { method: 'POST', body: formData })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    document.getElementById('registeredDomain').textContent = data.domain;
                    document.getElementById('siteIdDisplay').textContent = data.siteId;
                    document.getElementById('scriptCode').textContent = '<script src="' + data.jsUrl + '"><\/script>';
                    document.getElementById('codeSection').style.display = 'block';
                    showNotification('Site registered!');
                }
            });
        }
        function copyScript() {
            navigator.clipboard.writeText(document.getElementById('scriptCode').textContent)
            .then(function() { showNotification('Copied!'); });
        }
        window.onclick = function(e) {
            if (e.target === document.getElementById('docModal')) closeModal();
        };
    </script>
</body>
</html>