<?php
error_reporting(E_ALL & ~E_DEPRECATED);

require __DIR__ . '/vendor/autoload.php';

use Workerman\Worker;
use Workerman\Protocols\Http\Response;
use Workerman\Protocols\Http\Request;
use Workerman\Connection\TcpConnection;
use PHPSocketIO\SocketIO;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// ---------------------------------------------------------------------------
// Database helper
// ---------------------------------------------------------------------------
function requiredEnv(string $name): string {
    $value = trim((string) getenv($name));
    if ($value === '') {
        throw new RuntimeException("$name must be set.");
    }
    return $value;
}

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $host = requiredEnv('DB_HOST');
        $port = requiredEnv('DB_PORT');
        $db   = requiredEnv('DB_NAME');
        $user = requiredEnv('DB_USER');
        $pass = requiredEnv('DB_PASS');
        $dsn  = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
        $pdo  = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function getJWTSecret(): string {
    $secret = requiredEnv('JWT_SECRET');
    if ($secret === 'chatapp_dev_secret_key_change_in_production') {
        throw new RuntimeException('JWT_SECRET must be set to a strong, non-default value.');
    }
    if (strlen($secret) < 32) {
        throw new RuntimeException('JWT_SECRET must be at least 32 characters long.');
    }
    return $secret;
}

function validateRuntimeConfig(): void {
    foreach (['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS'] as $name) {
        requiredEnv($name);
    }
    getJWTSecret();
}

function createJWT(int $userId): string {
    $payload = [
        'userId' => $userId,
        'iat'    => time(),
        'exp'    => time() + (30 * 24 * 60 * 60), // 30 days
    ];
    return JWT::encode($payload, getJWTSecret(), 'HS256');
}

function verifyJWT(string $token): ?array {
    try {
        $decoded = JWT::decode($token, new Key(getJWTSecret(), 'HS256'));
        return (array) $decoded;
    } catch (\Exception $e) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// HTTP helpers (Workerman inner HTTP Worker)
// ---------------------------------------------------------------------------
function authenticateHTTP(Request $request): ?int {
    $auth = $request->header('authorization') ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        return null;
    }
    $payload = verifyJWT($m[1]);
    return isset($payload['userId']) ? (int) $payload['userId'] : null;
}

function corsOrigin(): string {
    $origin = trim((string) getenv('CORS_ALLOW_ORIGIN'));
    return $origin !== '' ? $origin : '*';
}

function corsHeaders(array $headers = []): array {
    return array_merge([
        'Access-Control-Allow-Origin'  => corsOrigin(),
        'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
    ], $headers);
}

function jsonResponse(int $status, array $data): Response {
    return new Response($status, corsHeaders([
        'Content-Type' => 'application/json',
    ]), json_encode($data));
}

function corsResponse(): Response {
    return new Response(204, corsHeaders([
        'Content-Type' => 'text/plain',
    ]), '');
}

