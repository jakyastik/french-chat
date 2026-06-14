<?php
/**
 * API Endpoint for Hover Translation with Caching
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../gemini.php';

$db = getDatabaseConnection();

$word = trim($_REQUEST['word'] ?? '');
$context = trim($_REQUEST['context'] ?? '');

if (empty($word)) {
    echo json_encode(['success' => false, 'error' => 'Missing word to translate']);
    exit;
}

// If no context is provided, default it to just the word itself
if (empty($context)) {
    $context = $word;
}

try {
    // 1. Check local translation cache
    $stmt = $db->prepare("SELECT translation FROM translation_cache WHERE LOWER(word) = LOWER(?) AND LOWER(context) = LOWER(?)");
    $stmt->execute([$word, $context]);
    $cached = $stmt->fetch();

    if ($cached) {
        echo json_encode([
            'success' => true,
            'translation' => $cached['translation'],
            'cached' => true
        ]);
        exit;
    }

    // 2. Cache miss: Ask MyMemory Free Translation API (to save Gemini quota!)
    $isSentence = ($_REQUEST['is_sentence'] ?? '') === 'true';
    $textToTranslate = $word;
    
    $url = "https://api.mymemory.translated.net/get?q=" . urlencode($textToTranslate) . "&langpair=fr|en";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.13) Gecko/20080311 Firefox/2.0.0.13');
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $json = json_decode($response, true);
        if (isset($json['responseData']['translatedText'])) {
            $translation = $json['responseData']['translatedText'];
        } else {
            throw new Exception("Translation API returned invalid structure");
        }
    } else {
        throw new Exception("Translation service unavailable (HTTP {$httpCode})");
    }
    
    // Clean translation of any quotes or trailing periods for single words
    $translation = trim($translation, "\"' \t\n\r\0\x0B");
    if (!$isSentence) {
        $translation = rtrim($translation, ".");
    }

    // 3. Store in translation cache
    $stmtInsert = $db->prepare("INSERT OR IGNORE INTO translation_cache (word, context, translation) VALUES (?, ?, ?)");
    $stmtInsert->execute([$word, $context, $translation]);

    echo json_encode([
        'success' => true,
        'translation' => $translation,
        'cached' => false
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
