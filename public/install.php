<?php
/**
 * eSchool Portal: ghi config.json trên hosting có PHP (cPanel).
 *
 * GET  -> trạng thái (có PHP, thư mục ghi được không, đã khóa chưa)
 * POST -> {"supabaseUrl": "...", "supabaseAnonKey": "..."} ghi config.json đúng MỘT lần.
 *
 * Sau khi ghi thành công: tạo file khóa và tự xóa chính file này. Muốn cài lại phải xóa
 * config.json và .eschool-install.lock bằng File Manager (chứng minh là chủ hosting).
 * File này không chứa bí mật: anon key vốn công khai trong trình duyệt.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const CONFIG_FILE = __DIR__ . '/config.json';
const LOCK_FILE = __DIR__ . '/.eschool-install.lock';

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body + ['eschool' => 'install.php'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function is_locked(): bool
{
    return file_exists(LOCK_FILE) || file_exists(CONFIG_FILE);
}

function base64url_decode(string $value): string
{
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

function validate_url(mixed $url): ?string
{
    if (!is_string($url) || strlen($url) > 255) return null;
    $url = rtrim(trim($url), '/');
    $parts = parse_url($url);
    if ($parts === false || !isset($parts['scheme'], $parts['host'])) return null;
    if (isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) return null;
    if (isset($parts['path']) && $parts['path'] !== '') return null;
    if (!preg_match('/^[a-z0-9.-]+$/i', $parts['host'])) return null;
    $local = in_array(strtolower($parts['host']), ['localhost', '127.0.0.1'], true);
    if ($parts['scheme'] !== 'https' && !($parts['scheme'] === 'http' && $local)) return null;
    return $url;
}

/** Chỉ nhận khóa công khai (anon / publishable); từ chối service_role / secret. */
function validate_key(mixed $key): ?string
{
    if (!is_string($key)) return null;
    $key = trim($key);
    if (!preg_match('/^[A-Za-z0-9._-]{20,2000}$/', $key)) return null;
    if (str_starts_with($key, 'sb_secret_')) return null;
    $segments = explode('.', $key);
    if (count($segments) === 3) {
        $payload = json_decode(base64url_decode($segments[1]), true);
        if (!is_array($payload) || ($payload['role'] ?? null) !== 'anon') return null;
    }
    return $key;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    respond(200, [
        'php' => PHP_VERSION,
        'writable' => is_writable(__DIR__),
        'configExists' => file_exists(CONFIG_FILE),
        'locked' => is_locked(),
    ]);
}

if ($method !== 'POST') {
    respond(405, ['error' => 'Phương thức không được hỗ trợ']);
}

if (is_locked()) {
    respond(409, ['error' => 'Đã có config.json. Muốn cài lại, hãy xóa config.json và .eschool-install.lock bằng File Manager.']);
}

$input = json_decode((string) file_get_contents('php://input', false, null, 0, 10000), true);
if (!is_array($input)) {
    respond(400, ['error' => 'Dữ liệu gửi lên không hợp lệ']);
}

$url = validate_url($input['supabaseUrl'] ?? null);
$key = validate_key($input['supabaseAnonKey'] ?? null);
if ($url === null) {
    respond(422, ['error' => 'Supabase URL không hợp lệ (phải là https://...)']);
}
if ($key === null) {
    respond(422, ['error' => 'Khóa không hợp lệ. Chỉ dùng khóa anon/publishable, không dùng service_role/secret.']);
}

if (!is_writable(__DIR__)) {
    respond(500, ['error' => 'Thư mục website không ghi được. Hãy tải config.json về rồi tải lên bằng File Manager.']);
}

// Tạo file khóa trước (atomic): hai yêu cầu đồng thời thì chỉ một yêu cầu đi tiếp
$lock = @fopen(LOCK_FILE, 'x');
if ($lock === false) {
    respond(409, ['error' => 'Đã có config.json. Muốn cài lại, hãy xóa config.json và .eschool-install.lock bằng File Manager.']);
}
fwrite($lock, gmdate('c') . "\n");
fclose($lock);

$json = json_encode(['supabaseUrl' => $url, 'supabaseAnonKey' => $key], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
$tmp = CONFIG_FILE . '.tmp';
if (file_put_contents($tmp, $json, LOCK_EX) === false || !rename($tmp, CONFIG_FILE)) {
    @unlink($tmp);
    @unlink(LOCK_FILE);
    respond(500, ['error' => 'Không ghi được config.json. Hãy tải file về rồi tải lên bằng File Manager.']);
}
@chmod(CONFIG_FILE, 0644);

// Dùng xong thì tự xóa; nếu hosting không cho xóa, file khóa vẫn chặn mọi lần ghi sau
$selfDeleted = @unlink(__FILE__);

respond(200, ['ok' => true, 'selfDeleted' => $selfDeleted]);
