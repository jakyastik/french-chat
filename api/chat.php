<?php
/**
 * API Endpoint for sending chat messages and receiving corrections & replies from Gemini
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../gemini.php';

$db = getDatabaseConnection();

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

session_start();

$userId = $_SESSION['user_id'] ?? $_SERVER['HTTP_X_USER_ID'] ?? $input['user_id'] ?? $_GET['user_id'] ?? null;
$conversationId = $input['conversation_id'] ?? $_GET['conversation_id'] ?? null;
$action = $input['action'] ?? $_GET['action'] ?? 'send';

if (empty($userId)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if (empty($conversationId)) {
    echo json_encode(['success' => false, 'error' => 'Missing Conversation ID']);
    exit;
}

try {
    // 1. Fetch conversation details to verify owner and check difficulty
    $stmtConvo = $db->prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?");
    $stmtConvo->execute([$conversationId, $userId]);
    $convo = $stmtConvo->fetch();

    if (!$convo) {
        echo json_encode(['success' => false, 'error' => 'Conversation not found or access denied']);
        exit;
    }

    $difficulty = $convo['difficulty'];
    $topic = $convo['topic'] ?? 'General';

    // 2. Fetch existing message history
    $stmtHistory = $db->prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC");
    $stmtHistory->execute([$conversationId]);
    $messages = $stmtHistory->fetchAll();

    // 3. Handle starting/initiating conversation if history is empty
    if ($action === 'start' || count($messages) === 0) {
        if (count($messages) > 0) {
            // If we already have messages, just return the existing messages list
            echo json_encode([
                'success' => true,
                'messages' => $messages
            ]);
            exit;
        }

        // Generate bot's opening message
        $systemInstruction = getSystemInstruction($difficulty, $topic);
        // Prompt for opening
        if (strpos($topic, 'TEF Oral Sec A') !== false) {
            $prompt = "Start the conversation in French as the contact person for the advertisement: '{$topic}'. Greet the user politely and ask how you can help them. Your response must be exactly a single sentence. Return your reply matching the JSON schema, with correction has_errors set to false.";
        } elseif (strpos($topic, 'TEF Oral Sec B') !== false) {
            $prompt = "Start the conversation in French by greeting your friend (the user). Mention you received their invitation or heard about '{$topic}' and ask what it's about. Your response must be exactly a single sentence. Return your reply matching the JSON schema, with correction has_errors set to false.";
        } elseif (strpos($topic, 'TEF Écrit Sec A') !== false || strpos($topic, 'TEF Ecrit Sec A') !== false) {
            $prompt = "Start the conversation in French as a writing tutor. Introduce the fait divers prompt for '{$topic}' and invite the user to start writing. Your response must be exactly a single sentence. Return your reply matching the JSON schema, with correction has_errors set to false.";
        } elseif (strpos($topic, 'TEF Écrit Sec B') !== false || strpos($topic, 'TEF Ecrit Sec B') !== false) {
            $prompt = "Start the conversation in French as a debate partner. State the topic '{$topic}' and ask the user what their opinion is on this matter. Your response must be exactly a single sentence. Return your reply matching the JSON schema, with correction has_errors set to false.";
        } else {
            $prompt = "Start the conversation by greeting the user warmly in French as a French teaching assistant, and ask a simple question. Keep your language strictly within the limit of {$difficulty} level. Your response must be exactly a single sentence. Return your reply matching the JSON schema, with correction has_errors set to false.";
        }

        $responseSchema = getResponseSchema();
        $rawReply = callGemini($prompt, $systemInstruction, $responseSchema);
        $replyData = parseGeminiResponse($rawReply);

        // Save bot's opening message
        $stmtInsertMsg = $db->prepare("INSERT INTO messages (conversation_id, sender, message) VALUES (?, 'bot', ?)");
        $stmtInsertMsg->execute([$conversationId, $replyData['response']]);
        $botMsgId = $db->lastInsertId();

        echo json_encode([
            'success' => true,
            'user_message' => null,
            'bot_message' => [
                'id' => $botMsgId,
                'conversation_id' => $conversationId,
                'sender' => 'bot',
                'message' => $replyData['response'],
                'created_at' => date('Y-m-d H:i:s')
            ]
        ]);
        exit;
    }

    // 4. Handle sending a new message
    $userMsgText = trim($input['message'] ?? '');
    if (empty($userMsgText)) {
        echo json_encode(['success' => false, 'error' => 'Message content is empty']);
        exit;
    }

    // Save user's message to DB first
    $stmtInsertUserMsg = $db->prepare("INSERT INTO messages (conversation_id, sender, message) VALUES (?, 'user', ?)");
    $stmtInsertUserMsg->execute([$conversationId, $userMsgText]);
    $userMsgId = $db->lastInsertId();

    // Format conversation history for Gemini (excluding the message we just saved to handle manually in contents)
    $geminiContents = [];
    $recentMessages = array_slice($messages, -8);
    foreach ($recentMessages as $msg) {
        $role = ($msg['sender'] === 'user') ? 'user' : 'model';
        $geminiContents[] = [
            'role' => $role,
            'parts' => [['text' => $msg['message']]]
        ];
    }
    
    // Add the user's latest message to contents
    $geminiContents[] = [
        'role' => 'user',
        'parts' => [['text' => $userMsgText]]
    ];

    $systemInstruction = getSystemInstruction($difficulty, $topic) . "\n" .
        "CRITICAL: Look at the user's LATEST message (the very last text in the history) and evaluate it for French grammar, vocabulary, spelling, and phrasing errors. Set correction fields accordingly.";

    $responseSchema = getResponseSchema();
    $rawReply = callGemini($geminiContents, $systemInstruction, $responseSchema);
    $replyData = parseGeminiResponse($rawReply);

    // Save bot's reply message
    $stmtInsertBotMsg = $db->prepare("INSERT INTO messages (conversation_id, sender, message) VALUES (?, 'bot', ?)");
    $stmtInsertBotMsg->execute([$conversationId, $replyData['response']]);
    $botMsgId = $db->lastInsertId();

    // Update user's message with corrections if any
    $hasErrors = $replyData['correction']['has_errors'] ?? false;
    $correctedText = $replyData['correction']['corrected_text'] ?? '';
    $explanation = $replyData['correction']['explanation'] ?? '';

    if ($hasErrors && !empty($correctedText)) {
        $stmtUpdateUserMsg = $db->prepare("UPDATE messages SET corrected_message = ?, correction_explanation = ? WHERE id = ?");
        $stmtUpdateUserMsg->execute([$correctedText, $explanation, $userMsgId]);
    }

    echo json_encode([
        'success' => true,
        'user_message' => [
            'id' => $userMsgId,
            'message' => $userMsgText,
            'corrected_message' => $hasErrors ? $correctedText : null,
            'correction_explanation' => $hasErrors ? $explanation : null
        ],
        'bot_message' => [
            'id' => $botMsgId,
            'conversation_id' => $conversationId,
            'sender' => 'bot',
            'message' => $replyData['response'],
            'created_at' => date('Y-m-d H:i:s')
        ]
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Returns prompt guidance based on French language difficulty
 */