function getMimeTypeForExtension(string $ext): string {
    $map = [
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp',
        'mp4'  => 'video/mp4',
        'm4a'  => 'audio/m4a',
        'aac'  => 'audio/aac',
        'opus' => 'audio/opus',
        'pdf'  => 'application/pdf',
        'doc'  => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    return $map[strtolower($ext)] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Email verification helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically-random 6-digit numeric verification code.
 */
function generateVerificationCode(): string {
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

/**
 * Send a transactional email via the Brevo (ex-Sendinblue) HTTP API.
 * Returns true on success, false otherwise. Errors are logged but not thrown
 * so a mail-delivery glitch never leaks into the caller's HTTP response as a
 * 500. When BREVO_API_KEY is unset we skip the network call and just log the
 * code — useful for local development.
 */
function sendVerificationEmail(string $toEmail, string $code): bool {
    $apiKey = getenv('BREVO_API_KEY') ?: '';
    if ($apiKey === '') {
        error_log("[brevo] BREVO_API_KEY not set; verification code for $toEmail is $code");
        return true; // dev-mode: treat as success
    }

    $senderEmail = getenv('BREVO_SENDER_EMAIL') ?: 'no-reply@chatapp.local';
    $senderName  = getenv('BREVO_SENDER_NAME')  ?: 'ChatApp';

    $payload = [
        'sender'      => ['name' => $senderName, 'email' => $senderEmail],
        'to'          => [['email' => $toEmail]],
        'subject'     => 'Your ChatApp verification code',
        'htmlContent' =>
            '<div style="font-family:Arial,sans-serif;color:#111">'
            . '<h2>Confirm your email</h2>'
            . '<p>Your ChatApp verification code is:</p>'
            . '<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#00A884">'
            . htmlspecialchars($code, ENT_QUOTES, 'UTF-8')
            . '</p>'
            . '<p>This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>'
            . '</div>',
        'textContent' =>
            "Your ChatApp verification code is: $code\n"
            . "This code expires in 15 minutes.\n",
    ];

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_HTTPHEADER     => [
            'accept: application/json',
            'content-type: application/json',
            'api-key: ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload),
    ]);
    $response = curl_exec($ch);
    $status   = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err      = curl_error($ch);
    curl_close($ch);

    if ($status >= 200 && $status < 300) {
        return true;
    }

    error_log("[brevo] send failed status=$status err=$err body=" . (string) $response);
    return false;
}

/**
 * Store (or replace) a verification code for a user and return the plain code
 * so the caller can email it. Codes expire after 15 minutes.
 */
function issueVerificationCode(PDO $db, int $userId): string {
    $code    = generateVerificationCode();
    $expires = gmdate('Y-m-d H:i:s', time() + (15 * 60));
    $stmt    = $db->prepare(
        'UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?'
    );
    $stmt->execute([$code, $expires, $userId]);
    return $code;
}

// ---------------------------------------------------------------------------
// HTTP route handler (for Workerman inner HTTP Worker)
// ---------------------------------------------------------------------------
function handleRequest(TcpConnection $connection, Request $request): void {
    $method = $request->method();
    $path   = $request->path();

    // CORS preflight
    if ($method === 'OPTIONS') {
        $connection->send(corsResponse());
        return;
    }

    try {
        // =================================================================
        // POST /auth/register
        // Creates an unverified user (or refreshes the code if they already
        // started registration but never confirmed), emails a 6-digit code
        // via Brevo, and responds with { pendingVerification: true, email }.
        // =================================================================
        if ($method === 'POST' && $path === '/auth/register') {
            $data     = json_decode($request->rawBody(), true);
            $email    = strtolower(trim($data['email'] ?? ''));
            $password = $data['password'] ?? '';

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $connection->send(jsonResponse(400, ['error' => 'Invalid email format']));
                return;
            }
            if (strlen($password) < 6) {
                $connection->send(jsonResponse(400, ['error' => 'Password must be at least 6 characters']));
                return;
            }

            $db   = getDB();
            $stmt = $db->prepare('SELECT id, email_verified FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $existing = $stmt->fetch();

            if ($existing && (int) $existing['email_verified'] === 1) {
                $connection->send(jsonResponse(400, ['error' => 'Email already registered']));
                return;
            }

            $hash = password_hash($password, PASSWORD_BCRYPT);
            if ($existing) {
                // Send the verification email BEFORE overwriting the stored
                // password — otherwise a Brevo outage could leave a pending
                // user with a new password but no way to confirm it.
                $userId  = (int) $existing['id'];
                $code    = generateVerificationCode();
                if (!sendVerificationEmail($email, $code)) {
                    $connection->send(jsonResponse(502, [
                        'error' => 'Failed to send verification email. Please try again shortly.',
                    ]));
                    return;
                }
                $expires = gmdate('Y-m-d H:i:s', time() + (15 * 60));
                $stmt = $db->prepare(
                    'UPDATE users SET password = ?, verification_code = ?, verification_expires_at = ? WHERE id = ?'
                );
                $stmt->execute([$hash, $code, $expires, $userId]);
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO users (email, password, email_verified) VALUES (?, ?, 0)'
                );
                $stmt->execute([$email, $hash]);
                $userId = (int) $db->lastInsertId();

                $code = issueVerificationCode($db, $userId);
                if (!sendVerificationEmail($email, $code)) {
                    $connection->send(jsonResponse(502, [
                        'error' => 'Failed to send verification email. Please try again shortly.',
                    ]));
                    return;
                }
            }

            $connection->send(jsonResponse(201, [
                'pendingVerification' => true,
                'email'               => $email,
            ]));
            return;
        }

        // =================================================================
        // POST /auth/verify-email
        // Body: { email, code }. On success marks the user as verified and
        // returns { token, user } to log them in.
        // =================================================================
        if ($method === 'POST' && $path === '/auth/verify-email') {
            $data  = json_decode($request->rawBody(), true);
            $email = strtolower(trim($data['email'] ?? ''));
            $code  = trim((string) ($data['code'] ?? ''));

            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $code)) {
                $connection->send(jsonResponse(400, ['error' => 'Invalid email or code']));
                return;
            }

            $db   = getDB();
            $stmt = $db->prepare(
                'SELECT id, email, email_verified, verification_code, verification_expires_at
                 FROM users WHERE email = ?'
            );
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if (!$user) {
                $connection->send(jsonResponse(400, ['error' => 'Invalid email or code']));
                return;
            }
            if ((int) $user['email_verified'] === 1) {
                $connection->send(jsonResponse(400, ['error' => 'Email is already verified']));
                return;
            }
            if (!$user['verification_code'] || !$user['verification_expires_at']) {
                $connection->send(jsonResponse(400, ['error' => 'No verification code on file. Please request a new one.']));
                return;
            }
            // verification_expires_at is written with gmdate() (no tz suffix),
            // so append " UTC" before parsing to avoid the server's
            // local-timezone interpretation.
            if (strtotime($user['verification_expires_at'] . ' UTC') < time()) {
                $connection->send(jsonResponse(400, ['error' => 'Verification code has expired. Please request a new one.']));
                return;
            }
            if (!hash_equals((string) $user['verification_code'], $code)) {
                $connection->send(jsonResponse(400, ['error' => 'Incorrect verification code']));
                return;
            }

            $stmt = $db->prepare(
                'UPDATE users SET email_verified = 1, verification_code = NULL, verification_expires_at = NULL WHERE id = ?'
            );
            $stmt->execute([$user['id']]);

            $connection->send(jsonResponse(200, [
                'token' => createJWT((int) $user['id']),
                'user'  => ['id' => (int) $user['id'], 'email' => $user['email']],
            ]));
            return;
        }

        // =================================================================
        // POST /auth/resend-verification
        // Body: { email }. Regenerates the code and re-sends the email.
        // Always returns { ok: true } so we don't leak whether an address
        // exists in our database.
        // =================================================================
        if ($method === 'POST' && $path === '/auth/resend-verification') {
            $data  = json_decode($request->rawBody(), true);
            $email = strtolower(trim($data['email'] ?? ''));

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $connection->send(jsonResponse(400, ['error' => 'Invalid email format']));
                return;
            }

            $db   = getDB();
            $stmt = $db->prepare('SELECT id, email_verified FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if ($user && (int) $user['email_verified'] === 0) {
                $code = issueVerificationCode($db, (int) $user['id']);
                sendVerificationEmail($email, $code);
            }

            $connection->send(jsonResponse(200, ['ok' => true]));
            return;
        }

        // =================================================================
        // POST /auth/login
        // =================================================================
        if ($method === 'POST' && $path === '/auth/login') {
            $data     = json_decode($request->rawBody(), true);
            $email    = strtolower(trim($data['email'] ?? ''));
            $password = $data['password'] ?? '';

            if ($email === '' || $password === '') {
                $connection->send(jsonResponse(400, ['error' => 'Email and password are required']));
                return;
            }

            $db   = getDB();
            $stmt = $db->prepare('SELECT id, email, password, email_verified FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password'])) {
                $connection->send(jsonResponse(401, ['error' => 'Invalid email or password']));
                return;
            }

            if ((int) $user['email_verified'] === 0) {
                // Auto-resend a fresh code so the frontend can route straight
                // into the verify screen without a separate user action.
                $code = issueVerificationCode($db, (int) $user['id']);
                sendVerificationEmail($email, $code);

                $connection->send(jsonResponse(200, [
                    'pendingVerification' => true,
                    'email'               => $user['email'],
                ]));
                return;
            }

            $connection->send(jsonResponse(200, [
                'token' => createJWT((int) $user['id']),
                'user'  => ['id' => (int) $user['id'], 'email' => $user['email']],
            ]));
            return;
        }

        // =================================================================
        // GET /users/search?email=...
        // =================================================================
        if ($method === 'GET' && $path === '/users/search') {
            $userId = authenticateHTTP($request);
            if (!$userId) {
                $connection->send(jsonResponse(401, ['error' => 'Unauthorized']));
                return;
            }
            $email = trim($request->get('email') ?? '');
            if ($email === '') {
                $connection->send(jsonResponse(200, ['users' => []]));
                return;
            }
            $db   = getDB();
            $stmt = $db->prepare('SELECT id, email FROM users WHERE email LIKE ? AND id != ? LIMIT 20');
            $stmt->execute(['%' . $email . '%', $userId]);
            $users = $stmt->fetchAll();
            $connection->send(jsonResponse(200, ['users' => $users]));
            return;
        }

        // =================================================================
        // GET /conversations
        // =================================================================
        if ($method === 'GET' && $path === '/conversations') {
            $userId = authenticateHTTP($request);
            if (!$userId) {
                $connection->send(jsonResponse(401, ['error' => 'Unauthorized']));
                return;
            }
            $db  = getDB();
            $sql = '
                SELECT
                    partner.id   AS userId,
                    partner.email,
                    m.content    AS lastMessage,
                    m.type       AS lastMessageType,
                    m.created_at AS lastMessageAt
                FROM (
                    SELECT
                        CASE WHEN from_user = ? THEN to_user ELSE from_user END AS partner_id,
                        MAX(id) AS max_id
                    FROM messages
                    WHERE from_user = ? OR to_user = ?
                    GROUP BY partner_id
                ) AS latest
                JOIN messages m       ON m.id = latest.max_id
                JOIN users   partner  ON partner.id = latest.partner_id
                ORDER BY m.created_at DESC
            ';
            $stmt = $db->prepare($sql);
            $stmt->execute([$userId, $userId, $userId]);
            $conversations = $stmt->fetchAll();
            $connection->send(jsonResponse(200, ['conversations' => $conversations]));
            return;
        }

        // =================================================================
        // GET /messages?userId=...&before=...&limit=30
        // =================================================================
        if ($method === 'GET' && $path === '/messages') {
            $myId = authenticateHTTP($request);
            if (!$myId) {
                $connection->send(jsonResponse(401, ['error' => 'Unauthorized']));
                return;
            }
            $partnerId = (int) ($request->get('userId') ?? 0);
            if ($partnerId <= 0) {
                $connection->send(jsonResponse(400, ['error' => 'userId is required']));
                return;
            }
            $limit  = min(max((int) ($request->get('limit') ?? 30), 1), 50);
            $before = (int) ($request->get('before') ?? 0);

            $db     = getDB();
            $sql    = 'SELECT id, from_user AS `from`, to_user AS `to`, type, content, media_url AS mediaUrl, thumbnail, mime_type AS mimeType, file_name AS fileName, file_size AS fileSize, created_at AS createdAt FROM messages WHERE ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))';
            $params = [$myId, $partnerId, $partnerId, $myId];
            if ($before > 0) {
                $sql .= ' AND id < ?';
                $params[] = $before;
            }
            $sql .= ' ORDER BY created_at DESC LIMIT ' . $limit;

            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $messages = $stmt->fetchAll();
            foreach ($messages as &$msg) {
                $msg['id']       = (int) $msg['id'];
                $msg['from']     = (int) $msg['from'];
                $msg['to']       = (int) $msg['to'];
                $msg['fileSize'] = $msg['fileSize'] !== null ? (int) $msg['fileSize'] : null;
            }
            unset($msg);
            $connection->send(jsonResponse(200, ['messages' => $messages]));
            return;
        }

        // =================================================================
        // POST /media/upload
        // =================================================================
        if ($method === 'POST' && $path === '/media/upload') {
            $userId = authenticateHTTP($request);
            if (!$userId) {
                $connection->send(jsonResponse(401, ['error' => 'Unauthorized']));
                return;
            }

            $files = $request->file('file');
            if (!$files || !isset($files['tmp_name']) || ($files['error'] ?? 1) !== UPLOAD_ERR_OK) {
                $connection->send(jsonResponse(400, ['error' => 'Missing or invalid file']));
                return;
            }

            $tmpPath      = $files['tmp_name'];
            $originalName = basename($files['name'] ?? 'upload');
            $clientMime   = $files['type'] ?? '';
            $mimeType     = $clientMime;
            if (function_exists('finfo_open')) {
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                if ($finfo) {
                    $detectedMime = finfo_file($finfo, $tmpPath);
                    finfo_close($finfo);
                    if (is_string($detectedMime) && $detectedMime !== '') {
                        $mimeType = $detectedMime;
                    }
                }
            }
            $fileSize     = $files['size'] ?? 0;

            $maxSize = 20 * 1024 * 1024; // 20 MB
            if ($fileSize > $maxSize) {
                $connection->send(jsonResponse(413, ['error' => 'File too large, max 20 MB']));
                return;
            }

            $allowedMimes = [
                'image/jpeg', 'image/png', 'image/webp',
                'video/mp4',
                'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/opus',
                'application/pdf', 'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ];
            if (!in_array($mimeType, $allowedMimes, true)) {
                $connection->send(jsonResponse(400, ['error' => 'Invalid file type: ' . $mimeType]));
                return;
            }

            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            if ($ext === '') {
                $connection->send(jsonResponse(400, ['error' => 'File must have an extension']));
                return;
            }

            $uuid      = bin2hex(random_bytes(16));
            $savedName = $uuid . '.' . $ext;
            $savePath  = '/app/uploads/' . $savedName;

            if (!rename($tmpPath, $savePath)) {
                $connection->send(jsonResponse(500, ['error' => 'Failed to save file']));
                return;
            }

            $connection->send(jsonResponse(201, [
                'url'      => '/media/' . $savedName,
                'filename' => $originalName,
                'mimeType' => $mimeType,
                'size'     => $fileSize,
            ]));
            return;
        }

        // =================================================================
        // GET /media/:filename
        // =================================================================
        if ($method === 'GET' && strpos($path, '/media/') === 0) {
            $filename = basename(substr($path, 7));
            if ($filename === '' || str_contains($filename, '..')) {
                $connection->send(jsonResponse(400, ['error' => 'Invalid filename']));
                return;
            }

            $filePath = '/app/uploads/' . $filename;
            if (!is_file($filePath)) {
                $connection->send(jsonResponse(404, ['error' => 'File not found']));
                return;
            }

            $ext         = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $mime        = getMimeTypeForExtension($ext);
            $fileContent = file_get_contents($filePath);

            $connection->send(new Response(200, [
                'Content-Type'                => $mime,
                'Cache-Control'               => 'public, max-age=86400',
                'Access-Control-Allow-Origin' => corsOrigin(),
            ], $fileContent));
            return;
        }

        // =================================================================
        // Health check
        // =================================================================
        if ($path === '/health') {
            $connection->send(jsonResponse(200, ['status' => 'ok']));
            return;
        }

        $connection->send(jsonResponse(404, ['error' => 'Not found']));

    } catch (\PDOException $e) {
        error_log('DB error: ' . $e->getMessage());
        $connection->send(jsonResponse(500, ['error' => 'Internal server error']));
    } catch (\Exception $e) {
        error_log('Error: ' . $e->getMessage());
        $connection->send(jsonResponse(500, ['error' => 'Internal server error']));
    }
}

