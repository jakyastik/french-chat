<?php
/**
 * Google Gemini API Client Wrapper
 */

require_once __DIR__ . '/config.php';

/**
 * Calls Google Gemini API
 * 
 * @param string|array $prompt The prompt (string) or conversation history (array) to send
 * @param string|null $systemInstruction System instructions to guide behavior
 * @param array|null $jsonSchema Optional schema for structured JSON output
 * @return string The raw content response or empty string on failure
 */
function callGemini($prompt, $systemInstruction = null, $jsonSchema = null) {
    // Check for client-supplied API key in headers first, fallback to config constant
    $apiKey = $_SERVER['HTTP_X_GEMINI_KEY'] ?? $_SERVER['HTTP_X_API_KEY'] ?? null;
    if (empty($apiKey) || $apiKey === 'null') {
        $apiKey = GEMINI_API_KEY;
    }
    
    if ($apiKey === 'YOUR_GEMINI_API_KEY_HERE' || empty($apiKey)) {
        throw new Exception("Gemini API key is not configured. Please edit config.php or enter it in the settings panel.");
    }

    $model = GEMINI_MODEL;
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    if (is_array($prompt)) {
        $contents = $prompt;
    } else {
        $contents = [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ];
    }

    $data = [
        'contents' => $contents
    ];

    if ($systemInstruction) {
        $data['systemInstruction'] = [
            'parts' => [
                ['text' => $systemInstruction]
            ]
        ];
    }

    $generationConfig = [];
    if ($jsonSchema) {
        $generationConfig['responseMimeType'] = 'application/json';
        $generationConfig['responseSchema'] = $jsonSchema;
    }
    
    if (!empty($generationConfig)) {
        $data['generationConfig'] = $generationConfig;
    }

    $jsonData = json_encode($data);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 30 seconds timeout

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        throw new Exception("cURL Error: " . $curlError);
    }

    if ($httpCode !== 200) {
        if ($httpCode === 429) {
            throw new Exception("Gemini API Rate Limit / Quota Exceeded. Please wait a moment and try again.");
        }
        throw new Exception("Gemini API Error: HTTP {$httpCode}.");
    }

    $decoded = json_decode($response, true);
    $textResponse = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
    
    return trim($textResponse);
}