function getTefRoleplayInstruction($topic) {
    if (strpos($topic, 'TEF Oral Sec A') !== false) {
        return "\nROLEPLAY TASK (TEF Oral Section A - Inquiries):\n" .
            "You must play the role of the receptionist, contact person, or organizer for this advertisement: '{$topic}'.\n" .
            "The user's goal is to ask you questions to get information. You must respond realistically to their questions in French.\n" .
            "Keep your responses short (exactly 1 sentence) and invite them to ask more questions. Do not give all information at once.\n";
    } elseif (strpos($topic, 'TEF Oral Sec B') !== false) {
        return "\nROLEPLAY TASK (TEF Oral Section B - Persuasion):\n" .
            "You must play the role of a skeptical friend of the user.\n" .
            "The user is trying to convince you to try or join: '{$topic}'.\n" .
            "You must raise realistic doubts and objections (e.g., too expensive, no time, too difficult, not interested) in French.\n" .
            "Do not agree too quickly. Challenge their arguments politely. Your responses must be exactly 1 sentence.\n";
    } elseif (strpos($topic, 'TEF Écrit Sec A') !== false || strpos($topic, 'TEF Ecrit Sec A') !== false) {
        return "\nROLEPLAY TASK (TEF Écrit Section A - Fait Divers):\n" .
            "You must play the role of a supportive TEF writing coach.\n" .
            "The task is '{$topic}'. Prompt the user to write a narrative story (fait divers) in past tenses (passé composé/imparfait).\n" .
            "Offer them feedback on grammar and guide them to complete the narrative.\n" .
            "Keep your replies exactly 1 sentence long.\n";
    } elseif (strpos($topic, 'TEF Écrit Sec B') !== false || strpos($topic, 'TEF Ecrit Sec B') !== false) {
        return "\nROLEPLAY TASK (TEF Écrit Section B - Argumentation):\n" .
            "You must play the role of a debate partner for this topic: '{$topic}'.\n" .
            "Challenge the user's opinions, ask them to support their claims with examples, or present a mild counter-argument in French.\n" .
            "Keep your responses exactly 1 sentence long to maintain the chat format.\n";
    }
    return "";
}

