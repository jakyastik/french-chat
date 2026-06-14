<?php
/**
 * API Endpoint for User Authentication (Registration, Login, Logout, Status using Email)
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../db.php';

// Configure session options for security
ini_set('session.use_only_cookies', 1);
ini_set('session.use_strict_mode', 1);

session_start();

$db = getDatabaseConnection();
$method = $_SERVER['REQUEST_METHOD'];

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST ?? $_GET;
$action = $input['action'] ?? $_GET['action'] ?? 'status';

if ($method === 'POST') {
    if ($action === 'register') {
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Please fill out all fields.']);
            exit;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'error' => 'Please enter a valid email address.']);
            exit;
        }

        if (strlen($password) < 6) {
            echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters long.']);
            exit;
        }

        try {
            // Check if email already exists
            $stmt = $db->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                echo json_encode(['success' => false, 'error' => 'This email address is already registered.']);
                exit;
            }

            // Create new user
            $userId = 'usr_' . bin2hex(random_bytes(8));
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);

            $stmtInsert = $db->prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)");
            $stmtInsert->execute([$userId, $email, $passwordHash]);

            // Auto-login after registration
            $_SESSION['user_id'] = $userId;
            $_SESSION['email'] = $email;

            echo json_encode([
                'success' => true,
                'message' => 'Registration successful.',
                'user' => [
                    'id' => $userId,
                    'email' => $email
                ]
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => 'Registration error: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'login') {
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Please enter your email and password.']);
            exit;
        }

        try {
            $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password_hash'])) {
                echo json_encode(['success' => false, 'error' => 'Incorrect email or password.']);
                exit;
            }

            // Start session
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['email'] = $user['email'];

            echo json_encode([
                'success' => true,
                'message' => 'Login successful.',
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email']
                ]
            ]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => 'Login error: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Logout successful.']);
        exit;
    }
}

if ($action === 'status') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true,
            'logged_in' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'email' => $_SESSION['email'] ?? 'User'
            ]
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'logged_in' => false
        ]);
    }
    exit;
}

// Fallback
echo json_encode(['success' => false, 'error' => 'Invalid request']);