// ---------------------------------------------------------------------------
// Online users map: userId => $socket
// ---------------------------------------------------------------------------
validateRuntimeConfig();

$onlineUsers = [];

// ---------------------------------------------------------------------------
// SocketIO server on port 5100 (WebSocket only)
// ---------------------------------------------------------------------------
$io = new SocketIO(5100);

// ---------------------------------------------------------------------------
// WebSocket events
// ---------------------------------------------------------------------------
$io->on('connection', function ($socket) use ($io, &$onlineUsers) {
    echo "New socket connected: {$socket->id}\n";

    $socket->on('authenticate', function ($data) use ($socket, $io, &$onlineUsers) {
        $token = $data['token'] ?? '';
        if (!is_string($token) || $token === '') {
            $socket->emit('auth_error', ['message' => 'Invalid token']);
            return;
        }
        $payload = verifyJWT($token);
        if (!$payload || !isset($payload['userId'])) {
            $socket->emit('auth_error', ['message' => 'Invalid token']);
            return;
        }
        $userId = (int) $payload['userId'];
        $socket->userId = $userId;
        $onlineUsers[$userId] = $socket;

        // Store email for call signaling
        try {
            $db_auth = getDB();
            $stmt_auth = $db_auth->prepare('SELECT email FROM users WHERE id = ?');
            $stmt_auth->execute([$userId]);
            $row_auth = $stmt_auth->fetch();
            $socket->userEmail = $row_auth ? $row_auth['email'] : '';
        } catch (\Exception $e) {
            $socket->userEmail = '';
        }

        $socket->emit('authenticated', ['userId' => $userId]);

        foreach ($onlineUsers as $uid => $sock) {
            if ($uid !== $userId) {
                $sock->emit('user_online', ['userId' => $userId]);
            }
        }
        echo "User $userId authenticated\n";
    });

    $socket->on('send_message', function ($data) use ($socket, $io, &$onlineUsers) {
        if (!isset($socket->userId)) {
            $socket->emit('error', ['message' => 'Not authenticated']);
            return;
        }
        $userId    = (int) $socket->userId;
        $to        = isset($data['to']) ? (int) $data['to'] : 0;
        $type      = $data['type'] ?? 'text';
        $content   = $data['content'] ?? null;
        $localId   = $data['localId'] ?? null;
        $thumbnail = $data['thumbnail'] ?? null;
        $mediaUrl  = $data['mediaUrl'] ?? null;
        $mimeType  = $data['mimeType'] ?? null;
        $fileName  = $data['fileName'] ?? null;
        $fileSize  = isset($data['fileSize']) ? (int) $data['fileSize'] : null;

        $validTypes = ['text', 'image', 'video', 'voice', 'file'];
        if (!is_string($type) || !in_array($type, $validTypes, true)) {
            $socket->emit('error', ['message' => 'Invalid message type']);
            return;
        }
        if ($to <= 0 || $to === $userId) {
            $socket->emit('error', ['message' => 'Invalid recipient']);
            return;
        }
        if ($type === 'text' && (!is_string($content) || trim($content) === '')) {
            $socket->emit('error', ['message' => 'Content cannot be empty']);
            return;
        }
        if ($type === 'text' && strlen($content) > 4096) {
            $socket->emit('error', ['message' => 'Content is too long']);
            return;
        }
        if ($type !== 'text' && $content !== null && !is_string($content)) {
            $content = null;
        }

        try {
            $db = getDB();

            $stmt = $db->prepare('SELECT id FROM users WHERE id = ?');
            $stmt->execute([$to]);
            if (!$stmt->fetch()) {
                $socket->emit('error', ['message' => 'Recipient not found']);
                return;
            }

            $stmt = $db->prepare(
                'INSERT INTO messages (from_user, to_user, type, content, media_url, thumbnail, mime_type, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([$userId, $to, $type, $content, $mediaUrl, $thumbnail, $mimeType, $fileName, $fileSize]);
            $msgId = (int) $db->lastInsertId();

            $stmt = $db->prepare('SELECT created_at FROM messages WHERE id = ?');
            $stmt->execute([$msgId]);
            $createdAt = $stmt->fetchColumn();

            $socket->emit('message_sent', [
                'id'        => $msgId,
                'localId'   => $localId,
                'createdAt' => $createdAt,
            ]);

            $msgObj = [
                'id'        => $msgId,
                'from'      => $userId,
                'to'        => $to,
                'type'      => $type,
                'content'   => $content,
                'mediaUrl'  => $mediaUrl,
                'thumbnail' => $thumbnail,
                'mimeType'  => $mimeType,
                'fileName'  => $fileName,
                'fileSize'  => $fileSize,
                'createdAt' => $createdAt,
            ];

            if (isset($onlineUsers[$to])) {
                $onlineUsers[$to]->emit('new_message', $msgObj);
            }
        } catch (\Exception $e) {
            error_log('send_message error: ' . $e->getMessage());
            $socket->emit('error', ['message' => 'Failed to send message']);
        }
    });

    // -----------------------------------------------------------------
    // Call Signaling (WebRTC)
    // -----------------------------------------------------------------
    $socket->on('call_offer', function ($data) use ($socket, &$onlineUsers) {
        if (!isset($socket->userId)) return;
        $to = isset($data['to']) ? (int) $data['to'] : 0;
        if ($to <= 0 || !isset($onlineUsers[$to])) {
            $socket->emit('call_unavailable', ['userId' => $to]);
            return;
        }
        $onlineUsers[$to]->emit('call_offer', [
            'from'      => $socket->userId,
            'fromEmail' => $socket->userEmail ?? '',
            'offer'     => $data['offer'] ?? null,
            'callType'  => $data['callType'] ?? 'voice',
        ]);
    });

    $socket->on('call_answer', function ($data) use ($socket, &$onlineUsers) {
        if (!isset($socket->userId)) return;
        $to = isset($data['to']) ? (int) $data['to'] : 0;
        if ($to > 0 && isset($onlineUsers[$to])) {
            $onlineUsers[$to]->emit('call_answer', [
                'from'   => $socket->userId,
                'answer' => $data['answer'] ?? null,
            ]);
        }
    });

    $socket->on('ice_candidate', function ($data) use ($socket, &$onlineUsers) {
        if (!isset($socket->userId)) return;
        $to = isset($data['to']) ? (int) $data['to'] : 0;
        if ($to > 0 && isset($onlineUsers[$to])) {
            $onlineUsers[$to]->emit('ice_candidate', [
                'from'      => $socket->userId,
                'candidate' => $data['candidate'] ?? null,
            ]);
        }
    });

    $socket->on('call_end', function ($data) use ($socket, &$onlineUsers) {
        if (!isset($socket->userId)) return;
        $to = isset($data['to']) ? (int) $data['to'] : 0;
        if ($to > 0 && isset($onlineUsers[$to])) {
            $onlineUsers[$to]->emit('call_ended', ['from' => $socket->userId]);
        }
    });

    $socket->on('call_reject', function ($data) use ($socket, &$onlineUsers) {
        if (!isset($socket->userId)) return;
        $to = isset($data['to']) ? (int) $data['to'] : 0;
        if ($to > 0 && isset($onlineUsers[$to])) {
            $onlineUsers[$to]->emit('call_rejected', ['from' => $socket->userId]);
        }
    });

    $socket->on('disconnect', function () use ($socket, &$onlineUsers) {
        echo "Socket disconnected: {$socket->id}\n";
        $userId = $socket->userId ?? null;
        if ($userId && isset($onlineUsers[$userId])) {
            unset($onlineUsers[$userId]);
            echo "User $userId went offline\n";
            foreach ($onlineUsers as $uid => $sock) {
                $sock->emit('user_offline', ['userId' => $userId]);
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Inner HTTP Worker on port 5101 (REST API)
// Runs in the same process/event-loop as SocketIO — shares $onlineUsers.
// ---------------------------------------------------------------------------
$io->on('workerStart', function () use ($io) {
    TcpConnection::$defaultMaxPackageSize = 22 * 1024 * 1024;

    $httpWorker = new Worker('http://0.0.0.0:5101');
    $httpWorker->onMessage = function (TcpConnection $connection, Request $request) {
        handleRequest($connection, $request);
    };
    $httpWorker->listen();

    echo "HTTP API listening on port 5101\n";
});

Worker::runAll();
