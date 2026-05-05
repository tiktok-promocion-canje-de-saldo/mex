<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$statsFile = __DIR__ . '/stats.jsonl';

// GET ?action=stats â†’ retorna todos os eventos
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'stats') {
    if (!file_exists($statsFile)) { echo json_encode(['events' => []]); exit; }
    $lines  = file($statsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $events = [];
    foreach ($lines as $line) {
        $ev = json_decode($line, true);
        if ($ev) $events[] = $ev;
    }
    echo json_encode(['events' => $events]);
    exit;
}

// GET ?action=clear â†’ limpa o histÃ³rico (requer sessÃ£o admin)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'clear') {
    session_start();
    if (empty($_SESSION['admin_ok'])) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); exit; }
    file_put_contents($statsFile, '');
    echo json_encode(['ok' => true]);
    exit;
}

// POST â†’ registrar evento
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !isset($body['event'])) {
        http_response_code(400); echo json_encode(['error' => 'Missing event']); exit;
    }
    $record = [
        'event' => substr(preg_replace('/[^a-z0-9_]/', '', strtolower($body['event'])), 0, 64),
        'data'  => $body['data'] ?? null,
        'ts'    => time(),
        'date'  => date('Y-m-d'),
        'hour'  => (int)date('G'),
    ];
    file_put_contents($statsFile, json_encode($record) . "\n", FILE_APPEND | LOCK_EX);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