function getSystemInstruction($difficulty, $topic = 'General') {
    $base = "You are a friendly, encouraging, and supportive French teacher AI chat partner. You are talking to a student. Your goal is to keep them motivated to practice French.\n";
    
    switch ($difficulty) {
        case 'A2':
            $levelDesc = "A2 (Elementary). Speak in simple sentences using common, everyday vocabulary. Use simple past tenses (like passé composé with common verbs) or future (like futur proche) sparingly. Keep ideas clear and straightforward.";
            break;
        case 'B1':
            $levelDesc = "B1 (Intermediate). Speak about routine topics, personal interests, feelings, opinions, and experiences. You can use a wider range of tenses (imparfait, futur simple, conditionnel) and slightly more complex connectors.";
            break;
        case 'B2':
            $levelDesc = "B2 (Upper Intermediate). Discuss abstract or complex concrete topics, state arguments, use active intermediate vocabulary, and employ more advanced grammar structures (like subjonctif present).";
            break;
        case 'C1':
            $levelDesc = "C1 (Advanced). Express yourself fluently and spontaneously on complex topics, using advanced vocabulary, expressions, and structures. Talk with nuance.";
            break;
        case 'C2':
            $levelDesc = "C2 (Mastery). Speak like a native. Feel free to use complex sentence structures, idioms, rich vocabulary, and subtle references.";
            break;
        case 'A1':
        default:
            $levelDesc = "A1 (Beginner). Speak in very simple, short sentences. Use present tense only and extremely basic verbs (être, avoir, aimer, faire, etc.). Avoid complex words, phrases, or grammar concepts.";
            break;
    }

    $topicPrompt = "";
    if ($topic !== 'General') {
        $roleplayRule = getTefRoleplayInstruction($topic);
        if (!empty($roleplayRule)) {
            $topicPrompt = $roleplayRule;
        } else {
            $topicPrompt = "\nThe conversation topic is: {$topic}. You must guide the conversation, ask questions, and use vocabulary related specifically to this topic.\n";
        }
    }

    return $base . "The user has selected the difficulty: {$difficulty}. Therefore, you must respond strictly using French at the following level: {$levelDesc}\n" .
        $topicPrompt . "\n" .
        "Your task is twofold:\n" .
        "1. Check the user's latest input for errors. In the JSON output, populate the 'correction' field. If they made mistakes in grammar, spelling, or word choice, set 'has_errors' to true, provide the corrected French version in 'corrected_text', and write a simple explanation in English in 'explanation'. If their French is correct, set 'has_errors' to false and leave the other correction fields empty.\n" .
        "2. Formulate your conversational reply in French at the user's difficulty level, and set it in the 'response' field. Encourage them and keep the conversation going with a question or comment. Your reply MUST be exactly a single sentence. Do not write multiple sentences under any circumstances.\n" .
        "Keep your reply natural, conversational, and helpful.";
}

/**
 * Returns response JSON schema for Gemini API
 */
function getResponseSchema() {
    return [
        'type' => 'OBJECT',
        'properties' => [
            'correction' => [
                'type' => 'OBJECT',
                'properties' => [
                    'has_errors' => ['type' => 'BOOLEAN'],
                    'corrected_text' => ['type' => 'STRING'],
                    'explanation' => ['type' => 'STRING']
                ],
                'required' => ['has_errors', 'corrected_text', 'explanation']
            ],
            'response' => ['type' => 'STRING']
        ],
        'required' => ['correction', 'response']
    ];
}

/**
 * Cleans markdown code blocks and parses Gemini JSON response
 */
function parseGeminiResponse($rawReply) {
    // Strip markdown code block notation if present
    $cleanReply = preg_replace('/^```(?:json)?\s+/i', '', $rawReply);
    $cleanReply = preg_replace('/\s+```$/i', '', $cleanReply);
    $cleanReply = trim($cleanReply);

    $decoded = json_decode($cleanReply, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        // Fallback in case Gemini returns invalid JSON
        return [
            'correction' => [
                'has_errors' => false,
                'corrected_text' => '',
                'explanation' => ''
            ],
            'response' => $rawReply // return raw response if parsing failed
        ];
    }

    return $decoded;
}
